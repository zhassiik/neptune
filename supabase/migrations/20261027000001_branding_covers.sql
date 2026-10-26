-- =====================================================================
-- Брендинг: платформа атауы және бастапқы курс мұқабалары
-- Мұқаба файлдары сайттың өзінде: public/covers/<slug>.webp
-- (cover_path '/' белгісінен басталса — сайттың статикалық файлы,
--  әйтпесе — 'course-covers' Storage bucket-тегі файл)
-- =====================================================================

update public.platform_settings
   set platform_name = 'Neptune UBT | Жазира Тұрғымбай'
 where id = 1 and platform_name = 'ҰБТ Нұсқа';

update public.courses
   set cover_path = '/covers/' || slug || '.webp'
 where slug in ('tangy-200', 'matematikalyq-sauattylyq', 'matematika-negizgi')
   and cover_path is null;
