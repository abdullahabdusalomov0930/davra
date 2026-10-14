# Moderatorlar uchun qoʻllanma

Davracha moderatorlari va adminlari uchun: qanday qaror qabul qilish, qachon adminga oshirish va jiddiy
kontent bilan nima qilish kerak. Qoidalarning oʻzi saytda: `/qoidalar`. Texnik tafsilotlar:
[SECURITY.md](../SECURITY.md), favqulodda holatlar: [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md).

## Asosiy tamoyillar

1. **Har bir harakatning sababi bor.** Sabab muallifga koʻrsatiladi va jurnalga (`/admin/jurnal`)
   yoziladi. Ichki izoh, haqorat yoki shaxsiy fikr yozmang. Yaxshi sabab qisqa va aniq: nima notoʻgʻri
   va qaysi qoida buzilgan.
2. **Qoidani tanlang.** Kontentni yashirish, rad etish, ogohlantirish va bloklashda tegishli qoidani
   tanlang: foydalanuvchi bildirishnomada shu qoidaga havola oladi.
3. **Avval eng yengil chora.** Birinchi xatoda ogohlantirish yoki kontentni yashirish yetadi. Blok
   takroriy yoki ataylab qilingan qoidabuzarlik uchun.
4. **Kontentni baholang, odamni emas.** Fikr sizga yoqmasa, bu qoidabuzarlik emas. Notoʻgʻri, lekin
   halol fikr — izohda javob berish uchun sabab, yashirish uchun emas.
5. **Shubha boʻlsa, adminga qoldiring.** Qaror qila olmasangiz, shikoyatni ochiq qoldiring va adminga
   yozing.
6. **Shikoyat qilinayotgan havolalarni ochmang**, ayniqsa „Jiddiy xavf“ shikoyatlarida. Domen va
   manzil yetarli. Ochish kerak boʻlsa, faqat „Firibgarlik“ yoki „Qaroqchilik“ holatlarida va himoyalangan
   brauzerda oching.
7. **Oʻz kontentingiz yoki tanishlaringiz haqida qaror qilmang.** Boshqa moderator yoki adminga
   qoldiring.

## Navbatlar

| Sahifa                    | Nima bor                                                            | Kim                    |
| ------------------------- | ------------------------------------------------------------------- | ---------------------- |
| `/admin/resurslar`        | Tekshiruvdagi kartalar (yangi aʼzolar, ushlab qolingan matnlar)     | moderator, admin       |
| `/admin/izohlar`          | Tekshiruvdagi izohlar (havolali yoki shubhali)                      | moderator, admin       |
| `/admin/shikoyatlar`      | Shikoyatlar, kontent boʻyicha guruhlangan; olib tashlash soʻrovlari | moderator, admin       |
| `/admin/havolalar`        | Ishlamayotgan yoki shubhali havolalar                               | moderator, admin       |
| `/admin/foydalanuvchilar` | Ogohlantirish, bloklash, rol va ishonch darajasi                    | moderator, admin       |
| `/admin/etirozlar`        | Foydalanuvchilarning qarorlarga eʼtirozlari                         | moderator, admin       |
| `/admin/sorovlar`         | Moderatorlarning muddatsiz blok va oʻchirish soʻrovlari             | faqat admin hal qiladi |
| `/admin/jiddiy`           | Jiddiy holatlar va saqlangan dalillar                               | faqat admin            |
| `/admin/domenlar`         | Bloklangan domenlar                                                 | faqat admin            |
| `/admin/sozlamalar`       | Bloklangan soʻzlar, avtomatik yashirish chegaralari, oraliq sahifa  | faqat admin            |
| `/admin/xavfsizlik`       | Shubhali kirish urinishlari va koʻp hisob ochgan manzillar          | faqat admin            |
| `/admin/jurnal`           | Barcha moderatsiya harakatlari va sabablari                         | moderator, admin       |

Tartib: avval **Jiddiy**, keyin **Avtomatik yashirilgan**, keyin **Shoshilinch**, keyin **Oddiy**
shikoyatlar; soʻng tekshiruvdagi kartalar va izohlar. Navbatni har kuni koʻring.

## Tekshiruvdagi kartalar va izohlar

Yangi aʼzolarning (0-daraja) kartalari, havolali izohlari va filtr ushlab qolgan matnlar shu yerga
tushadi. Har birining yonida ushlab qolinish sababi turadi.

- **Tasdiqlash**: havola oʻquv materialiga olib boradi, sarlavha va tavsif unga mos, qoidalarni
  buzmaydi. Filtr notoʻgʻri ushlagan boʻlsa ham (masalan, „foiz stavkasi“), tasdiqlang.
- **Rad etish**: reklama, spam, mavzuga aloqasi yoʻq, qaroqchilik, firibgarlik. Sababda nimani
  oʻzgartirish kerakligini yozing.
- **Yashirish**: eʼlon qilingan kontent keyinroq muammoli boʻlib chiqsa.

Misollar:

| Holat                                                    | Qaror                                           |
| -------------------------------------------------------- | ----------------------------------------------- |
| Rasmiy kursga havola, tavsif toʻgʻri                     | Tasdiqlash                                      |
| Pullik kurs, lekin „Bepul“ deb belgilangan               | Rad etish, sabab: „Narx notoʻgʻri koʻrsatilgan“ |
| Kitobning ruxsatsiz PDF nusxasi (fayl almashish saytida) | Rad etish, qoida: Qaroqchilik                   |
| Telegram kanalga havola, ichida faqat reklama            | Rad etish, qoida: Spam va reklama               |
| Bir xil karta har kuni qayta joylanmoqda                 | Rad etish, takrorlansa ogohlantirish            |
| Izohda telefon raqami („menga yozing“)                   | Yashirish, qoida: Shaxsiy maʼlumotlar           |
| Tavsifda tanqid: „bu kurs eskirgan“                      | Tasdiqlash: bu fikr, qoidabuzarlik emas         |

