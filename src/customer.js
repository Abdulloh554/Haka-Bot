const { Markup } = require('telegraf');
const api = require('./api');
const {
  getLinkedUser,
  getPendingClarification,
  setPendingClarification,
  clearPendingClarification,
} = require('./localdb');

const STATUS_LABELS = {
  queued: '⏳ Navbatda',
  assigned: '👷 Xodimga biriktirilgan',
  in_progress: '🔧 Bajarilmoqda',
  completed: '✅ Bajarildi',
  cancelled: '❌ Bekor qilingan',
  no_show: '🚫 Kelmadi',
};

function requireLinked(ctx) {
  const user = getLinkedUser(ctx.from.id);
  if (!user) {
    ctx.reply(
      "Avval ro'yxatdan o'tishingiz kerak. /start buyrug'ini bosing va telefon raqamingizni ulashing."
    );
    return null;
  }
  return user;
}

function customerMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🛠️ Buyurtma berish', 'menu_order')],
    [Markup.button.callback('✍️ Muammoni yozish', 'menu_describe')],
    [Markup.button.callback('📋 Holatni ko\'rish', 'menu_status')],
    [Markup.button.callback('❌ Buyurtmani bekor qilish', 'menu_cancel')],
  ]);
}

async function handleOrderCommand(ctx) {
  const user = requireLinked(ctx);
  if (!user) return;

  let services = [];
  try {
    const res = await api.getServices();
    services = res.services || [];
  } catch (err) {
    console.error('getServices xatolik:', err.message);
  }

  if (services.length === 0) {
    await ctx.reply("Hozircha xizmatlar qo'shilmagan. Iltimos, ustaxona bilan bog'laning.");
    return;
  }

  const keyboard = Markup.inlineKeyboard(
    services.map((s) => [
      Markup.button.callback(`${s.name} — ${Number(s.price).toLocaleString('ru-RU')} so'm`, `order_svc_${s.id}`),
    ])
  );
  await ctx.reply('Qaysi xizmat kerak? 👇', keyboard);
}

async function handleServiceSelection(ctx) {
  const serviceId = ctx.match[1];
  await ctx.answerCbQuery();

  try {
    const result = await api.createOrder({
      telegram_chat_id: ctx.from.id,
      service_id: serviceId,
    });

    await ctx.editMessageText(
      `✅ Buyurtmangiz qabul qilindi!\n\n` +
        `🛠️ Xizmat: ${result.service_type}\n` +
        `🔢 Navbat raqamingiz: #${result.queue_number}\n` +
        `📌 Holat: ${STATUS_LABELS[result.status] || result.status}\n` +
        `\nHolatingizni quyidagi tugma orqali kuzatib boring 👇`,
      customerMenuKeyboard()
    );
  } catch (err) {
    console.error('createOrder xatolik:', err.message);
    await ctx.reply(
      "⚠️ Buyurtma yaratishda muammo yuz berdi. Birozdan so'ng qayta urinib ko'ring yoki ustaxonaga qo'ng'iroq qiling."
    );
  }
}

async function handleStatusCommand(ctx) {
  const user = requireLinked(ctx);
  if (!user) return;

  try {
    const order = await api.getActiveOrder({ telegram_chat_id: ctx.from.id });
    if (!order) {
      await ctx.reply(
        "Hozircha faol buyurtmangiz yo'q. Yangi buyurtma berish uchun pastdagi tugmani bosing 👇",
        customerMenuKeyboard()
      );
      return;
    }

    const line =
      `📋 *Faol buyurtmangiz:*\n\n` +
      `🛠️ Xizmat: ${order.service_type || '—'}\n` +
      `🔢 Navbat raqami: #${order.queue_number ?? '?'}\n` +
      `📌 Holat: ${STATUS_LABELS[order.status] || order.status}` +
      (order.price ? `\n💰 Narx: ${Number(order.price).toLocaleString('ru-RU')} so'm` : '');

    await ctx.reply(line, { parse_mode: 'Markdown', ...customerMenuKeyboard() });
  } catch (err) {
    console.error('getActiveOrder xatolik:', err.message);
    await ctx.reply('⚠️ Ma\'lumotni olishda muammo. Birozdan so\'ng qayta urinib ko\'ring.');
  }
}

async function handleCancelCommand(ctx) {
  const user = requireLinked(ctx);
  if (!user) return;

  try {
    const order = await api.getActiveOrder({ telegram_chat_id: ctx.from.id });
    if (!order) {
      await ctx.reply("Bekor qiladigan faol buyurtmangiz yo'q.");
      return;
    }

    await api.cancelActiveOrder({ telegram_chat_id: ctx.from.id });
    await ctx.reply('✅ Buyurtmangiz bekor qilindi.', customerMenuKeyboard());
  } catch (err) {
    console.error('cancelActiveOrder xatolik:', err.message);
    await ctx.reply("⚠️ Bekor qilishda muammo yuz berdi. Qayta urinib ko'ring.");
  }
}

