-- =====================================================================
-- Құрылғы бақылауы: аккаунтты басқаларға таратудан қорғау
-- 20261028000001_cloudflare_stream_access.sql-дан кейін іске қосылады.
-- Idempotent: қайта іске қосқанда «already exists» қатесі шықпайды.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Баптаулар: құрылғы лимиті (админ-панельден өзгертіледі;
-- MAX_DEVICES_PER_USER env айнымалысы оны серверде басып озады)
-- ---------------------------------------------------------------------
alter table public.platform_settings
  add column if not exists max_devices_per_user integer not null default 4;

alter table public.platform_settings
  drop constraint if exists platform_settings_max_devices_check,
  add constraint platform_settings_max_devices_check check (max_devices_per_user between 1 and 20);

-- Аккаунтты бұғаттау (әкімші)
alter table public.profiles
  add column if not exists blocked_at timestamptz;

-- ---------------------------------------------------------------------
-- user_devices: бір жол = бір браузер (device_id cookie)
-- ---------------------------------------------------------------------
create table if not exists public.user_devices (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  device_id       uuid not null,
  session_id      uuid,
  device_name     text check (char_length(device_name) <= 80),
  browser         text check (char_length(browser) <= 60),
  os              text check (char_length(os) <= 60),
  ip_address      inet,
  location        text check (char_length(location) <= 80),
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  is_active       boolean not null default true,
  revoked_at      timestamptz,
  revoked_reason  text check (char_length(revoked_reason) <= 40),
  created_at      timestamptz not null default now()
);

-- Бір user + device бір рет қана жазылады
create unique index if not exists user_devices_user_device_key on public.user_devices (user_id, device_id);
-- Бір Supabase сессиясы тек бір құрылғыға тиесілі
create unique index if not exists user_devices_session_key on public.user_devices (session_id) where session_id is not null;
create index if not exists user_devices_user_active_idx on public.user_devices (user_id, is_active, last_seen_at desc);

-- Өшірілген сессиялар: access token мерзімі біткенше (≤ 1 сағ) қайта «асырап алынбауы» үшін
create table if not exists public.revoked_sessions (
  session_id  uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  revoked_at  timestamptz not null default now()
);

-- Сәтсіз кіру әрекеттері (rate limit). Email ашық сақталмайды — тек SHA-256 хэші.
create table if not exists public.login_attempts (
  id          bigint generated always as identity primary key,
  email_hash  text not null check (char_length(email_hash) = 64),
  ip_address  inet,
  success     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists login_attempts_email_idx on public.login_attempts (email_hash, created_at desc);
create index if not exists login_attempts_ip_idx on public.login_attempts (ip_address, created_at desc);

alter table public.user_devices enable row level security;
alter table public.revoked_sessions enable row level security;
alter table public.login_attempts enable row level security;

-- ---------------------------------------------------------------------
-- Сессия тексеру: JWT ішіндегі session_id → белсенді, бұғатталмаған құрылғы
-- ---------------------------------------------------------------------
create or replace function public.current_session_id()
returns uuid
language sql
stable
as $$
  select case
    when coalesce(auth.jwt() ->> 'session_id', '') ~ '^[0-9a-fA-F-]{36}$' then (auth.jwt() ->> 'session_id')::uuid
  end;
$$;

create or replace function public.is_session_authorized()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_devices d
    join public.profiles p on p.id = d.user_id
    where d.user_id = auth.uid()
      and d.session_id = public.current_session_id()
      and d.is_active
      and p.blocked_at is null
  );
$$;

-- is_admin енді тек рұқсат етілген сессияда шын болады (өшірілген құрылғы әкімші құқығын жоғалтады)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and blocked_at is null
  ) and public.is_session_authorized();
$$;

