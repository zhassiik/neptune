-- =====================================================================
-- ҚАЙТА БАСТАУ: migration құрған барлық объектілерді өшіреді.
-- Migration жартылай орындалып қалса немесе таза бастау керек болса қолданыңыз.
--
-- ⚠️ НАЗАР АУДАРЫҢЫЗ: нұсқалар, сұрақтар, оқушылардың нәтижелері және
-- профильдер өшіріледі. Auth пайдаланушылары (auth.users) мен Storage-тағы
-- файлдар сақталады.
--
-- Кейін: supabase/migrations ішіндегі файлдарды ретімен қайта іске қосыңыз.
-- =====================================================================

drop trigger if exists on_auth_user_created on auth.users;

drop policy if exists "question-images: admin оқиды" on storage.objects;
drop policy if exists "question-images: admin жүктейді" on storage.objects;
drop policy if exists "question-images: admin өзгертеді" on storage.objects;
drop policy if exists "question-images: admin өшіреді" on storage.objects;
drop policy if exists "course-covers: admin оқиды" on storage.objects;
drop policy if exists "course-covers: admin жүктейді" on storage.objects;
drop policy if exists "course-covers: admin өзгертеді" on storage.objects;
drop policy if exists "course-covers: admin өшіреді" on storage.objects;

drop table if exists
  public.attempt_scores,
  public.student_answers,
  public.test_attempts,
  public.matching_items,
  public.matching_options,
  public.answer_options,
  public.questions,
  public.course_enrollments,
  public.test_variants,
  public.courses,
  public.platform_settings,
  public.profiles
cascade;

drop function if exists public.has_course_access cascade;
drop function if exists public.finalize_attempt cascade;
drop function if exists public.save_question cascade;
drop function if exists public.move_question_to_position cascade;
drop function if exists public.swap_question_positions cascade;
drop function if exists public.owns_attempt cascade;
drop function if exists public.can_write_answer cascade;
drop function if exists public.guard_profile_role cascade;
drop function if exists public.handle_new_user cascade;
drop function if exists public.is_admin cascade;
drop function if exists public.set_updated_at cascade;

drop type if exists public.answer_result cascade;
drop type if exists public.attempt_status cascade;
drop type if exists public.question_type cascade;
drop type if exists public.variant_status cascade;
drop type if exists public.user_role cascade;