const URGENCY_LABELS = {
  past: 'Past',
  "o'rta": "O'rta",
  yuqori: 'Yuqori',
};

// "Muammoni yozish" tugmasi — mijozga erkin matn yozishni tushuntiradi
async function handleDescribeCommand(ctx) {
  await ctx.answerCbQuery().catch(() => {});
  clearPendingClarification(ctx.from.id);
  await ctx.reply(
    "✍️ Muammoingizni oddiy so'zlar bilan yozib yuboring, masalan:\n\n" +
      "«kranimdan suv tomchilayapti, ertaga kelib qarang»\n\n" +
      "Biz xabarni tushunib, buyurtmani avtomatik rasmiylashtiramiz."
  );
}

// Erkin matn -> AI tasnifi -> avtomatik buyurtma (yoki aniqlashtiruvchi savol)
async function handleFreeText(ctx) {
  const user = requireLinked(ctx);
  if (!user || user.role !== 'customer') return;
  const text = (ctx.message.text || '').trim();
  if (!text || text.startsWith('/')) return;

  // Aniqlashtiruvchi savolga javob kelayotgan bo'lsa — original matn bilan birlashtiramiz,
  // shunda AI oldingi kontekst bilan tasniflaydi.
  const pending = getPendingClarification(ctx.from.id);
  const sendText = pending ? `${pending.original_text}\n\nQo'shimcha ma'lumot: ${text}` : text;

  let progress = null;
  try {
    progress = await ctx.reply('🤔 Tushunyapman, biroz kuting...');
  } catch (err) {
    console.error('progress xabar yuborish xatosi:', err.message);
  }

  const sendResult = async (msg, keyboard) => {
    const opts = keyboard ? { ...keyboard } : undefined;
    if (progress) {
      try {
        await ctx.telegram.editMessageText(ctx.chat.id, progress.message_id, undefined, msg, opts);
        return;
      } catch (err) {
        console.error('editMessageText xatosi:', err.message);
      }
    }
    await ctx.reply(msg, opts);
  };

  try {
    const result = await api.createOrderFromText({ telegram_chat_id: ctx.from.id, text: sendText });

    if (result.needs_clarification) {
      setPendingClarification(ctx.from.id, {
        original_text: pending ? pending.original_text : text,
        question: result.question,
      });
      await sendResult(result.question || 'Muammoingizni batafsilroq yozib bering.', customerMenuKeyboard());
      return;
    }

    clearPendingClarification(ctx.from.id);

    if (result.relevant === false) {
      await sendResult(
        "😔 Afsus, biz bu turdagi ishni bajarmaymiz. Ustaxonamiz santexnika va elektr ishlari bilan shug'ullanadi.",
        customerMenuKeyboard()
      );
      return;
    }

    if (result.manual_required) {
      await sendResult(
        "⚠️ Hozircha muammoingizni avtomatik aniqlay olmadim.\n\n" +
          "Iltimos, ustaxonaga qo'ng'iroq qiling yoki birozdan so'ng qayta yozib ko'ring.",
        customerMenuKeyboard()
      );
      return;
    }

    const urgency = URGENCY_LABELS[result.urgency] || '—';
    const durationLine = result.estimated_duration_minutes
      ? `\n⏱️ Taxminiy vaqt: ${result.estimated_duration_minutes} daqiqa`
      : '';

    await sendResult(
      `✅ Buyurtmangiz qabul qilindi!\n\n` +
        `🛠️ Xizmat: ${result.service_type}\n` +
        `🔢 Navbat raqamingiz: #${result.queue_number}\n` +
        `🚦 Shoshilinchlik: ${urgency}` +
        durationLine +
        `\n📌 Holat: ${STATUS_LABELS[result.status] || result.status}\n` +
        `\nHolatingizni quyidagi tugma orqali kuzatib boring 👇`,
      customerMenuKeyboard()
    );
  } catch (err) {
    console.error('createOrderFromText xatolik:', err.message);
    await sendResult(
      "⚠️ Buyurtmani rasmiylashtirishda muammo yuz berdi.\n\nIltimos, ustaxonaga qo'ng'iroq qiling yoki keyinroq qayta urinib ko'ring.",
      customerMenuKeyboard()
    );
  }
}

function registerCustomerHandlers(bot) {
  bot.command('order', handleOrderCommand);
  bot.command('status', handleStatusCommand);
  bot.command('cancel', handleCancelCommand);
  bot.action(/^menu_order$/, handleOrderCommand);
  bot.action(/^menu_describe$/, handleDescribeCommand);
  bot.action(/^menu_status$/, handleStatusCommand);
  bot.action(/^menu_cancel$/, handleCancelCommand);
  bot.action(/^order_svc_(.+)/, handleServiceSelection);
  bot.on('text', handleFreeText);
}

module.exports = { registerCustomerHandlers, customerMenuKeyboard, requireLinked };
