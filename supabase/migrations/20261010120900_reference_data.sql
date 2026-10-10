-- Reference data every environment needs, production included: the starting topics and the
-- URL shorteners that are blocked as resource links. Admins manage both afterwards.
-- `on conflict do nothing` keeps admin edits if this ever runs against an existing database.

insert into public.topics (slug, name_uz, description_uz, sort_order) values
  ('dasturlash', 'Dasturlash',
    'Dasturlash tillari, algoritmlar, veb va mobil ilovalar yaratish.', 10),
  ('matematika', 'Matematika',
    'Algebra, geometriya, matematik analiz, ehtimollar nazariyasi va olimpiada masalalari.', 20),
  ('ingliz-tili', 'Ingliz tili',
    'Grammatika, soʻz boyligi, tinglab tushunish va soʻzlashuv amaliyoti.', 30),
  ('xitoy-tili', 'Xitoy tili',
    'Ierogliflar, talaffuz va HSK imtihoniga tayyorgarlik.', 40),
  ('ielts', 'IELTS',
    'Listening, Reading, Writing va Speaking boʻlimlariga tayyorgarlik.', 50),
  ('iqtisodiyot-va-moliya', 'Iqtisodiyot va moliya',
    'Iqtisodiyot asoslari, shaxsiy moliya, buxgalteriya va investitsiyalar.', 60),
  ('dizayn', 'Dizayn',
    'Grafik dizayn, UI/UX, tipografiya va dizayn vositalari.', 70),
  ('malumotlar-tahlili', 'Maʼlumotlar tahlili',
    'Statistika, Excel, SQL, Python va maʼlumotlarni vizuallashtirish.', 80),
  ('tadbirkorlik', 'Tadbirkorlik',
    'Biznes gʻoyalar, startaplar, marketing va sotuv.', 90),
  ('ilmiy-ish-yozish', 'Ilmiy ish yozish',
    'Ilmiy maqola, kurs ishi va dissertatsiya yozish, manbalar bilan ishlash.', 100),
  ('soft-skills', 'Soft skills',
    'Muloqot, vaqtni boshqarish, jamoada ishlash va taqdimot qilish.', 110),
  ('karyera-va-stajirovka', 'Karyera va stajirovka',
    'Rezyume, ish suhbatiga tayyorgarlik, stajirovka va grant dasturlari.', 120)
on conflict (slug) do nothing;

-- Shorteners hide the real destination, so they are never accepted as resource links.
-- youtu.be and t.me are not here: they are canonical links to real content.
insert into public.blocked_domains (domain, reason)
select domain, 'Havola qisqartiruvchi servis'
from unnest(array[
  'bit.ly', 'bitly.com', 'bit.do', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly', 'buff.ly', 'is.gd', 'v.gd',
  'cutt.ly', 'rb.gy', 'shorturl.at', 't.ly', 'tiny.cc', 'rebrand.ly', 'bl.ink', 's.id', 'clck.ru', 'vk.cc',
  'u.to', 'adf.ly', 'shorte.st', 'ouo.io', 'lnkd.in'
]) as domain
on conflict (domain) do nothing;
