-- =====================================================================
-- «Neptune курсының түлектерінің нәтижелері» — басты беттегі блок
--   Әр түлек: фото + аты + ҰБТ балы + пікір мәтіні + сертификат суреті.
--   Әкімші басқарады; жарияланғандарын барлығы көреді.
--   Суреттер ашық «site-media» bucket-інде (graduates/…), жазу тек әкімшіге (20261030 migration-дағы саясаттар).
-- Қайта іске қосуға болады; деректер өшірілмейді.
-- =====================================================================

create table if not exists public.graduates (
  id                uuid primary key default gen_random_uuid(),
  student_name      text not null check (char_length(student_name) between 2 and 80),
  score             integer check (score between 0 and 140),
  score_label       text check (char_length(score_label) <= 40),
  text              text not null check (char_length(text) between 10 and 4000),
  photo_path        text check (photo_path ~ '^graduates/[A-Za-z0-9_-]+\.(webp|jpg|png)$'),
  certificate_path  text check (certificate_path ~ '^graduates/[A-Za-z0-9_-]+\.(webp|jpg|png)$'),
  position          integer not null default 1 check (position between 1 and 1000),
  is_published      boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists graduates_published_idx on public.graduates (is_published, position);

drop trigger if exists graduates_updated_at on public.graduates;
create trigger graduates_updated_at
  before update on public.graduates
  for each row execute function public.set_updated_at();

alter table public.graduates enable row level security;

drop policy if exists "graduates: жарияланғандарды барлығы көреді" on public.graduates;
create policy "graduates: жарияланғандарды барлығы көреді"
  on public.graduates for select to anon, authenticated
  using (is_published or public.is_admin());

drop policy if exists "graduates: admin басқарады" on public.graduates;
create policy "graduates: admin басқарады"
  on public.graduates for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.graduates to anon;
grant select, insert, update, delete on public.graduates to authenticated;
grant all on public.graduates to service_role;

comment on table public.graduates is 'Басты беттегі «Neptune курсының түлектерінің нәтижелері»: фото, балл, пікір, сертификат';