## Shikoyatlar

Shikoyatlar bitta kontent boʻyicha guruhlanadi va har birining **vazni** bor (ishonchli foydalanuvchi
shikoyati koʻproq hisoblanadi). Vazn chegaraga yetsa (odatda 3; noqonuniy kontent yoki firibgarlikda 2),
kontent avtomatik yashiriladi va navbatda „Avtomatik yashirilgan“ deb turadi.

Uchta qaror bor:

- **Kontentni yashirish**: shikoyat toʻgʻri. Kontent yashiriladi, shikoyatlar tasdiqlanadi, muallifning
  ishonch darajasi pasayadi, muallif bildirishnoma oladi.
- **Hal qilindi**: muammo boshqa yoʻl bilan hal boʻlgan (muallif tuzatgan, karta allaqachon yashirilgan).
- **Rad etish**: qoidabuzarlik yoʻq. Avtomatik yashirilgan kontent qayta eʼlon qilinadi. Koʻp rad
  etilgan shikoyatlar shikoyatchining keyingi shikoyatlari vaznini kamaytiradi.

Foydalanuvchi haqidagi shikoyatda uni bloklash yoki ogohlantirish uchun
`/admin/foydalanuvchilar` sahifasini oching.

Olib tashlash soʻrovlari (`/removal-request`, mualliflik huquqi egalaridan): soʻrov asosli boʻlsa,
kartani yashiring va soʻrovni „Bajarildi“ deb belgilang. Shubhali boʻlsa, adminga qoldiring.

## Ogohlantirish va bloklash

| Holat                                                   | Chora                                       |
| ------------------------------------------------------- | ------------------------------------------- |
| Birinchi kichik qoidabuzarlik (spam, mavzudan tashqari) | Kontentni yashirish yoki ogohlantirish      |
| Ogohlantirishdan keyin takrorlash                       | 1 yoki 7 kunlik blok                        |
| Haqorat, taʼqib, nafrat                                 | Kontentni yashirish + 7 yoki 30 kunlik blok |
| Firibgarlik, fishing, ataylab xavfli havola             | 30 kunlik blok va muddatsiz blok soʻrovi    |
| Faqat spam uchun ochilgan hisob                         | Muddatsiz blok soʻrovi                      |
| Jiddiy xavf (pastda)                                    | Darhol adminga; admin muddatsiz bloklaydi   |

- Blok vaqtida foydalanuvchining eʼlon qilingan kontenti yashiriladi; u saytni koʻradi, lekin yoza,
  yoqtira va shikoyat qila olmaydi. Muddat tugagach, blok oʻzi olinadi va kontent qaytadi.
- **Muddatsiz blok va oʻchirish** — admin vakolati. Moderator bosganda soʻrov `/admin/sorovlar`ga
  tushadi va admin tasdiqlaydi yoki rad etadi.
- Ishonch darajasini qoʻlda oʻzgartirish va rol berish faqat admin ishi.

## Eʼtirozlar

Foydalanuvchi har bir qarorga bitta eʼtiroz yubora oladi. Eʼtirozni iloji boricha **boshqa** moderator
koʻrsin, asl qarorni qilgan kishi emas.

- **Qabul qilish**: qaror xato edi. Kontent qayta eʼlon qilinadi yoki blok olib tashlanadi. Sababda
  qisqa uzr yoki tushuntirish yozing.
- **Rad etish**: qaror toʻgʻri. Sababda nima uchun ekanini aniq yozing.

## Jiddiy kontent

„Jiddiy xavf“ — bolalar xavfsizligiga tahdid (bolalarni jinsiy ekspluatatsiya qilish materiallari),
terrorizm va ekstremizm, aniq zoʻravonlik tahdidlari.

Bunday shikoyatda tizim kontentni **birinchi shikoyatdayoq** yashiradi va uning nusxasini dalil
sifatida `/admin/jiddiy`ga saqlaydi.

**Moderator:**

1. Havolani **ochmang**, kontentni yuklab olmang, skrinshot qilmang, hech kimga yubormang.
2. Shikoyatni rad etmang (buni faqat admin qila oladi).
3. Darhol adminga xabar bering.

**Admin:** [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) dagi „Jiddiy kontent“ tartibiga amal qiling.
Qisqacha: dalil saqlanganini tekshiring → „Dalillar saqlandi“ → muallifni muddatsiz bloklang →
huquqiy xabar berish majburiyatlari boʻyicha advokat bilan maslahatlashing → shundan keyingina oʻchiring.

Bunday kontent ogʻir taʼsir qilishi mumkin. Koʻrganingizdan keyin tanaffus qiling; kerak boʻlsa,
ishonchli odam bilan gaplashing.

## Nima qilmaslik kerak

- Boshqa foydalanuvchilarga shikoyatchi kimligini aytmang.
- Foydalanuvchilarning shaxsiy maʼlumotlarini (e-pochta, IP xeshlari) sayt tashqarisiga chiqarmang.
- Bir hisobdan boshqasiga oʻtib kontent yaratmang yoki ovoz bermang.
- Admin hisobi parolini hech kim bilan boʻlishmang; GitHub, Supabase va Vercel hisoblarida ikki
  bosqichli tekshiruvni yoqing.

> **TODO (egasi):** moderatorlar roʻyxati, javob berish muddati (masalan, 24 soat ichida) va adminga
> bogʻlanish yoʻli (Telegram guruh yoki e-pochta) shu yerga yozilsin.
