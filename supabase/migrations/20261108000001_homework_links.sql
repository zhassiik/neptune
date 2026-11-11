-- =====================================================================
-- Черновик және конспект: әр нұсқаға бөлек Classroom сілтемелері
--   test_variants.draft_url — «Черновик» тапсырмасы
--   test_variants.notes_url — «Конспект» тапсырмасы
-- Бос болса, бұрынғы ортақ classroom_url қолданылады.
-- Куратордың белгісі бұрынғыдай homework_checks кестесінде сақталады.
-- Қайта іске қосуға болады; деректер өшірілмейді.
-- =====================================================================

alter table public.test_variants
  add column if not exists draft_url text,
  add column if not exists notes_url text;

alter table public.test_variants
  drop constraint if exists test_variants_draft_url_check,
  add constraint test_variants_draft_url_check check (draft_url is null or (draft_url ~ '^https://' and char_length(draft_url) <= 500));

alter table public.test_variants
  drop constraint if exists test_variants_notes_url_check,
  add constraint test_variants_notes_url_check check (notes_url is null or (notes_url ~ '^https://' and char_length(notes_url) <= 500));

comment on column public.test_variants.draft_url is 'Черновик тапсырмасының Classroom сілтемесі (бос болса — classroom_url)';
comment on column public.test_variants.notes_url is 'Конспект тапсырмасының Classroom сілтемесі (бос болса — classroom_url)';
