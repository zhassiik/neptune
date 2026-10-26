-- =====================================================================
-- Курстар, видео-талдау және «тек скрин + дұрыс әріп» режимі
-- 20261025000001_init.sql-дан кейін іске қосылады.
-- =====================================================================

-- ---------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------
create table public.courses (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title        text not null check (char_length(title) between 3 and 150),
  description  text check (char_length(description) <= 2000),
  cover_path   text,
  price        integer check (price between 0 and 100000000),
  status       text not null default 'draft' check (status in ('draft', 'coming_soon', 'published')),
  position     integer not null default 1 check (position between 1 and 1000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index courses_status_position_idx on public.courses (status, position);

create trigger courses_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

alter table public.courses enable row level security;

create policy "courses: жарияланған/жақында ашылатындарды барлығы көреді"
  on public.courses for select to anon, authenticated
  using (status <> 'draft' or public.is_admin());

create policy "courses: admin қосады"
  on public.courses for insert to authenticated
  with check (public.is_admin());

create policy "courses: admin өзгертеді"
  on public.courses for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "courses: admin өшіреді"
  on public.courses for delete to authenticated
  using (public.is_admin());

grant select on public.courses to anon;
grant select, insert, update, delete on public.courses to authenticated;
grant all on public.courses to service_role;

-- Бастапқы үш курс (мұқабасын, бағасын, сипаттамасын админ-панельден өзгертуге болады)
insert into public.courses (slug, title, description, price, status, position) values
  ('matematikalyq-sauattylyq', 'МАТЕМАТИКАЛЫҚ САУАТТЫЛЫҚ ТАҢҒЫ 100 НҰСҚА ТАЛДАУ',
   'Математикалық сауаттылық бойынша авторлық 100 нұсқа және әрқайсысының видео-талдауы.', 60000, 'coming_soon', 1),
  ('tangy-200', 'ТАҢҒЫ 200 НҰСҚА ТАЛДАУ',
   'Математика бойынша 200 авторлық нұсқа: нұсқаны орындап, нәтижеңізді бірден біліңіз және видео-талдауын қараңыз.', 200000, 'published', 2),
  ('matematika-negizgi', 'МАТЕМАТИКА ҰБТ | НЕГІЗГІ КУРС',
   'ҰБТ математикасының негізгі тақырыптары бойынша толық курс.', 150000, 'coming_soon', 3)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- test_variants: курсқа байлау, реттік нөмір, видео-талдау
-- ---------------------------------------------------------------------

-- Биология demo нұсқасын алып тастау (платформа — математика)
delete from public.test_variants where title = 'Биология | Нұсқа №1' and subject = 'Биология';

alter table public.test_variants
  add column course_id uuid references public.courses (id) on delete restrict,
  add column position integer not null default 1 check (position between 1 and 1000),
  add column video_url text check (char_length(video_url) <= 500),
  add column video_duration_minutes integer check (video_duration_minutes between 1 and 600);

update public.test_variants
   set course_id = (select id from public.courses where slug = 'tangy-200')
 where course_id is null;

alter table public.test_variants alter column course_id set not null;
alter table public.test_variants alter column subject set default 'Математика';
alter table public.test_variants drop column course_slug;

create index test_variants_course_idx on public.test_variants (course_id, status, position);

-- ---------------------------------------------------------------------
-- Жауап мәтіндері міндетті емес: мұғалім тек скрин жүктеп,
-- дұрыс әріпті (A, B, C...) белгілей алады.
-- ---------------------------------------------------------------------
alter table public.answer_options drop constraint if exists answer_options_text_check;
alter table public.answer_options alter column text set default '';
alter table public.answer_options add constraint answer_options_text_check check (char_length(text) <= 1000);

alter table public.matching_options drop constraint if exists matching_options_text_check;
alter table public.matching_options alter column text set default '';
alter table public.matching_options add constraint matching_options_text_check check (char_length(text) <= 500);

alter table public.matching_items drop constraint if exists matching_items_text_check;
alter table public.matching_items alter column text set default '';
alter table public.matching_items add constraint matching_items_text_check check (char_length(text) <= 500);

-- ---------------------------------------------------------------------
-- Storage: курс мұқабалары (ашық bucket — маркетингтік суреттер)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-covers', 'course-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "course-covers: admin оқиды"
  on storage.objects for select to authenticated
  using (bucket_id = 'course-covers' and public.is_admin());

create policy "course-covers: admin жүктейді"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'course-covers' and public.is_admin());

create policy "course-covers: admin өзгертеді"
  on storage.objects for update to authenticated
  using (bucket_id = 'course-covers' and public.is_admin())
  with check (bucket_id = 'course-covers' and public.is_admin());

create policy "course-covers: admin өшіреді"
  on storage.objects for delete to authenticated
  using (bucket_id = 'course-covers' and public.is_admin());
