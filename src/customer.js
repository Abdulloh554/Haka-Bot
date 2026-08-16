const { Markup } = require('telegraf');
const api = require('./api');
const { getLinkedUser } = require('./localdb');

// Xizmat turlari — spetsifikatsiyada aniq ro'yxat berilmagan, shuning uchun
// ustaxona (santexnik/elektrik/maishiy texnika) uchun taxminiy ro'yxat.
// Kerak bo'lsa bu yerni o'zgartirish kifoya.
const SERVICE_TYPES = [
  { code: 'santexnik', label: '🔧 Santexnika' },
  { code: 'elektrik', label: '⚡ Elektrika' },
  { code: 'maishiy_texnika', label: '🔌 Maishiy texnika' },
];

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

async function handleOrderCommand(ctx) {
  const user = requireLinked(ctx);
  if (!user) return;

  await ctx.reply(
    'Qaysi xizmat kerak?',
    Markup.inlineKeyboard(
      SERVICE_TYPES.map((s) => [Markup.button.callback(s.label, `order_service_${s.code}`)])
    )
  );
}

async function handleServiceSelection(ctx) {
  const code = ctx.match[1];
  const service = SERVICE_TYPES.find((s) => s.code === code);
  await ctx.answerCbQuery();

  try {
    const result = await api.createOrder({
      telegramChatId: ctx.from.id,
      serviceType: code,
    });

    await ctx.editMessageText(
      `✅ Buyurtmangiz qabul qilindi!\n\n` +
        `Xizmat: ${service ? service.label : code}\n` +
        `Navbat raqamingiz: #${result.queueNumber ?? '?'}\n` +
        (result.estimatedTime ? `Taxminiy vaqt: ${result.estimatedTime}\n` : '') +
        `\nHolatingizni istalgan vaqt /status orqali tekshirishingiz mumkin.`
    );
  } catch (err) {
    console.error('createOrder xatolik:', err.message);
    await ctx.reply(
      "⚠️ Buyurtma yaratishda muammo yuz berdi. Birozdan so'ng qayta urinib ko'ring, yoki to'g'ridan-to'g'ri ustaxonaga qo'ng'iroq qiling."
    );
  }
}

async function handleStatusCommand(ctx) {
  const user = requireLinked(ctx);
  if (!user) return;

  try {
    const order = await api.getActiveOrder({ telegramChatId: ctx.from.id });
    if (!order) {
      await ctx.reply(
        "Hozircha faol buyurtmangiz yo'q. Yangi buyurtma berish uchun /order bosing."
      );
      return;
    }

    await ctx.reply(
      `📋 Faol buyurtmangiz:\n\n` +
        `Navbat raqami: #${order.queueNumber ?? '?'}\n` +
        `Holat: ${order.status ?? "noma'lum"}\n` +
        (order.estimatedTime ? `Taxminiy vaqt: ${order.estimatedTime}\n` : '')
    );
  } catch (err) {
    console.error('getActiveOrder xatolik:', err.message);
    await ctx.reply('⚠️ Ma\'lumotni olishda muammo. Birozdan so\'ng qayta urinib ko\'ring.');
  }
}

async function handleCancelCommand(ctx) {
  const user = requireLinked(ctx);
  if (!user) return;

  try {
    const order = await api.getActiveOrder({ telegramChatId: ctx.from.id });
    if (!order) {
      await ctx.reply("Bekor qiladigan faol buyurtmangiz yo'q.");
      return;
    }

    await api.cancelActiveOrder({ telegramChatId: ctx.from.id });
    await ctx.reply('✅ Buyurtmangiz bekor qilindi.');
  } catch (err) {
    console.error('cancelActiveOrder xatolik:', err.message);
    await ctx.reply("⚠️ Bekor qilishda muammo yuz berdi. Qayta urinib ko'ring.");
  }
}

function registerCustomerHandlers(bot) {
  bot.command('order', handleOrderCommand);
  bot.command('status', handleStatusCommand);
  bot.command('cancel', handleCancelCommand);
  bot.action(/order_service_(.+)/, handleServiceSelection);
}

module.exports = { registerCustomerHandlers };
