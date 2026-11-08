-- =====================================================================
-- Видеоны админ-панельден Cloudflare Stream-ға тікелей жүктеу
--   * user_role: 'teacher' (мұғалім) рөлі
--   * course_teachers: мұғалім қай курстардың видеосын басқара алады
--   * stream_videos: сайттан жүктелген әр Cloudflare видеосының жазбасы
--   * can_manage_course_videos(): admin немесе осы курстың мұғалімі
--   * stream_video_mark_ready(): дайын видеоны сабаққа атомарлы бекіту
-- Қайта іске қосуға болады: деректер өшірілмейді, бар нысандар қайта құрылмайды.
-- =====================================================================

-- 'teacher' мәні. Ескерту: жаңа enum мәнін осы транзакцияда литерал ретінде
-- қолдануға болмайды, сондықтан төменде role::text = 'teacher' салыстыруы қолданылады.
alter type public.user_role add value if not exists 'teacher';

-- ---------------------------------------------------------------------
-- course_teachers
-- ---------------------------------------------------------------------
create table if not exists public.course_teachers (
  course_id   uuid not null references public.courses (id) on delete cascade,
  teacher_id  uuid not null references public.profiles (id) on delete cascade,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (course_id, teacher_id)
);

create index if not exists course_teachers_teacher_idx on public.course_teachers (teacher_id);

alter table public.course_teachers enable row level security;

drop policy if exists "course_teachers: admin all" on public.course_teachers;
create policy "course_teachers: admin all" on public.course_teachers
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "course_teachers: own rows" on public.course_teachers;
create policy "course_teachers: own rows" on public.course_teachers
  for select using (teacher_id = auth.uid() and public.is_session_authorized());

-- ---------------------------------------------------------------------
-- Рұқсат: әкімші немесе курсқа бекітілген мұғалім (рұқсат етілген сессияда)
-- ---------------------------------------------------------------------
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role::text = 'teacher' and blocked_at is null
  ) and public.is_session_authorized();
$$;

create or replace function public.can_manage_course_videos(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_course_id is not null and (
    public.is_admin()
    or (
      public.is_teacher()
      and exists (
        select 1 from public.course_teachers ct
        where ct.course_id = p_course_id and ct.teacher_id = auth.uid()
      )
    )
  );
$$;

-- ---------------------------------------------------------------------
-- stream_videos
--   lesson_id = variant_id (бұл жобада сабақ = test_variants: нұсқа + видео-талдау)
--   Сабақтың ағымдағы видеосы — test_variants.cloudflare_video_uid (плеер соны оқиды).
--   Жаңа видео тек ready болғанда сабаққа бекітіледі, ескісі содан кейін ғана өшіріледі.
-- ---------------------------------------------------------------------
create table if not exists public.stream_videos (
  id                 uuid primary key default gen_random_uuid(),
  cloudflare_uid     text not null unique check (cloudflare_uid ~ '^[a-f0-9]{32}$'),
  course_id          uuid references public.courses (id) on delete set null,
  variant_id         uuid references public.test_variants (id) on delete set null,
  uploaded_by        uuid references public.profiles (id) on delete set null,
  original_filename  text not null check (char_length(original_filename) between 1 and 255),
  size_bytes         bigint check (size_bytes is null or size_bytes > 0),
  status             text not null default 'waiting'
                     check (status in ('waiting', 'uploading', 'processing', 'ready', 'error')),
  error_message      text check (error_message is null or char_length(error_message) <= 500),
  duration_seconds   integer check (duration_seconds is null or duration_seconds >= 0),
  upload_expires_at  timestamptz,
  replaced_at        timestamptz,  -- сабақтағы орнын жаңа видео алды / видео сабақтан алынды
  deleted_at         timestamptz,  -- Cloudflare-дан өшірілді
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists stream_videos_variant_idx on public.stream_videos (variant_id, created_at desc);
create index if not exists stream_videos_course_idx on public.stream_videos (course_id);
create index if not exists stream_videos_uploader_idx on public.stream_videos (uploaded_by, created_at desc);
create index if not exists stream_videos_pending_cleanup_idx on public.stream_videos (variant_id)
  where replaced_at is not null and deleted_at is null;

drop trigger if exists stream_videos_updated_at on public.stream_videos;
create trigger stream_videos_updated_at
  before update on public.stream_videos
  for each row execute function public.set_updated_at();

alter table public.stream_videos enable row level security;

-- Оқу: тек курсты басқара алатындар. Жазу саясаттары жоқ — жазбаларды тек сервер
-- (service_role) құқық тексерілгеннен кейін өзгертеді; UID әрқашан Cloudflare жауабынан алынады.
drop policy if exists "stream_videos: staff read" on public.stream_videos;
create policy "stream_videos: staff read" on public.stream_videos
  for select using (public.can_manage_course_videos(course_id));

-- ---------------------------------------------------------------------
-- Видео дайын → сабаққа атомарлы бекіту.
-- Қайтарады: old_uid — сабақтағы бұрынғы видео (жаңасы бекітілгеннен кейін ғана өшіруге болады),
--            applied — осы шақыруда сабақ жаңартылды ма.
-- Қайта шақыру қауіпсіз (webhook пен polling бір уақытта келсе де).
-- ---------------------------------------------------------------------
create or replace function public.stream_video_mark_ready(p_uid text, p_duration_seconds integer)
returns table (old_uid text, applied boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.stream_videos;
  cur_uid text;
begin
  select * into v from public.stream_videos where cloudflare_uid = p_uid for update;
  if not found or v.deleted_at is not null or v.status in ('ready', 'error') then
    return;
  end if;

  update public.stream_videos
     set status = 'ready',
         error_message = null,
         duration_seconds = coalesce(p_duration_seconds, duration_seconds)
   where id = v.id;

  if v.variant_id is null then
    return query select null::text, false;
    return;
  end if;

  select t.cloudflare_video_uid into cur_uid from public.test_variants t where t.id = v.variant_id for update;
  if not found then
    return query select null::text, false;
    return;
  end if;

  update public.test_variants
     set video_provider = 'cloudflare',
         cloudflare_video_uid = p_uid,
         video_status = 'ready',
         video_duration_minutes = case
           when coalesce(p_duration_seconds, 0) > 0 then greatest(1, round(p_duration_seconds / 60.0)::int)
           else video_duration_minutes
         end
   where id = v.variant_id;

  if cur_uid is not null and cur_uid <> p_uid then
    update public.stream_videos set replaced_at = now()
     where cloudflare_uid = cur_uid and replaced_at is null;
    return query select cur_uid, true;
  else
    return query select null::text, true;
  end if;
end;
$$;

revoke all on function public.stream_video_mark_ready(text, integer) from public, anon, authenticated;
grant execute on function public.stream_video_mark_ready(text, integer) to service_role;

grant execute on function public.is_teacher() to authenticated, service_role;
grant execute on function public.can_manage_course_videos(uuid) to authenticated, service_role;

comment on table public.stream_videos is 'Админ-панельден Cloudflare Stream-ға жүктелген видеолар. Жазуды тек сервер (service_role) жасайды';
comment on table public.course_teachers is 'Мұғалім (role=teacher) қай курстардың видеосын жүктей/өшіре алады';
