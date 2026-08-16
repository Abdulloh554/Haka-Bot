const { Markup } = require('telegraf');
const api = require('./api');
const { getLinkedUser } = require('./localdb');

function ownerMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📊 Bugungi hisobot', 'menu_report')],
    [Markup.button.callback('📦 Kam qolgan mahsulotlar', 'menu_inventory')],
  ]);
}

async function handleReportCommand(ctx) {
  const user = getLinkedUser(ctx.from.id);
  if (!user || user.role !== 'owner') {
    await ctx.reply("Bu bo'lim faqat ustaxona egasi uchun. Avval /start orqali bog'laning.");
    return;
  }

  try {
    const report = await api.getDailyReport({ telegram_chat_id: ctx.from.id });

    const base =
      `📊 *Bugungi hisobot*\n\n` +
      `💰 Tushum: ${Number(report.revenue ?? 0).toLocaleString('ru-RU')} so'm\n` +
      `📦 Buyurtmalar soni: ${report.ordersCount ?? 0}\n` +
      `✅ Bajarilgan: ${report.completedCount ?? 0}\n` +
      `🟢 Bo'sh ustalar: ${report.freeStaff ?? 0}\n` +
      `🔴 Band ustalar: ${report.busyStaff ?? 0}`;

    const ai = report.ai_summary;
    const aiLine = ai && ai.summary
      ? `\n\n🧠 *AI xulosa:*\n${ai.summary}\n\n💡 *Tavsiya:*\n${ai.recommendation || ''}`
      : '';

    await ctx.reply(base + aiLine, { parse_mode: 'Markdown', ...ownerMenuKeyboard() });
  } catch (err) {
    console.error('getDailyReport xatolik:', err.message);
    await ctx.reply("⚠️ Hisobotni olishda muammo. Qayta urinib ko'ring.");
  }
}

async function handleInventoryCommand(ctx) {
  const user = getLinkedUser(ctx.from.id);
  if (!user || user.role !== 'owner') {
    await ctx.reply("Bu bo'lim faqat ustaxona egasi uchun. Avval /start orqali bog'langan.");
    return;
  }

  try {
    const items = await api.getLowStockItems({ telegram_chat_id: ctx.from.id });

    if (!items || items.length === 0) {
      await ctx.reply("✅ Omborda hozircha kam qolgan mahsulot yo'q.", ownerMenuKeyboard());
      return;
    }

    const text = items
      .map((it) => `⚠️ ${it.name} — qoldiq: ${it.quantity} (chegara: ${it.threshold})`)
      .join('\n');

    await ctx.reply(`📦 *Kam qolgan mahsulotlar:*\n\n${text}`, {
      parse_mode: 'Markdown',
      ...ownerMenuKeyboard(),
    });
  } catch (err) {
    console.error('getLowStockItems xatolik:', err.message);
    await ctx.reply("⚠️ Ombor ma'lumotini olishda muammo. Qayta urinib ko'ring.");
  }
}

function registerOwnerHandlers(bot) {
  bot.command('report', handleReportCommand);
  bot.command('inventory', handleInventoryCommand);
  bot.action(/^menu_report$/, handleReportCommand);
  bot.action(/^menu_inventory$/, handleInventoryCommand);
}

module.exports = { registerOwnerHandlers, ownerMenuKeyboard };