create or replace function public.owns_attempt(p_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_session_authorized() and exists (
    select 1 from public.test_attempts
    where id = p_attempt_id and student_id = auth.uid()
  );
$$;

create or replace function public.can_write_answer(p_attempt_id uuid, p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_session_authorized() and exists (
    select 1
    from public.test_attempts a
    join public.questions q on q.variant_id = a.variant_id
    where a.id = p_attempt_id
      and q.id = p_question_id
      and a.student_id = auth.uid()
      and a.status = 'in_progress'
      and (a.deadline_at is null or now() < a.deadline_at + interval '2 minutes')
  );
$$;

-- Курсқа рұқсат: өшірілген сессия курсқа кіре алмайды
create or replace function public.has_course_access(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or (
      public.is_session_authorized()
      and exists (
        select 1
        from public.courses c
        where c.id = p_course_id
          and c.status = 'published'
          and (
            c.access_mode = 'open'
            or exists (
              select 1 from public.course_enrollments e
              where e.course_id = c.id and e.student_id = auth.uid()
            )
          )
      )
    );
$$;

-- Оқушы өз блогын/рөлін өзгерте алмайды
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Рөлді өзгертуге рұқсат жоқ' using errcode = '42501';
    end if;
    if new.blocked_at is distinct from old.blocked_at then
      raise exception 'Бұғаттау күйін өзгертуге рұқсат жоқ' using errcode = '42501';
    end if;
    if new.email is distinct from old.email then
      new.email := old.email;
    end if;
  end if;
  return new;
end;
$$;

/**
 * Ағымдағы сессияның күйі (middleware, heartbeat, сервер тексерісі үшін).
 * Нәтиже: ok | unregistered | revoked | blocked | mismatch | anonymous
 * ok болса last_seen_at жаңартылады (ең жиі — минутына бір рет).
 */
create or replace function public.check_device_session(p_device_id uuid default null)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sid uuid := public.current_session_id();
  v_row public.user_devices%rowtype;
begin
  if v_uid is null or v_sid is null then
    return 'anonymous';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and blocked_at is not null) then
    return 'blocked';
  end if;
  if exists (select 1 from public.revoked_sessions where session_id = v_sid) then
    return 'revoked';
  end if;

  select * into v_row from public.user_devices where session_id = v_sid;
  if not found then
    return 'unregistered';
  end if;
  if v_row.user_id <> v_uid or not v_row.is_active then
    return 'revoked';
  end if;
  -- Cookie басқа браузерге көшірілген (сессия ұрланған) болса
  if p_device_id is not null and v_row.device_id <> p_device_id then
    return 'mismatch';
  end if;

  if v_row.last_seen_at < now() - interval '60 seconds' then
    update public.user_devices set last_seen_at = now() where id = v_row.id;
  end if;
  return 'ok';
end;
$$;

/**
 * Құрылғыны atomic тіркеу (тек service_role — Next.js сервері шақырады).
 * Пайдаланушы бойынша advisory lock: бір мезгілде бірнеше жаңа құрылғы кірсе де лимиттен аспайды.
 * Нәтиже: { status: ok | limit_reached | blocked | revoked | mismatch, is_new, active_count, device_limit }
 */
create or replace function public.register_device(
  p_user uuid,
  p_device uuid,
  p_session uuid,
  p_device_name text,
  p_browser text,
  p_os text,
  p_ip inet,
  p_location text,
  p_limit_override integer default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_role text;
  v_blocked timestamptz;
  v_limit integer;
  v_existing public.user_devices%rowtype;
  v_by_session public.user_devices%rowtype;
  v_active integer;
  v_is_new boolean := false;
begin
  if p_user is null or p_device is null or p_session is null then
    raise exception 'register_device: міндетті параметр жоқ';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('user_devices:' || p_user::text, 0));

  select role, blocked_at into v_role, v_blocked from public.profiles where id = p_user;
  if v_blocked is not null then
    return jsonb_build_object('status', 'blocked');
  end if;
  if exists (select 1 from public.revoked_sessions where session_id = p_session) then
    return jsonb_build_object('status', 'revoked');
  end if;

  -- Сессия басқа құрылғыға тіркелген болса — cookie көшірілген
  select * into v_by_session from public.user_devices where session_id = p_session;
  if found and (v_by_session.user_id <> p_user or v_by_session.device_id <> p_device) then
    return jsonb_build_object('status', 'mismatch');
  end if;

  v_limit := coalesce(
    p_limit_override,
    (select max_devices_per_user from public.platform_settings where id = 1),
    4
  );

  select * into v_existing from public.user_devices where user_id = p_user and device_id = p_device for update;

  if found and v_existing.is_active then
    -- Сол браузер: бет жаңарту / қайта кіру — жаңа құрылғы емес
    update public.user_devices
       set session_id = p_session,
           device_name = left(p_device_name, 80),
           browser = left(p_browser, 60),
           os = left(p_os, 60),
           ip_address = p_ip,
           location = left(p_location, 80),
           last_seen_at = now()
     where id = v_existing.id;
  else
    select count(*) into v_active from public.user_devices where user_id = p_user and is_active;
    -- Әкімші лимиттен босатылады (бірақ құрылғылары тіркеледі)
    if coalesce(v_role, 'student') <> 'admin' and v_active >= v_limit then
      return jsonb_build_object('status', 'limit_reached', 'active_count', v_active, 'device_limit', v_limit);
    end if;

    v_is_new := true;
    insert into public.user_devices as d
      (user_id, device_id, session_id, device_name, browser, os, ip_address, location, first_seen_at, last_seen_at, is_active, revoked_at, revoked_reason)
    values
      (p_user, p_device, p_session, left(p_device_name, 80), left(p_browser, 60), left(p_os, 60), p_ip, left(p_location, 80), now(), now(), true, null, null)
    on conflict (user_id, device_id) do update
      set session_id = excluded.session_id,
          device_name = excluded.device_name,
          browser = excluded.browser,
          os = excluded.os,
          ip_address = excluded.ip_address,
          location = excluded.location,
          first_seen_at = now(),
          last_seen_at = now(),
          is_active = true,
          revoked_at = null,
          revoked_reason = null;
  end if;

  select count(*) into v_active from public.user_devices where user_id = p_user and is_active;
  return jsonb_build_object('status', 'ok', 'is_new', v_is_new, 'active_count', v_active, 'device_limit', v_limit);
end;
$$;

/**
 * Құрылғыларды/сессияларды өшіру (тек service_role).
 *  p_device_row — бір құрылғы; null болса — пайдаланушының барлық құрылғылары
 *  p_keep_session — осы сессия қалады («басқа барлық құрылғылардан шығу»)
 * Supabase сессиясы (refresh token) auth.sessions-тан өшіріледі; егер Supabase бұған
 * рұқсат бермесе, сессия revoked_sessions-қа жазылады және RLS/сервер оны бірден бұғаттайды.
 */
create or replace function public.revoke_user_sessions(
  p_user uuid,
  p_device_row uuid default null,
  p_keep_session uuid default null,
  p_reason text default 'user'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_sessions uuid[];
  v_count integer;
  v_auth_deleted boolean := true;
begin
  with revoked as (
    update public.user_devices
       set is_active = false,
           revoked_at = now(),
           revoked_reason = left(coalesce(p_reason, 'user'), 40)
     where user_id = p_user
       and is_active
       and (p_device_row is null or id = p_device_row)
       and (p_keep_session is null or session_id is distinct from p_keep_session)
    returning session_id
  )
  select coalesce(array_agg(session_id) filter (where session_id is not null), '{}'), count(*)
    into v_sessions, v_count
    from revoked;

  -- Барлық құрылғы өшірілсе — тіркелмеген (ескі) сессиялар да тоқтатылады
  if p_device_row is null then
    begin
      select v_sessions || coalesce(array_agg(s.id), '{}')
        into v_sessions
        from auth.sessions s
       where s.user_id = p_user
         and (p_keep_session is null or s.id <> p_keep_session)
         and not (s.id = any (v_sessions));
    exception when others then
      null;
    end;
  end if;

  insert into public.revoked_sessions (session_id, user_id)
  select unnest(v_sessions), p_user
  on conflict (session_id) do nothing;

  begin
    delete from auth.sessions where id = any (v_sessions);
  exception when others then
    v_auth_deleted := false;
  end;

  -- Ескі жазбаларды тазалау (access token ең көбі 1 сағат жарамды)
  delete from public.revoked_sessions where revoked_at < now() - interval '2 days';

  return jsonb_build_object('revoked_devices', v_count, 'sessions', coalesce(array_length(v_sessions, 1), 0), 'auth_sessions_deleted', v_auth_deleted);
end;
$$;

-- ---------------------------------------------------------------------
-- Кіру әрекеттерінің шектеуі (rate limit)
-- ---------------------------------------------------------------------
create or replace function public.login_rate_status(p_email_hash text, p_ip inet)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with email_f as (
    select count(*) as n, max(created_at) as last_at
    from public.login_attempts
    where email_hash = p_email_hash and not success and created_at > now() - interval '15 minutes'
  ),
  ip_f as (
    select count(*) as n, max(created_at) as last_at
    from public.login_attempts
    where p_ip is not null and ip_address = p_ip and not success and created_at > now() - interval '15 minutes'
  )
  select jsonb_build_object(
    'email_failures', email_f.n,
    'ip_failures', ip_f.n,
    'retry_after_seconds',
      case
        when email_f.n >= 5 then greatest(1, ceil(extract(epoch from (email_f.last_at + interval '15 minutes' - now()))))::int
        when ip_f.n >= 30 then greatest(1, ceil(extract(epoch from (ip_f.last_at + interval '15 minutes' - now()))))::int
        else 0
      end
  )
  from email_f, ip_f;
$$;

create or replace function public.login_rate_record(p_email_hash text, p_ip inet, p_success boolean)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_success then
    delete from public.login_attempts where email_hash = p_email_hash and not success;
  else
    insert into public.login_attempts (email_hash, ip_address, success) values (p_email_hash, p_ip, false);
  end if;
  delete from public.login_attempts where created_at < now() - interval '1 day';
end;
$$;

-- ---------------------------------------------------------------------
-- RLS: оқушы деректері тек рұқсат етілген (белсенді құрылғыдағы) сессияға
-- ---------------------------------------------------------------------
drop policy if exists "devices: өз құрылғыларын немесе admin барлығын көреді" on public.user_devices;
create policy "devices: өз құрылғыларын немесе admin барлығын көреді"
  on public.user_devices for select to authenticated
  using ((user_id = auth.uid() and public.is_session_authorized()) or public.is_admin());
-- user_devices, revoked_sessions, login_attempts-қа жазу тек сервер арқылы (service_role)

drop policy if exists "attempts: өз талпыныстарын немесе admin барлығын көреді" on public.test_attempts;
create policy "attempts: өз талпыныстарын немесе admin барлығын көреді"
  on public.test_attempts for select to authenticated
  using ((student_id = auth.uid() and public.is_session_authorized()) or public.is_admin());

drop policy if exists "enrollments: өз рұқсатын немесе admin барлығын көреді" on public.course_enrollments;
create policy "enrollments: өз рұқсатын немесе admin барлығын көреді"
  on public.course_enrollments for select to authenticated
  using ((student_id = auth.uid() and public.is_session_authorized()) or public.is_admin());

drop policy if exists "profiles: өз профилін өзгерту" on public.profiles;
create policy "profiles: өз профилін өзгерту"
  on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_session_authorized())
  with check (id = auth.uid());

-- student_answers және attempt_scores policy-лері owns_attempt / can_write_answer арқылы
-- автоматты түрде is_session_authorized() тексерісін алады (жоғарыдағы функциялар).

-- ---------------------------------------------------------------------
-- Рұқсаттар
-- ---------------------------------------------------------------------
grant select on public.user_devices to authenticated;
grant all on public.user_devices, public.revoked_sessions, public.login_attempts to service_role;

grant execute on function public.current_session_id() to anon, authenticated, service_role;
grant execute on function public.is_session_authorized() to anon, authenticated, service_role;
grant execute on function public.check_device_session(uuid) to authenticated, service_role;

revoke all on function public.register_device(uuid, uuid, uuid, text, text, text, inet, text, integer) from public, anon, authenticated;
grant execute on function public.register_device(uuid, uuid, uuid, text, text, text, inet, text, integer) to service_role;

revoke all on function public.revoke_user_sessions(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid, uuid, uuid, text) to service_role;

revoke all on function public.login_rate_status(text, inet) from public, anon, authenticated;
grant execute on function public.login_rate_status(text, inet) to service_role;
revoke all on function public.login_rate_record(text, inet, boolean) from public, anon, authenticated;
grant execute on function public.login_rate_record(text, inet, boolean) to service_role;
