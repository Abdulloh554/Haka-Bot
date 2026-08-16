const express = require('express');

/**
 * Backend (Node/TS) OrderStatusLog yaratilganda yoki ombor chegaradan pastga
 * tushganda, shu endpoint'ga POST so'rov yuboradi — bot esa mos foydalanuvchiga
 * Telegram xabarini yuboradi.
 *
 * So'rov namunasi (backend tomonidan yuboriladi):
 * POST /notify
 * Headers: { "x-notify-secret": "<NOTIFY_SECRET>" }
 * Body:
 * {
 *   "telegramChatId": 123456789,
 *   "type": "order_confirmed" | "order_assigned" | "queue_reminder" |
 *           "status_changed" | "low_stock" | "new_order" | "staff_no_show",
 *   "payload": { ...turga qarab har xil maydonlar }
 * }
 *
 * MUHIM: bu qism ham taxminiy — backend jamoasi bilan aniq shakl kelishilgach
 * faqat shu fayldagi "type" case'larini moslashtirish kifoya.
 */

function buildMessage(type, payload = {}) {
  switch (type) {
    case 'order_confirmed':
      return (
        `✅ Buyurtmangiz qabul qilindi!\n` +
        `Navbat raqamingiz: #${payload.queueNumber ?? '?'}\n` +
        (payload.estimatedTime ? `Taxminiy vaqt: ${payload.estimatedTime}\n` : '') +
        `\nHolatingizni istalgan vaqt /status orqali tekshirishingiz mumkin.`
      );

    case 'order_assigned':
      return (
        `🔧 Sizga yangi vazifa tayinlandi:\n` +
        `Mijoz: ${payload.customerName ?? "noma'lum"}\n` +
        `Xizmat: ${payload.service ?? "noma'lum"}\n` +
        `Vaqt: ${payload.time ?? "belgilanmagan"}\n\n` +
        `Boshlaganingizda tizimda "Boshlandi" deb belgilang.`
      );

    case 'queue_reminder':
      return (
        `⏰ Eslatma: navbatingizga ${payload.minutesLeft ?? 15} daqiqa qoldi.\n` +
        `Navbat raqamingiz: #${payload.queueNumber ?? '?'}`
      );

    case 'status_changed':
      return `ℹ️ Buyurtmangiz holati o'zgardi: *${payload.newStatus ?? "noma'lum"}*`;

    case 'low_stock':
      return `⚠️ Diqqat: ${payload.itemName ?? 'Mahsulot'} omborda tugab qolmoqda (qoldiq: ${payload.quantity ?? '?'} dona)`;

    case 'new_order':
      return (
        `🆕 Yangi buyurtma tushdi!\n` +
        `Mijoz: ${payload.customerName ?? "noma'lum"}\n` +
        `Xizmat: ${payload.service ?? "noma'lum"}`
      );

    case 'staff_no_show':
      return `⚠️ ${payload.staffName ?? 'Usta'} bugungi ishga chiqmadi deb belgilandi.`;

    default:
      return payload.message || 'Yangi bildirishnoma bor.';
  }
}

function startNotifyServer(bot) {
  const app = express();
  app.use(express.json());

  const PORT = process.env.NOTIFY_PORT || 3000;
  const SECRET = process.env.NOTIFY_SECRET;

  app.post('/notify', async (req, res) => {
    if (SECRET && req.headers['x-notify-secret'] !== SECRET) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { telegramChatId, type, payload } = req.body || {};
    if (!telegramChatId || !type) {
      return res.status(400).json({ error: 'telegramChatId va type majburiy' });
    }

    try {
      const text = buildMessage(type, payload);
      await bot.telegram.sendMessage(telegramChatId, text, { parse_mode: 'Markdown' });
      res.json({ ok: true });
    } catch (err) {
      console.error('Xabar yuborishda xatolik:', err.message);
      res.status(500).json({ error: 'xabar yuborilmadi' });
    }
  });

  app.get('/notify/health', (req, res) => res.json({ status: 'ok' }));

  app.listen(PORT, () => {
    console.log(`✅ Notify server ${PORT}-portda ishga tushdi (POST /notify)`);
  });
}

module.exports = { startNotifyServer };
