-- =====================================================================
-- Лендинг: апай туралы блок, көрсеткіштер, ҰБТ кері санағы,
-- әлеуметтік желілер және оқушылардың пікірлері.
-- 20261029000001_device_control.sql-дан кейін. Idempotent.
-- =====================================================================

alter table public.platform_settings
  add column if not exists teacher_name text not null default 'Жазира Тұрғымбай',
  add column if not exists teacher_bio text not null default E'Abai university\n14 жылдық тәжірибесі бар математик\nҰБТ эксперті\nNeptune.ubt негізін қалаушы\nҰстаздар мен оқушылар курсының авторы',
  add column if not exists landing_stats jsonb not null default '[{"value":"78+","label":"оқушы 2026 ҰБТ-да 40+ балл жинады"},{"value":"14","label":"жылдық тәжірибе"},{"value":"200+","label":"авторлық нұсқа"}]'::jsonb,
  add column if not exists exam_countdown_title text not null default '3 қаңтар ҰБТ-ға дейін қалды:',
  add column if not exists exam_date timestamptz default '2027-01-03 09:00:00+05',
  add column if not exists instagram_url text default 'https://www.instagram.com/zhazira_turgumbay/',
  add column if not exists telegram_url text,
  add column if not exists whatsapp_phone text,
  -- «Курсқа қосылу» батырмасының сілтемесі (мысалы, WhatsApp: https://wa.me/77471401404)
  add column if not exists join_url text;

alter table public.platform_settings
  drop constraint if exists platform_settings_landing_check,
  add constraint platform_settings_landing_check check (
    char_length(teacher_name) <= 80
    and char_length(teacher_bio) <= 1000
    and jsonb_typeof(landing_stats) = 'array'
    and jsonb_array_length(landing_stats) <= 4
    and char_length(exam_countdown_title) <= 120
    and (instagram_url is null or instagram_url ~ '^https://(www\.)?instagram\.com/')
    and (telegram_url is null or telegram_url ~ '^https://t\.me/')
    and (whatsapp_phone is null or whatsapp_phone ~ '^\+?[0-9 ()-]{7,20}$')
    and (join_url is null or (join_url ~ '^https://' and char_length(join_url) <= 500))
  );

-- ---------------------------------------------------------------------
-- testimonials: оқушылардың пікірлері (әкімші басқарады, лендингте көрінеді)
-- ---------------------------------------------------------------------
create table if not exists public.testimonials (
  id            uuid primary key default gen_random_uuid(),
  student_name  text not null check (char_length(student_name) between 2 and 80),
  score         integer check (score between 0 and 140),
  score_label   text check (char_length(score_label) <= 40),
  text          text not null check (char_length(text) between 10 and 3000),
  photo_path    text check (char_length(photo_path) <= 300),
  video_url     text check (char_length(video_url) <= 500),
  position      integer not null default 1 check (position between 1 and 1000),
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists testimonials_published_idx on public.testimonials (is_published, position);

drop trigger if exists testimonials_updated_at on public.testimonials;
create trigger testimonials_updated_at
  before update on public.testimonials
  for each row execute function public.set_updated_at();

alter table public.testimonials enable row level security;

drop policy if exists "testimonials: жарияланғандарды барлығы көреді" on public.testimonials;
create policy "testimonials: жарияланғандарды барлығы көреді"
  on public.testimonials for select to anon, authenticated
  using (is_published or public.is_admin());

drop policy if exists "testimonials: admin басқарады" on public.testimonials;
create policy "testimonials: admin басқарады"
  on public.testimonials for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.testimonials to anon;
grant select, insert, update, delete on public.testimonials to authenticated;
grant all on public.testimonials to service_role;

-- Пікір суреттері: ашық bucket (лендингте көрсетіледі), жазу тек әкімшіге
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "site-media: admin оқиды" on storage.objects;
create policy "site-media: admin оқиды"
  on storage.objects for select to authenticated
  using (bucket_id = 'site-media' and public.is_admin());

drop policy if exists "site-media: admin жүктейді" on storage.objects;
create policy "site-media: admin жүктейді"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'site-media' and public.is_admin());

drop policy if exists "site-media: admin өзгертеді" on storage.objects;
create policy "site-media: admin өзгертеді"
  on storage.objects for update to authenticated
  using (bucket_id = 'site-media' and public.is_admin())
  with check (bucket_id = 'site-media' and public.is_admin());

drop policy if exists "site-media: admin өшіреді" on storage.objects;
create policy "site-media: admin өшіреді"
  on storage.objects for delete to authenticated
  using (bucket_id = 'site-media' and public.is_admin());
