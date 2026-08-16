const api = require('./api');
const { getLinkedUser } = require('./localdb');

async function handleTodayCommand(ctx) {
  const user = getLinkedUser(ctx.from.id);
  if (!user || user.role !== 'staff') {
    await ctx.reply("Bu buyruq faqat usta akkauntlari uchun. Avval /start orqali bog'laning.");
    return;
  }

  try {
    const tasks = await api.getTodayTasks({ telegramChatId: ctx.from.id });

    if (!tasks || tasks.length === 0) {
      await ctx.reply('📋 Bugun sizga hali vazifa tayinlanmagan.');
      return;
    }

    const text = tasks
      .map(
        (t, i) =>
          `${i + 1}. ${t.customerName ?? "Mijoz noma'lum"} — ${t.service ?? ''}\n` +
          `   Vaqt: ${t.time ?? "belgilanmagan"} | Holat: ${t.status ?? "kutilmoqda"}`
      )
      .join('\n\n');

    await ctx.reply(`🔧 *Bugungi vazifalaringiz:*\n\n${text}`, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('getTodayTasks xatolik:', err.message);
    await ctx.reply("⚠️ Vazifalar ro'yxatini olishda muammo. Qayta urinib ko'ring.");
  }
}

function registerStaffHandlers(bot) {
  bot.command('today', handleTodayCommand);
}

module.exports = { registerStaffHandlers };
