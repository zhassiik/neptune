-- =====================================================================
-- «Апта үздігі»: апталық конкурс, нұсқаның уақыт аралығы,
-- черновик/конспект тексерісі және рейтинг.
-- 20261030000001_landing.sql-дан кейін. Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- contest_weeks: апталар (мысалы, «1-апта»)
-- ---------------------------------------------------------------------
create table if not exists public.contest_weeks (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references public.courses (id) on delete cascade,
  title         text not null check (char_length(title) between 2 and 80),
  position      integer not null default 1 check (position between 1 and 1000),
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists contest_weeks_course_idx on public.contest_weeks (course_id, position desc);

drop trigger if exists contest_weeks_updated_at on public.contest_weeks;
create trigger contest_weeks_updated_at
  before update on public.contest_weeks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- test_variants: аптаға тиесілілік, конкурс уақыты, үй жұмысы
-- ---------------------------------------------------------------------
alter table public.test_variants
  add column if not exists week_id uuid references public.contest_weeks (id) on delete set null,
  add column if not exists contest_starts_at timestamptz,
  add column if not exists contest_ends_at timestamptz,
  add column if not exists classroom_url text,
  add column if not exists homework_deadline timestamptz;

alter table public.test_variants
  drop constraint if exists test_variants_contest_window_check,
  add constraint test_variants_contest_window_check check (
    (contest_starts_at is null and contest_ends_at is null)
    or (contest_starts_at is not null and contest_ends_at is not null and contest_ends_at > contest_starts_at)
  );

alter table public.test_variants
  drop constraint if exists test_variants_classroom_url_check,
  add constraint test_variants_classroom_url_check check (classroom_url is null or (classroom_url ~ '^https://' and char_length(classroom_url) <= 500));

create index if not exists test_variants_week_idx on public.test_variants (week_id);

-- ---------------------------------------------------------------------
-- homework_checks: куратордың черновик/конспект белгісі
--   on_time — уақытында (толық ұпай), late — кешікті (жартысы), missing — салмады (0)
-- ---------------------------------------------------------------------
create table if not exists public.homework_checks (
  variant_id    uuid not null references public.test_variants (id) on delete cascade,
  student_id    uuid not null references public.profiles (id) on delete cascade,
  draft_status  text check (draft_status in ('on_time', 'late', 'missing')),
  notes_status  text check (notes_status in ('on_time', 'late', 'missing')),
  checked_by    uuid references public.profiles (id) on delete set null,
  updated_at    timestamptz not null default now(),
  primary key (variant_id, student_id)
);

create index if not exists homework_checks_student_idx on public.homework_checks (student_id);

drop trigger if exists homework_checks_updated_at on public.homework_checks;
create trigger homework_checks_updated_at
  before update on public.homework_checks
  for each row execute function public.set_updated_at();

-- Ұпай: черновик 5, конспект 10; кешіксе — жартысы
create or replace function public.homework_points(p_status text, p_full numeric)
returns numeric
language sql
immutable
as $$
  select case p_status when 'on_time' then p_full when 'late' then p_full / 2 else 0 end;
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.contest_weeks enable row level security;
alter table public.homework_checks enable row level security;

drop policy if exists "weeks: жарияланғандарды көреді" on public.contest_weeks;
create policy "weeks: жарияланғандарды көреді"
  on public.contest_weeks for select to anon, authenticated
  using (is_published or public.is_admin());

drop policy if exists "weeks: admin басқарады" on public.contest_weeks;
create policy "weeks: admin басқарады"
  on public.contest_weeks for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "homework: өз бағасын немесе admin барлығын көреді" on public.homework_checks;
create policy "homework: өз бағасын немесе admin барлығын көреді"
  on public.homework_checks for select to authenticated
  using ((student_id = auth.uid() and public.is_session_authorized()) or public.is_admin());

drop policy if exists "homework: admin белгілейді" on public.homework_checks;
create policy "homework: admin белгілейді"
  on public.homework_checks for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.contest_weeks to anon;
grant select, insert, update, delete on public.contest_weeks, public.homework_checks to authenticated;
grant all on public.contest_weeks, public.homework_checks to service_role;

/**
 * Апта рейтингі.
 * Тест балы: әр нұсқаның конкурс аралығында басталып, аралық ішінде (+2 мин) тапсырылған БІРІНШІ талпынысы.
 * Үй жұмысы: черновик (5) + конспект (10), кешіксе жартысы.
 * Оқушы: топ-N + өз орны (басқалардың ID-і берілмейді). Әкімші: p_limit = null → толық тізім + ID.
 */
create or replace function public.week_leaderboard(p_week uuid, p_limit integer default 5)
returns table (
  rank integer,
  student_id uuid,
  full_name text,
  test_points integer,
  homework_points numeric,
  total numeric,
  contest_tests integer,
  is_me boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with allowed as (
    select 1
    where auth.uid() is not null
      and exists (select 1 from public.contest_weeks w where w.id = p_week and (w.is_published or public.is_admin()))
      and (public.is_session_authorized() or public.is_admin())
  ),
  wv as (
    select v.id, v.contest_starts_at, v.contest_ends_at
    from public.test_variants v
    where v.week_id = p_week and v.status = 'published' and exists (select 1 from allowed)
  ),
  att as (
    select distinct on (a.student_id, a.variant_id) a.student_id, a.variant_id, a.total_score
    from public.test_attempts a
    join wv on wv.id = a.variant_id
    where a.status = 'submitted'
      and wv.contest_starts_at is not null
      and a.started_at >= wv.contest_starts_at
      and a.submitted_at <= wv.contest_ends_at + interval '2 minutes'
    order by a.student_id, a.variant_id, a.submitted_at
  ),
  tp as (
    select att.student_id, sum(coalesce(att.total_score, 0))::int as pts, count(*)::int as n
    from att group by att.student_id
  ),
  hp as (
    select h.student_id, sum(public.homework_points(h.draft_status, 5) + public.homework_points(h.notes_status, 10)) as pts
    from public.homework_checks h
    join wv on wv.id = h.variant_id
    group by h.student_id
  ),
  totals as (
    select coalesce(tp.student_id, hp.student_id) as sid,
           coalesce(tp.pts, 0) as test_pts,
           coalesce(hp.pts, 0) as hw_pts,
           coalesce(tp.n, 0) as n
    from tp full join hp on hp.student_id = tp.student_id
  ),
  ranked as (
    select t.*, p.full_name as name,
           rank() over (order by t.test_pts + t.hw_pts desc)::int as r
    from totals t
    join public.profiles p on p.id = t.sid
    where p.role = 'student' and t.test_pts + t.hw_pts > 0
  )
  select r,
         case when public.is_admin() then sid end,
         coalesce(nullif(name, ''), 'Оқушы'),
         test_pts,
         hw_pts,
         test_pts + hw_pts,
         n,
         sid = auth.uid()
  from ranked
  where (p_limit is null and public.is_admin()) or r <= coalesce(p_limit, 5) or sid = auth.uid()
  order by r, name;
$$;

grant execute on function public.homework_points(text, numeric) to anon, authenticated, service_role;
grant execute on function public.week_leaderboard(uuid, integer) to authenticated, service_role;
