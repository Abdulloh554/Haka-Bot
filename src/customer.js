const { Markup } = require('telegraf');
const api = require('./api');
const { getLinkedUser } = require('./localdb');

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

function registerCustomerHandlers(bot) {
  bot.command('order', handleOrderCommand);
  bot.command('status', handleStatusCommand);
  bot.command('cancel', handleCancelCommand);
  bot.action(/^menu_order$/, handleOrderCommand);
  bot.action(/^menu_status$/, handleStatusCommand);
  bot.action(/^menu_cancel$/, handleCancelCommand);
  bot.action(/^order_svc_(.+)/, handleServiceSelection);
}

module.exports = { registerCustomerHandlers, customerMenuKeyboard, requireLinked };
