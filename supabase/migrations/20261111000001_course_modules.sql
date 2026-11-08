-- =====================================================================
-- Курс құрылымы: кіріспе видео + ғаламшар-блоктар + сабақтар (видео / еркін тест)
--   course_modules  — блоктар (атауы, ғаламшары, реті)
--   module_lessons  — сабақтар: intro (курсқа кіріспе), video, test
--   test_variants.kind — 'ubt' (40 сұрақ, 50 балл — бұрынғыдай) немесе 'practice' (еркін санды тест)
-- ҰБТ нұсқаларының ережелері өзгермейді: 1–30 single, 31–35 matching, 36–40 multiple.
-- Видео жүктеу (stream_videos) сабақтарға да кеңейтіледі.
-- Қайта іске қосуға болады; деректер өшірілмейді. 20261110000001_graduates.sql-дан кейін.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Нұсқа түрі
-- ---------------------------------------------------------------------
alter table public.test_variants
  add column if not exists kind text not null default 'ubt';

alter table public.test_variants
  drop constraint if exists test_variants_kind_check,
  add constraint test_variants_kind_check check (kind in ('ubt', 'practice'));

create index if not exists test_variants_kind_idx on public.test_variants (course_id, kind, status);

-- ---------------------------------------------------------------------
-- Сұрақтар: позиция 1–200; ҰБТ-дағы тип/позиция ережесі триггерде
-- (CHECK басқа кестеге — нұсқа түріне — қарай алмайды)
-- ---------------------------------------------------------------------
alter table public.questions drop constraint if exists questions_type_matches_position;
alter table public.questions drop constraint if exists questions_position_check;
alter table public.questions
  drop constraint if exists questions_position_range,
  add constraint questions_position_range check (position between 1 and 200);

create or replace function public.questions_validate_layout()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_kind text;
begin
  select kind into v_kind from public.test_variants where id = new.variant_id;
  if coalesce(v_kind, 'ubt') = 'ubt' then
    if new.position not between 1 and 40 then
      raise exception 'ҰБТ нұсқасында сұрақ нөмірі 1–40 аралығында болуы керек' using errcode = '23514';
    end if;
    if not (
      (new.position between 1 and 30 and new.type = 'single')
      or (new.position between 31 and 35 and new.type = 'matching')
      or (new.position between 36 and 40 and new.type = 'multiple')
    ) then
      raise exception 'ҰБТ нұсқасында сұрақ түрі нөміріне сәйкес емес' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists questions_validate_layout on public.questions;
create trigger questions_validate_layout
  before insert or update of position, type, variant_id on public.questions
  for each row execute function public.questions_validate_layout();

alter table public.attempt_scores drop constraint if exists attempt_scores_position_check;
alter table public.attempt_scores
  drop constraint if exists attempt_scores_position_range,
  add constraint attempt_scores_position_range check (position between 1 and 200);

alter table public.test_attempts drop constraint if exists test_attempts_total_score_check;
alter table public.test_attempts
  drop constraint if exists test_attempts_total_score_range,
  add constraint test_attempts_total_score_range check (total_score between 0 and 1000);

-- Сұрақты сақтау: ҰБТ — тип нөмірден; practice — тип payload-тан ("type")
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
  v_kind text;
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

  select kind into v_kind from public.test_variants where id = p_variant_id;
  if v_kind is null then
    raise exception 'Нұсқа табылмады';
  end if;

  if v_kind = 'ubt' then
    v_type := case
      when p_position between 1 and 30 then 'single'
      when p_position between 31 and 35 then 'matching'
      when p_position between 36 and 40 then 'multiple'
    end;
    if v_type is null then
      raise exception 'Сұрақ нөмірі 1–40 аралығында болуы керек';
    end if;
  else
    if p_position not between 1 and 200 then
      raise exception 'Сұрақ нөмірі 1–200 аралығында болуы керек';
    end if;
    if coalesce(p_payload ->> 'type', '') not in ('single', 'matching', 'multiple') then
      raise exception 'Сұрақ түрін таңдаңыз';
    end if;
    v_type := (p_payload ->> 'type')::public.question_type;
  end if;

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
       set type = v_type,
           prompt = nullif(btrim(p_payload ->> 'prompt'), ''),
           image_path = nullif(p_payload ->> 'image_path', ''),
           explanation = nullif(btrim(p_payload ->> 'explanation'), '')
     where id = v_question_id;
  end if;

  if v_type in ('single', 'multiple') then
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

