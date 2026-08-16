# 🔧 Ustachi Bot

Mahalladagi ustaxonalar (santexnik/elektrik/maishiy texnika) uchun Telegram bot — mijoz, usta va ega uchun uchta alohida interfeys.

## ⚠️ MUHIM — endpoint manzillari haqida

Backend API'ga (`https://ustachibackend.onrender.com`) tarmoq cheklovi tufayli to'g'ridan-to'g'ri ulanib, haqiqiy endpointlarni tekshirib bo'lmadi. Shuning uchun `src/api.js` va `src/notifyServer.js` fayllaridagi barcha URL manzillari va javob (response) shakllari **taxminiy** — REST/DRF konventsiyasi bo'yicha yozilgan.

**Frontend/backend jamoangizdan aniq endpoint ro'yxati (yoki Swagger linki) kelganda faqat ikkita faylni tuzating:**
- `src/api.js` — har bir funksiya ustida qanday endpoint kutilayotgani izohlangan
- `src/notifyServer.js` — backend yuboradigan bildirishnoma formatini `type`/`payload` orqali moslashtirasiz

Qolgan bot logikasiga (customer.js, staff.js, owner.js, index.js) tegishning hojati yo'q — ular faqat `api.js` orqali gaplashadi.

## Arxitektura

```
ustachi-bot/
├── index.js              # /start, kontakt orqali bog'lash, rol menyusi
├── src/
│   ├── api.js             # Backend bilan YAGONA aloqa nuqtasi
│   ├── localdb.js          # telegramId -> rol (customer/staff/owner) lokal cache
│   ├── customer.js          # /order /status /cancel
│   ├── staff.js              # /today
│   ├── owner.js               # /report /inventory
│   └── notifyServer.js         # POST /notify — backend chaqirib, bildirishnoma yuboradi
```

## Ishlash tartibi

1. **Bog'lash**: foydalanuvchi `/start` bosadi → telefon raqamini ulashadi (contact tugmasi) → bot backend'ga `linkTelegramAccount` chaqiradi → backend rolni (`customer`/`staff`/`owner`) qaytaradi → lokal SQLite'ga saqlanadi
2. **Rol bo'yicha menyu**: har bir rol faqat o'ziga tegishli buyruqlarni ko'radi va ishlata oladi
3. **Bildirishnomalar**: backend order holati o'zgarganda `POST /notify` ga so'rov yuboradi → bot mos foydalanuvchiga Telegram xabari yuboradi

## O'rnatish

```bash
npm install
cp .env.example .env
# BOT_TOKEN, API_BASE_URL, NOTIFY_SECRET qiymatlarini to'ldiring
node index.js
```

Bot ikkita narsani parallel ishga tushiradi:
- Telegram bot (polling rejimida — hackathon uchun eng oson)
- Express server (`NOTIFY_PORT`, default 3000) — backend `/notify` ga so'rov yuborishi uchun

## Yoqimsiz holatlar qanday hal qilingan

- **Backend javob bermasa / xato qaytarsa**: har bir API chaqiruvi `try/catch` ichida, foydalanuvchiga tushunarli xabar chiqadi ("Birozdan so'ng qayta urinib ko'ring"), bot yiqilib qolmaydi
- **Ro'yxatdan o'tmagan foydalanuvchi buyruq yuborsa**: "Avval /start bosing" deb yo'naltiriladi
- **Noto'g'ri rol o'z buyrug'ini ishlatmoqchi bo'lsa** (masalan mijoz `/report` yozsa): rad etiladi
- **Boshqa odam nomidan kontakt ulashsa**: `contact.user_id !== ctx.from.id` tekshiruvi bilan bloklanadi
- **Global xatolik** (`bot.catch`): kutilmagan xatolik bot butunlay to'xtab qolishiga sabab bo'lmaydi

## MVP eng muhim qismi (spetsifikatsiyaga ko'ra)

Agar vaqt tanqis bo'lsa, faqat **`/notify` orqali avtomatik xabar yuborish**ni demo qiling — bu "onlayn navbat" talabini eng ko'zga tashlanadigan tarzda ko'rsatadi.
