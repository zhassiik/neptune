-- =====================================================================
-- ҰБТ дайындық платформасы: бастапқы схема
-- Кестелер, индекстер, триггерлер, RLS саясаттары және Storage
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Типтер
-- ---------------------------------------------------------------------
create type public.user_role as enum ('student', 'admin');
create type public.variant_status as enum ('draft', 'published');
create type public.question_type as enum ('single', 'matching', 'multiple');
create type public.attempt_status as enum ('in_progress', 'submitted');
create type public.answer_result as enum ('correct', 'partial', 'incorrect', 'unanswered');

-- ---------------------------------------------------------------------
-- Жалпы көмекші функция: updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  email       text,
  role        public.user_role not null default 'student',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Рөлді тексеру (RLS ішінде рекурсияны болдырмау үшін SECURITY DEFINER)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Жаңа пайдаланушы тіркелгенде профиль автоматты түрде құрылады.
-- Рөл әрқашан 'student' — admin рөлін тек SQL немесе басқа admin бере алады.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(left(new.raw_user_meta_data ->> 'full_name', 120), ''),
    new.email,
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Migration-ға дейін тіркелген пайдаланушыларға да профиль құру
insert into public.profiles (id, full_name, email, role)
select id, coalesce(left(raw_user_meta_data ->> 'full_name', 120), ''), email, 'student'
from auth.users
on conflict (id) do nothing;

-- Оқушы өз рөлін өзгерте алмауы керек
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() бос болса — бұл SQL editor немесе service_role (сенімді орта)
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Рөлді өзгертуге рұқсат жоқ' using errcode = '42501';
  end if;
  -- email тек auth арқылы өзгереді
  if new.email is distinct from old.email and auth.uid() is not null and not public.is_admin() then
    new.email := old.email;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ---------------------------------------------------------------------
-- platform_settings (бір жолдық кесте: футер, байланыс ақпараты)
-- ---------------------------------------------------------------------
create table public.platform_settings (
  id             smallint primary key default 1 check (id = 1),
  platform_name  text not null default 'ҰБТ Нұсқа' check (char_length(platform_name) between 2 and 80),
  contact_email  text default 'info@ubt-nusqa.kz',
  contact_phone  text default '+7 (700) 000-00-00',
  contact_address text default 'Қазақстан',
  updated_at     timestamptz not null default now()
);

insert into public.platform_settings (id) values (1) on conflict do nothing;

