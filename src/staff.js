const { Markup } = require('telegraf');
const api = require('./api');
const { getLinkedUser } = require('./localdb');

const STATUS_LABELS = {
  queued: '⏳ Navbatda',
  assigned: '👷 Biriktirilgan',
  in_progress: '🔧 Bajarilmoqda',
  completed: '✅ Bajarildi',
  cancelled: '❌ Bekor qilingan',
  no_show: '🚫 Kelmadi',
};

function staffMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📋 Bugungi vazifalar', 'menu_today')],
  ]);
}

async function handleTodayCommand(ctx) {
  const user = getLinkedUser(ctx.from.id);
  if (!user || user.role !== 'staff') {
    await ctx.reply("Bu bo'lim faqat usta akkauntlari uchun. Avval /start orqali bog'laning.");
    return;
  }

  try {
    const data = await api.getTodayTasks({ telegram_chat_id: ctx.from.id });
    const tasks = (data && data.active_orders) || [];

    if (tasks.length === 0) {
      await ctx.reply('📋 Bugun sizga hali vazifa tayinlanmagan.', staffMenuKeyboard());
      return;
    }

    const text = tasks
      .map(
        (t, i) =>
          `${i + 1}. ${t.client_name || 'Mijoz noma\'lum'} — ${t.service_type || ''}\n` +
          `   🔢 #${t.queue_number ?? '?'} | 📌 ${STATUS_LABELS[t.status] || t.status}`
      )
      .join('\n\n');

    await ctx.reply(`🔧 *Bugungi vazifalaringiz:*\n\n${text}`, {
      parse_mode: 'Markdown',
      ...staffMenuKeyboard(),
    });
  } catch (err) {
    console.error('getTodayTasks xatolik:', err.message);
    await ctx.reply("⚠️ Vazifalar ro'yxatini olishda muammo. Qayta urinib ko'ring.");
  }
}

function registerStaffHandlers(bot) {
  bot.command('today', handleTodayCommand);
  bot.action(/^menu_today$/, handleTodayCommand);
}

module.exports = { registerStaffHandlers, staffMenuKeyboard };