-- Ауыстыру: ҰБТ-да тек бір бөлім ішінде; practice-те — кез келген сұрақпен
create or replace function public.swap_question_positions(p_first uuid, p_second uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  q1 public.questions%rowtype;
  q2 public.questions%rowtype;
  v_kind text;
begin
  if not public.is_admin() then
    raise exception 'Рұқсат жоқ' using errcode = '42501';
  end if;

  select * into q1 from public.questions where id = p_first for update;
  select * into q2 from public.questions where id = p_second for update;

  if q1.id is null or q2.id is null then
    raise exception 'Сұрақ табылмады';
  end if;
  select kind into v_kind from public.test_variants where id = q1.variant_id;
  if q1.variant_id <> q2.variant_id or (coalesce(v_kind, 'ubt') = 'ubt' and q1.type <> q2.type) then
    raise exception 'Сұрақтарды тек бір бөлім ішінде ауыстыруға болады';
  end if;

  set constraints public.questions_variant_position_key deferred;
  update public.questions set position = q2.position where id = q1.id;
  update public.questions set position = q1.position where id = q2.id;
end;
$$;

-- ---------------------------------------------------------------------
-- Блоктар
-- ---------------------------------------------------------------------
create table if not exists public.course_modules (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  planet       text not null default 'mercury'
               check (planet in ('mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'moon', 'sun')),
  position     integer not null default 1 check (position between 1 and 1000),
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists course_modules_course_idx on public.course_modules (course_id, position);

drop trigger if exists course_modules_updated_at on public.course_modules;
create trigger course_modules_updated_at
  before update on public.course_modules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Сабақтар: intro (курсқа кіріспе, блоксыз), video, test (practice нұсқа)
-- ---------------------------------------------------------------------
create table if not exists public.module_lessons (
  id                    uuid primary key default gen_random_uuid(),
  course_id             uuid not null references public.courses (id) on delete cascade,
  module_id             uuid references public.course_modules (id) on delete cascade,
  kind                  text not null check (kind in ('intro', 'video', 'test')),
  title                 text not null check (char_length(title) between 1 and 150),
  position              integer not null default 1 check (position between 1 and 1000),
  video_provider        text not null default 'url' check (video_provider in ('url', 'cloudflare')),
  video_url             text check (char_length(video_url) <= 500),
  cloudflare_video_uid  text check (cloudflare_video_uid is null or cloudflare_video_uid ~ '^[a-f0-9]{32}$'),
  video_status          text check (video_status is null or char_length(video_status) <= 40),
  duration_minutes      integer check (duration_minutes between 1 and 600),
  variant_id            uuid unique references public.test_variants (id) on delete cascade,
  is_published          boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint module_lessons_intro_has_no_module check ((kind = 'intro') = (module_id is null)),
  constraint module_lessons_test_has_variant check (kind <> 'test' or variant_id is not null),
  constraint module_lessons_cloudflare_uid check (video_provider <> 'cloudflare' or cloudflare_video_uid is not null)
);

create index if not exists module_lessons_module_idx on public.module_lessons (module_id, position);
create index if not exists module_lessons_course_idx on public.module_lessons (course_id);
create unique index if not exists module_lessons_one_intro_idx on public.module_lessons (course_id) where kind = 'intro';

drop trigger if exists module_lessons_updated_at on public.module_lessons;
create trigger module_lessons_updated_at
  before update on public.module_lessons
  for each row execute function public.set_updated_at();

-- RLS: құрылымды (атаулар, ғаламшарлар) ашық курстарда барлығы көреді;
-- видеоның өзі signed token арқылы, тест — курсқа рұқсат бойынша (сервер тексереді). Жазу — тек әкімші.
alter table public.course_modules enable row level security;
alter table public.module_lessons enable row level security;

drop policy if exists "modules: көрінетін курстарда оқу" on public.course_modules;
create policy "modules: көрінетін курстарда оқу" on public.course_modules
  for select to anon, authenticated
  using (
    public.is_admin()
    or (is_published and exists (select 1 from public.courses c where c.id = course_id and c.status in ('coming_soon', 'published')))
  );

drop policy if exists "modules: admin басқарады" on public.course_modules;
create policy "modules: admin басқарады" on public.course_modules
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "lessons: көрінетін курстарда оқу" on public.module_lessons;
create policy "lessons: көрінетін курстарда оқу" on public.module_lessons
  for select to anon, authenticated
  using (
    public.is_admin()
    or (
      is_published
      and exists (select 1 from public.courses c where c.id = course_id and c.status in ('coming_soon', 'published'))
      and (module_id is null or exists (select 1 from public.course_modules m where m.id = module_id and m.is_published))
    )
  );

drop policy if exists "lessons: admin басқарады" on public.module_lessons;
create policy "lessons: admin басқарады" on public.module_lessons
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.course_modules, public.module_lessons to anon;
grant select, insert, update, delete on public.course_modules, public.module_lessons to authenticated;
grant all on public.course_modules, public.module_lessons to service_role;

-- ---------------------------------------------------------------------
-- Видео жүктеу: сабаққа да (stream_videos.lesson_id)
-- ---------------------------------------------------------------------
alter table public.stream_videos
  add column if not exists lesson_id uuid references public.module_lessons (id) on delete set null;

create index if not exists stream_videos_lesson_idx on public.stream_videos (lesson_id, created_at desc);

create or replace function public.stream_video_mark_ready(p_uid text, p_duration_seconds integer)
returns table (old_uid text, applied boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.stream_videos;
  cur_uid text;
  v_minutes integer := case when coalesce(p_duration_seconds, 0) > 0 then greatest(1, round(p_duration_seconds / 60.0)::int) end;
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

  if v.lesson_id is not null then
    select l.cloudflare_video_uid into cur_uid from public.module_lessons l where l.id = v.lesson_id for update;
    if not found then
      return query select null::text, false;
      return;
    end if;
    update public.module_lessons
       set video_provider = 'cloudflare',
           cloudflare_video_uid = p_uid,
           video_status = 'ready',
           duration_minutes = coalesce(v_minutes, duration_minutes)
     where id = v.lesson_id;
  elsif v.variant_id is not null then
    select t.cloudflare_video_uid into cur_uid from public.test_variants t where t.id = v.variant_id for update;
    if not found then
      return query select null::text, false;
      return;
    end if;
    update public.test_variants
       set video_provider = 'cloudflare',
           cloudflare_video_uid = p_uid,
           video_status = 'ready',
           video_duration_minutes = coalesce(v_minutes, video_duration_minutes)
     where id = v.variant_id;
  else
    return query select null::text, false;
    return;
  end if;

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

comment on table public.course_modules is 'Курс блоктары (ғаламшарлар): атауы, ғаламшары, реті';
comment on table public.module_lessons is 'Курс сабақтары: intro — курсқа кіріспе видео, video — видео сабақ, test — еркін тест (practice нұсқа)';
comment on column public.test_variants.kind is 'ubt — 40 сұрақтық ҰБТ нұсқасы; practice — блоктағы еркін тест';
