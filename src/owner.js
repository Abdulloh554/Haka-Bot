const api = require('./api');
const { getLinkedUser } = require('./localdb');

async function handleReportCommand(ctx) {
  const user = getLinkedUser(ctx.from.id);
  if (!user || user.role !== 'owner') {
    await ctx.reply("Bu buyruq faqat ustaxona egasi uchun. Avval /start orqali bog'laning.");
    return;
  }

  try {
    const report = await api.getDailyReport({ telegramChatId: ctx.from.id });

    await ctx.reply(
      `📊 *Bugungi hisobot*\n\n` +
        `💰 Tushum: ${report.revenue ?? 0} so'm\n` +
        `📦 Buyurtmalar soni: ${report.ordersCount ?? 0}\n` +
        `🟢 Band ustalar: ${report.busyStaff ?? 0}\n` +
        `⚪ Bo'sh ustalar: ${report.freeStaff ?? 0}`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('getDailyReport xatolik:', err.message);
    await ctx.reply("⚠️ Hisobotni olishda muammo. Qayta urinib ko'ring.");
  }
}

async function handleInventoryCommand(ctx) {
  const user = getLinkedUser(ctx.from.id);
  if (!user || user.role !== 'owner') {
    await ctx.reply("Bu buyruq faqat ustaxona egasi uchun. Avval /start orqali bog'laning.");
    return;
  }

  try {
    const items = await api.getLowStockItems({ telegramChatId: ctx.from.id });

    if (!items || items.length === 0) {
      await ctx.reply('✅ Omborda hozircha kam qolgan mahsulot yo\'q.');
      return;
    }

    const text = items
      .map((it) => `⚠️ ${it.name} — qoldiq: ${it.quantity} (chegara: ${it.threshold})`)
      .join('\n');

    await ctx.reply(`📦 *Kam qolgan mahsulotlar:*\n\n${text}`, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('getLowStockItems xatolik:', err.message);
    await ctx.reply("⚠️ Ombor ma'lumotini olishda muammo. Qayta urinib ko'ring.");
  }
}

function registerOwnerHandlers(bot) {
  bot.command('report', handleReportCommand);
  bot.command('inventory', handleInventoryCommand);
}

module.exports = { registerOwnerHandlers };
