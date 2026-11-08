-- =====================================================================
-- Кураторлар: 3 аккаунт түрі — әкімші (admin), куратор (curator), оқушы (student)
--   * бұрынғы 'teacher' рөлі → 'curator'; course_teachers → course_curators (curator_id)
--   * куратор видео жүктей АЛМАЙДЫ (видео — тек әкімші)
--   * куратор өзіне бекітілген курстардағы оқушылардың нәтижелерін көреді
--     және черновик/конспектке белгі қояды (set_homework_check)
--   * әкімші gmail бойынша шақырады: тіркелген болса — бірден, тіркелмеген болса — тіркелгенде куратор болады
-- Қайта іске қосуға болады; деректер өшірілмейді.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Рөл: teacher → curator
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'user_role' and e.enumlabel = 'teacher')
     and not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'user_role' and e.enumlabel = 'curator') then
    alter type public.user_role rename value 'teacher' to 'curator';
  end if;
end $$;
alter type public.user_role add value if not exists 'curator';

-- ---------------------------------------------------------------------
-- Курсқа бекіту: course_teachers → course_curators
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.course_teachers') is not null and to_regclass('public.course_curators') is null then
    alter table public.course_teachers rename to course_curators;
    alter table public.course_curators rename column teacher_id to curator_id;
  end if;
end $$;

create table if not exists public.course_curators (
  course_id   uuid not null references public.courses (id) on delete cascade,
  curator_id  uuid not null references public.profiles (id) on delete cascade,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (course_id, curator_id)
);
create index if not exists course_curators_curator_idx on public.course_curators (curator_id);
alter table public.course_curators enable row level security;

drop policy if exists "course_teachers: admin all" on public.course_curators;
drop policy if exists "course_teachers: own rows" on public.course_curators;
drop policy if exists "curators: admin басқарады" on public.course_curators;
create policy "curators: admin басқарады" on public.course_curators
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "curators: өз курстарын көреді" on public.course_curators;
create policy "curators: өз курстарын көреді" on public.course_curators
  for select to authenticated using (curator_id = auth.uid() and public.is_session_authorized());

grant select, insert, update, delete on public.course_curators to authenticated;
grant all on public.course_curators to service_role;

-- ---------------------------------------------------------------------
-- Құқық функциялары
-- ---------------------------------------------------------------------
create or replace function public.is_curator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role::text = 'curator' and blocked_at is null
  ) and public.is_session_authorized();
$$;

-- Куратор (немесе әкімші) осы курстың нәтижелерін көріп, черновик/конспектті белгілей ала ма
create or replace function public.can_curate_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_course_id is not null and (
    public.is_admin()
    or (public.is_curator() and exists (
      select 1 from public.course_curators cc where cc.course_id = p_course_id and cc.curator_id = auth.uid()
    ))
  );
$$;

