-- =====================================================================
-- Оқушы профилі: өз телефоны және ата-анасының телефоны
--   * сайт нөмірді «+77001234567» түрінде сақтайды
--   * тіркелу кезінде метадеректен (phone, parent_phone) алынады
--   * бұрын тіркелгендер келесі кіргенде профиль бетінде толтырады
--   * оқушы өз профилін өзгерте алады (бұрынғы «өз профилін өзгерту» саясаты);
--     әкімші мен куратор (өз оқушыларын) көреді — бұрынғы select саясаттары
-- Қайта іске қосуға болады; деректер өшірілмейді.
-- =====================================================================

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists parent_phone text;

alter table public.profiles drop constraint if exists profiles_phone_format;
alter table public.profiles add constraint profiles_phone_format
  check (phone is null or phone ~ '^\+[0-9]{11,15}$');

alter table public.profiles drop constraint if exists profiles_parent_phone_format;
alter table public.profiles add constraint profiles_parent_phone_format
  check (parent_phone is null or parent_phone ~ '^\+[0-9]{11,15}$');

-- Тіркелу: аты-жөні мен телефондарды метадеректен алу (дұрыс емес нөмір — null)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := nullif(new.raw_user_meta_data ->> 'phone', '');
  v_parent text := nullif(new.raw_user_meta_data ->> 'parent_phone', '');
begin
  if v_phone is not null and v_phone !~ '^\+[0-9]{11,15}$' then
    v_phone := null;
  end if;
  if v_parent is not null and v_parent !~ '^\+[0-9]{11,15}$' then
    v_parent := null;
  end if;

  insert into public.profiles (id, full_name, email, role, phone, parent_phone)
  values (
    new.id,
    coalesce(left(new.raw_user_meta_data ->> 'full_name', 120), ''),
    new.email,
    'student',
    v_phone,
    v_parent
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on column public.profiles.phone is 'Оқушының телефоны, +77001234567';
comment on column public.profiles.parent_phone is 'Ата-анасының телефоны, +77001234567';
