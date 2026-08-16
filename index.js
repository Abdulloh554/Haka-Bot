require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const api = require('./src/api');
const { saveLinkedUser, getLinkedUser } = require('./src/localdb');
const { registerCustomerHandlers } = require('./src/customer');
const { registerStaffHandlers } = require('./src/staff');
const { registerOwnerHandlers } = require('./src/owner');
const { startNotifyServer } = require('./src/notifyServer');

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('XATOLIK: .env faylida BOT_TOKEN ko\'rsatilmagan.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

function roleMenuText(role, name) {
  const greeting = name ? `Salom, ${name}!` : 'Salom!';
  if (role === 'customer') {
    return (
      `${greeting}\n\n` +
      `📌 Mavjud buyruqlar:\n` +
      `/order — yangi buyurtma berish\n` +
      `/status — buyurtmangiz holatini ko'rish\n` +
      `/cancel — faol buyurtmani bekor qilish`
    );
  }
  if (role === 'staff') {
    return `${greeting}\n\n📌 Mavjud buyruqlar:\n/today — bugungi vazifalaringiz`;
  }
  if (role === 'owner') {
    return (
      `${greeting}\n\n` +
      `📌 Mavjud buyruqlar:\n` +
      `/report — bugungi hisobot\n` +
      `/inventory — kam qolgan mahsulotlar`
    );
  }
  return `${greeting}\n\nHisobingiz turi aniqlanmadi.`;
}

// ---- /start: kontakt so'rash orqali bog'lash ----

bot.start(async (ctx) => {
  const existing = getLinkedUser(ctx.from.id);
  if (existing) {
    await ctx.reply(roleMenuText(existing.role, existing.name));
    return;
  }

  await ctx.reply(
    "👋 Ustachi botiga xush kelibsiz!\n\nDavom etish uchun telefon raqamingizni ulashing:",
    Markup.keyboard([Markup.button.contactRequest('📱 Raqamni ulashish')])
      .resize()
      .oneTime()
  );
});

bot.on('contact', async (ctx) => {
  const phone = ctx.message.contact.phone_number;

  // Faqat o'zining raqamini ulashishi kerak (boshqa odam nomidan bog'lanmasin)
  if (ctx.message.contact.user_id !== ctx.from.id) {
    await ctx.reply("Iltimos, faqat o'zingizning telefon raqamingizni ulashing.");
    return;
  }

  try {
    const result = await api.linkTelegramAccount({
      telegramChatId: ctx.from.id,
      phone,
    });

    saveLinkedUser(ctx.from.id, {
      phone,
      role: result.role,
      backendUserId: result.userId,
      name: result.name || ctx.from.first_name,
    });

    await ctx.reply('✅ Muvaffaqiyatli bog\'landi!', Markup.removeKeyboard());
    await ctx.reply(roleMenuText(result.role, result.name || ctx.from.first_name));
  } catch (err) {
    console.error('linkTelegramAccount xatolik:', err.message);
    await ctx.reply(
      "⚠️ Tizimda bu raqam topilmadi yoki ulanishda muammo yuz berdi.\n" +
        "Iltimos, ustaxona egasi bilan bog'lanib, raqamingiz tizimga qo'shilganini tekshiring.",
      Markup.removeKeyboard()
    );
  }
});

bot.command('menu', async (ctx) => {
  const user = getLinkedUser(ctx.from.id);
  if (!user) {
    await ctx.reply("Avval /start orqali ro'yxatdan o'ting.");
    return;
  }
  await ctx.reply(roleMenuText(user.role, user.name));
});

// ---- Rol bo'yicha komandalarni ro'yxatdan o'tkazish ----
registerCustomerHandlers(bot);
registerStaffHandlers(bot);
registerOwnerHandlers(bot);

// ---- Xatoliklarni ushlab qolish (bot yiqilib qolmasligi uchun) ----
bot.catch((err, ctx) => {
  console.error(`Xatolik yuz berdi (${ctx.updateType}):`, err);
  ctx.reply('⚠️ Kutilmagan xatolik yuz berdi. Qayta urinib ko\'ring.').catch(() => {});
});

// ---- Ishga tushirish ----
startNotifyServer(bot); // backend bildirishnoma yuborishi uchun /notify server

bot.launch().then(() => {
  console.log('✅ Ustachi bot ishga tushdi');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