-- Видео жүктеу/өшіру — тек әкімші (кураторға рұқсат жоқ)
create or replace function public.can_manage_course_videos(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_course_id is not null and public.is_admin();
$$;

drop function if exists public.is_teacher();

grant execute on function public.is_curator() to authenticated, service_role;
grant execute on function public.can_curate_course(uuid) to authenticated, service_role;
grant execute on function public.can_manage_course_videos(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Нәтижелерді оқу (тек оқу; жазу бұрынғыдай сервер/әкімші)
-- ---------------------------------------------------------------------
drop policy if exists "attempts: куратор көреді" on public.test_attempts;
create policy "attempts: куратор көреді" on public.test_attempts
  for select to authenticated
  using (public.is_curator() and exists (
    select 1 from public.test_variants v where v.id = variant_id and public.can_curate_course(v.course_id)
  ));

drop policy if exists "scores: куратор көреді" on public.attempt_scores;
create policy "scores: куратор көреді" on public.attempt_scores
  for select to authenticated
  using (public.is_curator() and exists (
    select 1 from public.test_attempts a join public.test_variants v on v.id = a.variant_id
    where a.id = attempt_id and public.can_curate_course(v.course_id)
  ));

drop policy if exists "answers: куратор көреді" on public.student_answers;
create policy "answers: куратор көреді" on public.student_answers
  for select to authenticated
  using (public.is_curator() and exists (
    select 1 from public.test_attempts a join public.test_variants v on v.id = a.variant_id
    where a.id = attempt_id and public.can_curate_course(v.course_id)
  ));

-- Оқушы профилі (аты, email): тек куратордың курсында тест тапсырған немесе курсқа жазылған оқушылар
drop policy if exists "profiles: куратор өз оқушыларын көреді" on public.profiles;
create policy "profiles: куратор өз оқушыларын көреді" on public.profiles
  for select to authenticated
  using (
    public.is_curator() and (
      exists (select 1 from public.test_attempts a join public.test_variants v on v.id = a.variant_id
              where a.student_id = profiles.id and public.can_curate_course(v.course_id))
      or exists (select 1 from public.course_enrollments ce
                 where ce.student_id = profiles.id and public.can_curate_course(ce.course_id))
    )
  );

drop policy if exists "enrollments: куратор көреді" on public.course_enrollments;
create policy "enrollments: куратор көреді" on public.course_enrollments
  for select to authenticated
  using (public.is_curator() and public.can_curate_course(course_id));

drop policy if exists "homework: куратор көреді" on public.homework_checks;
create policy "homework: куратор көреді" on public.homework_checks
  for select to authenticated
  using (public.is_curator() and public.can_curate_course((select v.course_id from public.test_variants v where v.id = variant_id)));

-- Черновик/конспект белгісі: әкімші немесе осы курстың кураторы (бір оқушыға бір нұсқада бір жазба)
create or replace function public.set_homework_check(p_variant uuid, p_student uuid, p_kind text, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course uuid;
begin
  if p_kind not in ('draft', 'notes') then
    raise exception 'Белгісіз тапсырма' using errcode = '22023';
  end if;
  if p_status is not null and p_status not in ('on_time', 'late', 'missing') then
    raise exception 'Белгісіз күй' using errcode = '22023';
  end if;
  select course_id into v_course from public.test_variants where id = p_variant;
  if v_course is null then
    raise exception 'Нұсқа табылмады' using errcode = 'P0002';
  end if;
  if not public.can_curate_course(v_course) then
    raise exception 'Бұл курсты тексеруге рұқсатыңыз жоқ' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_student and p.role::text = 'student') then
    raise exception 'Оқушы табылмады' using errcode = 'P0002';
  end if;

  insert into public.homework_checks as h (variant_id, student_id, draft_status, notes_status, checked_by)
  values (p_variant, p_student,
          case when p_kind = 'draft' then p_status end,
          case when p_kind = 'notes' then p_status end,
          auth.uid())
  on conflict (variant_id, student_id) do update
    set draft_status = case when p_kind = 'draft' then p_status else h.draft_status end,
        notes_status = case when p_kind = 'notes' then p_status else h.notes_status end,
        checked_by = auth.uid();
end;
$$;

revoke all on function public.set_homework_check(uuid, uuid, text, text) from public, anon;
grant execute on function public.set_homework_check(uuid, uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Gmail бойынша шақыру: тіркелгенде куратор болады
-- ---------------------------------------------------------------------
create table if not exists public.curator_invites (
  email       text primary key check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  course_ids  uuid[] not null default '{}',
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.curator_invites enable row level security;
drop policy if exists "invites: admin басқарады" on public.curator_invites;
create policy "invites: admin басқарады" on public.curator_invites
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.curator_invites to authenticated;
grant all on public.curator_invites to service_role;

-- Профиль құрылғанда (тіркелу): шақыру болса — рөл curator
create or replace function public.apply_curator_invite_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and exists (select 1 from public.curator_invites i where i.email = lower(new.email)) then
    new.role := 'curator';
  end if;
  return new;
end;
$$;

-- ...және курстарға бекіту, шақыруды өшіру
create or replace function public.apply_curator_invite_courses()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.curator_invites;
begin
  if new.email is null then
    return new;
  end if;
  select * into inv from public.curator_invites where email = lower(new.email);
  if found then
    insert into public.course_curators (course_id, curator_id, created_by)
    select c.id, new.id, inv.created_by from public.courses c where c.id = any (inv.course_ids)
    on conflict do nothing;
    delete from public.curator_invites where email = inv.email;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_curator_invite_role on public.profiles;
create trigger profiles_curator_invite_role
  before insert on public.profiles
  for each row execute function public.apply_curator_invite_role();

drop trigger if exists profiles_curator_invite_courses on public.profiles;
create trigger profiles_curator_invite_courses
  after insert on public.profiles
  for each row execute function public.apply_curator_invite_courses();

revoke all on function public.apply_curator_invite_role() from public, anon, authenticated;
revoke all on function public.apply_curator_invite_courses() from public, anon, authenticated;

comment on table public.course_curators is 'Куратор (role=curator) қай курстардың оқушыларының нәтижесін көреді';
comment on table public.curator_invites is 'Gmail бойынша куратор шақыруы: сол email-мен тіркелгенде куратор болады';