create trigger platform_settings_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- test_variants
-- ---------------------------------------------------------------------
create table public.test_variants (
  id                    uuid primary key default gen_random_uuid(),
  course_slug           text not null default 'variant-analysis',
  title                 text not null check (char_length(title) between 3 and 150),
  subject               text not null check (char_length(subject) between 2 and 80),
  description           text check (char_length(description) <= 1000),
  status                public.variant_status not null default 'draft',
  time_limit_minutes    integer check (time_limit_minutes between 1 and 600),
  show_correct_answers  boolean not null default true,
  created_by            uuid references public.profiles (id) on delete set null,
  published_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index test_variants_status_idx on public.test_variants (course_slug, status);

create trigger test_variants_updated_at
  before update on public.test_variants
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- questions (әр нұсқада дәл 40 позиция; тип позициямен анықталады)
-- ---------------------------------------------------------------------
create table public.questions (
  id           uuid primary key default gen_random_uuid(),
  variant_id   uuid not null references public.test_variants (id) on delete cascade,
  position     integer not null check (position between 1 and 40),
  type         public.question_type not null,
  prompt       text check (char_length(prompt) <= 4000),
  image_path   text,
  explanation  text check (char_length(explanation) <= 4000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint questions_variant_position_key unique (variant_id, position) deferrable initially immediate,
  constraint questions_type_matches_position check (
    (position between 1 and 30 and type = 'single')
    or (position between 31 and 35 and type = 'matching')
    or (position between 36 and 40 and type = 'multiple')
  )
);

create index questions_variant_idx on public.questions (variant_id, position);

create trigger questions_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- answer_options (single және multiple сұрақтар үшін)
-- ---------------------------------------------------------------------
create table public.answer_options (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.questions (id) on delete cascade,
  position     integer not null check (position between 1 and 10),
  text         text not null check (char_length(text) between 1 and 1000),
  is_correct   boolean not null default false
);

create index answer_options_question_idx on public.answer_options (question_id, position);

-- ---------------------------------------------------------------------
-- matching_options (сәйкестендірудің ортақ жауап нұсқалары)
-- ---------------------------------------------------------------------
create table public.matching_options (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.questions (id) on delete cascade,
  position     integer not null check (position between 1 and 10),
  text         text not null check (char_length(text) between 1 and 500)
);

create index matching_options_question_idx on public.matching_options (question_id, position);

-- ---------------------------------------------------------------------
-- matching_items (A және B элементтері + дұрыс сәйкестік)
-- ---------------------------------------------------------------------
create table public.matching_items (
  id                 uuid primary key default gen_random_uuid(),
  question_id        uuid not null references public.questions (id) on delete cascade,
  label              text not null check (label in ('A', 'B')),
  text               text not null check (char_length(text) between 1 and 500),
  correct_option_id  uuid references public.matching_options (id) on delete set null,
  constraint matching_items_question_label_key unique (question_id, label)
);

-- ---------------------------------------------------------------------
-- test_attempts
-- ---------------------------------------------------------------------
create table public.test_attempts (
  id                uuid primary key default gen_random_uuid(),
  variant_id        uuid not null references public.test_variants (id) on delete cascade,
  student_id        uuid not null references public.profiles (id) on delete cascade,
  status            public.attempt_status not null default 'in_progress',
  started_at        timestamptz not null default now(),
  deadline_at       timestamptz,
  submitted_at      timestamptz,
  total_score       integer check (total_score between 0 and 50),
  max_score         integer not null default 50,
  correct_count     integer,
  partial_count     integer,
  incorrect_count   integer,
  unanswered_count  integer,
  created_at        timestamptz not null default now()
);

create index test_attempts_student_idx on public.test_attempts (student_id, created_at desc);
create index test_attempts_variant_idx on public.test_attempts (variant_id, submitted_at desc);
create index test_attempts_submitted_idx on public.test_attempts (status, submitted_at desc);
-- Бір оқушының бір нұсқа бойынша тек бір белсенді талпынысы болады
create unique index test_attempts_one_active_idx
  on public.test_attempts (student_id, variant_id)
  where status = 'in_progress';

-- ---------------------------------------------------------------------
-- student_answers
-- ---------------------------------------------------------------------
create table public.student_answers (
  id                   uuid primary key default gen_random_uuid(),
  attempt_id           uuid not null references public.test_attempts (id) on delete cascade,
  question_id          uuid not null references public.questions (id) on delete cascade,
  selected_option_ids  uuid[] not null default '{}' check (cardinality(selected_option_ids) <= 6),
  matching_answers     jsonb not null default '{}'::jsonb check (jsonb_typeof(matching_answers) = 'object'),
  updated_at           timestamptz not null default now(),
  constraint student_answers_attempt_question_key unique (attempt_id, question_id)
);

create trigger student_answers_updated_at
  before update on public.student_answers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- attempt_scores (әр сұрақ бойынша есептелген балл)
-- ---------------------------------------------------------------------
create table public.attempt_scores (
  id           uuid primary key default gen_random_uuid(),
  attempt_id   uuid not null references public.test_attempts (id) on delete cascade,
  question_id  uuid not null references public.questions (id) on delete cascade,
  position     integer not null check (position between 1 and 40),
  points       integer not null check (points between 0 and 2),
  max_points   integer not null check (max_points between 1 and 2),
  result       public.answer_result not null,
  constraint attempt_scores_attempt_question_key unique (attempt_id, question_id)
);

create index attempt_scores_attempt_idx on public.attempt_scores (attempt_id, position);

-- =====================================================================
-- Көмекші функциялар
-- =====================================================================

-- Оқушы жауапты сақтай ала ма? (RLS ішінде қолданылады)
create or replace function public.can_write_answer(p_attempt_id uuid, p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
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

create or replace function public.owns_attempt(p_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.test_attempts
    where id = p_attempt_id and student_id = auth.uid()
  );
$$;

-- Екі сұрақтың орнын ауыстыру (тек бір бөлім ішінде)
create or replace function public.swap_question_positions(p_first uuid, p_second uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  q1 public.questions%rowtype;
  q2 public.questions%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Рұқсат жоқ' using errcode = '42501';
  end if;

  select * into q1 from public.questions where id = p_first for update;
  select * into q2 from public.questions where id = p_second for update;

  if q1.id is null or q2.id is null then
    raise exception 'Сұрақ табылмады';
  end if;
  if q1.variant_id <> q2.variant_id or q1.type <> q2.type then
    raise exception 'Сұрақтарды тек бір бөлім ішінде ауыстыруға болады';
  end if;

  set constraints public.questions_variant_position_key deferred;
  update public.questions set position = q2.position where id = q1.id;
  update public.questions set position = q1.position where id = q2.id;
end;
$$;

-- Бос позицияға сұрақты жылжыту
create or replace function public.move_question_to_position(p_question uuid, p_position integer)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  q public.questions%rowtype;
  other_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Рұқсат жоқ' using errcode = '42501';
  end if;

  select * into q from public.questions where id = p_question for update;
  if q.id is null then
    raise exception 'Сұрақ табылмады';
  end if;

  select id into other_id from public.questions
  where variant_id = q.variant_id and position = p_position;

  if other_id is not null then
    perform public.swap_question_positions(q.id, other_id);
  else
    -- Тип позицияға сәйкес болуы керек (CHECK constraint тексереді)
    update public.questions set position = p_position where id = q.id;
  end if;
end;
$$;

-- Сұрақты жауап нұсқаларымен бірге атомарлы түрде сақтау.
-- p_payload:
-- {
--   "prompt": text, "image_path": text, "explanation": text,
--   "options": [{"id": uuid|null, "text": text, "is_correct": bool}],
--   "matching_options": [{"id": uuid|null, "key": text, "text": text}],
--   "matching_items": [{"label": "A"|"B", "text": text, "correct_key": text}]
-- }
create or replace function public.save_question(
  p_variant_id uuid,
  p_position integer,
  p_payload jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_type public.question_type;
  v_question_id uuid;
  v_opt jsonb;
  v_idx integer;
  v_keep uuid[] := '{}';
  v_opt_id uuid;
  v_key_map jsonb := '{}'::jsonb;
  v_item jsonb;
begin
  if not public.is_admin() then
    raise exception 'Рұқсат жоқ' using errcode = '42501';
  end if;

  v_type := case
    when p_position between 1 and 30 then 'single'
    when p_position between 31 and 35 then 'matching'
    when p_position between 36 and 40 then 'multiple'
  end;
  if v_type is null then
    raise exception 'Сұрақ нөмірі 1–40 аралығында болуы керек';
  end if;

  -- ON CONFLICT deferrable constraint-пен жұмыс істемейді, сондықтан қолмен тексереміз
  select id into v_question_id
    from public.questions
   where variant_id = p_variant_id and position = p_position
   for update;

  if v_question_id is null then
    insert into public.questions (variant_id, position, type, prompt, image_path, explanation)
    values (
      p_variant_id,
      p_position,
      v_type,
      nullif(btrim(p_payload ->> 'prompt'), ''),
      nullif(p_payload ->> 'image_path', ''),
      nullif(btrim(p_payload ->> 'explanation'), '')
    )
    returning id into v_question_id;
  else
    update public.questions
       set prompt = nullif(btrim(p_payload ->> 'prompt'), ''),
           image_path = nullif(p_payload ->> 'image_path', ''),
           explanation = nullif(btrim(p_payload ->> 'explanation'), '')
     where id = v_question_id;
  end if;

  if v_type in ('single', 'multiple') then
    -- Сақталатын нұсқалар (ID өзгермейді — белсенді талпыныстар бұзылмайды)
    select coalesce(array_agg((o ->> 'id')::uuid), '{}')
      into v_keep
      from jsonb_array_elements(coalesce(p_payload -> 'options', '[]'::jsonb)) o
      where nullif(o ->> 'id', '') is not null;

    delete from public.answer_options
      where question_id = v_question_id and not (id = any (v_keep));

    v_idx := 0;
    for v_opt in select * from jsonb_array_elements(coalesce(p_payload -> 'options', '[]'::jsonb)) loop
      v_idx := v_idx + 1;
      if nullif(v_opt ->> 'id', '') is not null then
        update public.answer_options
          set position = v_idx,
              text = btrim(v_opt ->> 'text'),
              is_correct = coalesce((v_opt ->> 'is_correct')::boolean, false)
          where id = (v_opt ->> 'id')::uuid and question_id = v_question_id;
      else
        insert into public.answer_options (question_id, position, text, is_correct)
        values (v_question_id, v_idx, btrim(v_opt ->> 'text'),
                coalesce((v_opt ->> 'is_correct')::boolean, false));
      end if;
    end loop;

    delete from public.matching_items where question_id = v_question_id;
    delete from public.matching_options where question_id = v_question_id;
  else
    select coalesce(array_agg((o ->> 'id')::uuid), '{}')
      into v_keep
      from jsonb_array_elements(coalesce(p_payload -> 'matching_options', '[]'::jsonb)) o
      where nullif(o ->> 'id', '') is not null;

    delete from public.matching_options
      where question_id = v_question_id and not (id = any (v_keep));

    v_idx := 0;
    for v_opt in select * from jsonb_array_elements(coalesce(p_payload -> 'matching_options', '[]'::jsonb)) loop
      v_idx := v_idx + 1;
      if nullif(v_opt ->> 'id', '') is not null then
        update public.matching_options
          set position = v_idx, text = btrim(v_opt ->> 'text')
          where id = (v_opt ->> 'id')::uuid and question_id = v_question_id
          returning id into v_opt_id;
      else
        insert into public.matching_options (question_id, position, text)
        values (v_question_id, v_idx, btrim(v_opt ->> 'text'))
        returning id into v_opt_id;
      end if;
      v_key_map := v_key_map || jsonb_build_object(v_opt ->> 'key', v_opt_id);
    end loop;

    for v_item in select * from jsonb_array_elements(coalesce(p_payload -> 'matching_items', '[]'::jsonb)) loop
      insert into public.matching_items (question_id, label, text, correct_option_id)
      values (
        v_question_id,
        v_item ->> 'label',
        btrim(v_item ->> 'text'),
        (v_key_map ->> (v_item ->> 'correct_key'))::uuid
      )
      on conflict (question_id, label) do update
        set text = excluded.text, correct_option_id = excluded.correct_option_id;
    end loop;

    delete from public.answer_options where question_id = v_question_id;
  end if;

  update public.test_variants set updated_at = now() where id = p_variant_id;
  return v_question_id;
end;
$$;

-- Тестті аяқтау: балл серверде (Next.js, service_role) есептеледі,
-- бұл функция нәтижені атомарлы түрде жазады.
create or replace function public.finalize_attempt(
  p_attempt_id uuid,
  p_scores jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.test_attempts
     set status = 'submitted',
         submitted_at = now(),
         total_score = (select coalesce(sum((s ->> 'points')::int), 0) from jsonb_array_elements(p_scores) s),
         correct_count = (select count(*) from jsonb_array_elements(p_scores) s where s ->> 'result' = 'correct'),
         partial_count = (select count(*) from jsonb_array_elements(p_scores) s where s ->> 'result' = 'partial'),
         incorrect_count = (select count(*) from jsonb_array_elements(p_scores) s where s ->> 'result' = 'incorrect'),
         unanswered_count = (select count(*) from jsonb_array_elements(p_scores) s where s ->> 'result' = 'unanswered')
   where id = p_attempt_id and status = 'in_progress';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return false;
  end if;

  insert into public.attempt_scores (attempt_id, question_id, position, points, max_points, result)
  select p_attempt_id,
         (s ->> 'question_id')::uuid,
         (s ->> 'position')::int,
         (s ->> 'points')::int,
         (s ->> 'max_points')::int,
         (s ->> 'result')::public.answer_result
  from jsonb_array_elements(p_scores) s;

  return true;
end;
$$;

revoke all on function public.finalize_attempt(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_attempt(uuid, jsonb) to service_role;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles          enable row level security;
alter table public.platform_settings enable row level security;
alter table public.test_variants     enable row level security;
alter table public.questions         enable row level security;
alter table public.answer_options    enable row level security;
alter table public.matching_options  enable row level security;
alter table public.matching_items    enable row level security;
alter table public.test_attempts     enable row level security;
alter table public.student_answers   enable row level security;
alter table public.attempt_scores    enable row level security;

-- profiles ------------------------------------------------------------
create policy "profiles: өз профилін немесе admin барлығын көреді"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles: өз профилін өзгерту"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles: admin өзгертеді"
  on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- platform_settings ---------------------------------------------------
create policy "settings: барлығы оқиды"
  on public.platform_settings for select to anon, authenticated
  using (true);

create policy "settings: admin өзгертеді"
  on public.platform_settings for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- test_variants -------------------------------------------------------
create policy "variants: жарияланғандарды барлығы көреді"
  on public.test_variants for select to anon, authenticated
  using (status = 'published' or public.is_admin());

create policy "variants: admin қосады"
  on public.test_variants for insert to authenticated
  with check (public.is_admin());

create policy "variants: admin өзгертеді"
  on public.test_variants for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "variants: admin өшіреді"
  on public.test_variants for delete to authenticated
  using (public.is_admin());

-- Сұрақтар мен жауап кілттері: тікелей қолжетімділік ТЕК admin-ге.
-- Оқушыға сұрақтар сервер арқылы (дұрыс жауаптарсыз) беріледі.
create policy "questions: admin толық қолжетімділік"
  on public.questions for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "answer_options: admin толық қолжетімділік"
  on public.answer_options for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "matching_options: admin толық қолжетімділік"
  on public.matching_options for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "matching_items: admin толық қолжетімділік"
  on public.matching_items for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- test_attempts -------------------------------------------------------
-- Талпыныс құру және аяқтау тек сервер арқылы (service_role) жасалады.
create policy "attempts: өз талпыныстарын немесе admin барлығын көреді"
  on public.test_attempts for select to authenticated
  using (student_id = auth.uid() or public.is_admin());

create policy "attempts: admin өшіреді"
  on public.test_attempts for delete to authenticated
  using (public.is_admin());

-- student_answers -----------------------------------------------------
create policy "answers: өз жауаптарын немесе admin көреді"
  on public.student_answers for select to authenticated
  using (public.owns_attempt(attempt_id) or public.is_admin());

create policy "answers: белсенді талпынысқа жауап қосу"
  on public.student_answers for insert to authenticated
  with check (public.can_write_answer(attempt_id, question_id));

create policy "answers: белсенді талпыныстағы жауапты өзгерту"
  on public.student_answers for update to authenticated
  using (public.can_write_answer(attempt_id, question_id))
  with check (public.can_write_answer(attempt_id, question_id));

-- attempt_scores ------------------------------------------------------
create policy "scores: өз нәтижесін немесе admin көреді"
  on public.attempt_scores for select to authenticated
  using (public.owns_attempt(attempt_id) or public.is_admin());

-- =====================================================================
-- Storage: сұрақ суреттері (жабық bucket)
-- Оқушыларға суреттер сервер жасаған уақытша signed URL арқылы беріледі.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'question-images',
  'question-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "question-images: admin оқиды"
  on storage.objects for select to authenticated
  using (bucket_id = 'question-images' and public.is_admin());

create policy "question-images: admin жүктейді"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'question-images' and public.is_admin());

create policy "question-images: admin өзгертеді"
  on storage.objects for update to authenticated
  using (bucket_id = 'question-images' and public.is_admin())
  with check (bucket_id = 'question-images' and public.is_admin());

create policy "question-images: admin өшіреді"
  on storage.objects for delete to authenticated
  using (bucket_id = 'question-images' and public.is_admin());

-- =====================================================================
-- Рұқсаттар (RLS-пен бірге жұмыс істейді)
-- =====================================================================
grant usage on schema public to anon, authenticated, service_role;
grant select on public.test_variants, public.platform_settings to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.swap_question_positions(uuid, uuid) to authenticated;
grant execute on function public.move_question_to_position(uuid, integer) to authenticated;
grant execute on function public.save_question(uuid, integer, jsonb) to authenticated;
