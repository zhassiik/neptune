-- =====================================================================
-- Cloudflare Stream видео-талдаулары және курсқа рұқсат
-- 20261027000001_branding_covers.sql-дан кейін іске қосылады.
-- Қазіргі YouTube/Vimeo/Kinescope/.mp4 сілтемелері (video_url) өзгеріссіз жұмыс істейді.
-- =====================================================================

-- ---------------------------------------------------------------------
-- test_variants: видео провайдері және Cloudflare Stream идентификаторы
-- ---------------------------------------------------------------------
alter table public.test_variants
  add column if not exists video_provider text not null default 'url',
  add column if not exists cloudflare_video_uid text,
  add column if not exists video_status text;

alter table public.test_variants
  drop constraint if exists test_variants_video_provider_check,
  add constraint test_variants_video_provider_check check (video_provider in ('url', 'cloudflare'));

alter table public.test_variants
  drop constraint if exists test_variants_cloudflare_video_uid_check,
  add constraint test_variants_cloudflare_video_uid_check check (cloudflare_video_uid is null or cloudflare_video_uid ~ '^[a-f0-9]{32}$');

alter table public.test_variants
  drop constraint if exists test_variants_cloudflare_uid_required,
  add constraint test_variants_cloudflare_uid_required check (video_provider <> 'cloudflare' or cloudflare_video_uid is not null);

alter table public.test_variants
  drop constraint if exists test_variants_video_status_check,
  add constraint test_variants_video_status_check check (video_status is null or char_length(video_status) <= 40);

comment on column public.test_variants.video_provider is 'url — video_url (YouTube/Vimeo/Kinescope/.mp4); cloudflare — қорғалған Cloudflare Stream';
comment on column public.test_variants.cloudflare_video_uid is 'Cloudflare Stream Video UID (32 hex). Тек requireSignedURLs=true видеолар: UID-дің өзі signed token-сіз ойнатылмайды';
comment on column public.test_variants.video_status is 'Cloudflare-дағы соңғы белгілі күйі: ready, inprogress, queued, error...';

-- ---------------------------------------------------------------------
-- courses.access_mode: open — барлық тіркелген оқушыларға; enrolled — тек рұқсат берілгендерге
-- ---------------------------------------------------------------------
alter table public.courses
  add column if not exists access_mode text not null default 'open';

alter table public.courses
  drop constraint if exists courses_access_mode_check,
  add constraint courses_access_mode_check check (access_mode in ('open', 'enrolled'));

-- ---------------------------------------------------------------------
-- course_enrollments: оқушыға курсқа берілген рұқсат
-- ---------------------------------------------------------------------
create table if not exists public.course_enrollments (
  course_id   uuid not null references public.courses (id) on delete cascade,
  student_id  uuid not null references public.profiles (id) on delete cascade,
  granted_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (course_id, student_id)
);

create index if not exists course_enrollments_student_idx on public.course_enrollments (student_id);

alter table public.course_enrollments enable row level security;

drop policy if exists "enrollments: өз рұқсатын немесе admin барлығын көреді" on public.course_enrollments;
create policy "enrollments: өз рұқсатын немесе admin барлығын көреді"
  on public.course_enrollments for select to authenticated
  using (student_id = auth.uid() or public.is_admin());

drop policy if exists "enrollments: admin береді" on public.course_enrollments;
create policy "enrollments: admin береді"
  on public.course_enrollments for insert to authenticated
  with check (public.is_admin());

drop policy if exists "enrollments: admin алып тастайды" on public.course_enrollments;
create policy "enrollments: admin алып тастайды"
  on public.course_enrollments for delete to authenticated
  using (public.is_admin());

grant select, insert, delete on public.course_enrollments to authenticated;
grant all on public.course_enrollments to service_role;

-- Ағымдағы пайдаланушының курсқа рұқсаты бар ма (сервер және болашақ RLS үшін)
create or replace function public.has_course_access(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.courses c
      where c.id = p_course_id
        and c.status = 'published'
        and auth.uid() is not null
        and (
          c.access_mode = 'open'
          or exists (
            select 1 from public.course_enrollments e
            where e.course_id = c.id and e.student_id = auth.uid()
          )
        )
    );
$$;

grant execute on function public.has_course_access(uuid) to authenticated;
