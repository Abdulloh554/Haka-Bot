const axios = require('axios');

const BASE_URL = process.env.API_BASE_URL || 'https://ustachibackend.onrender.com';
const BOT_TOKEN = process.env.BOT_TOKEN || '';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Telegram chatId'ni tizimdagi foydalanuvchi (telefon raqami) bilan bog'laydi.
// Kutilayotgan javob: { role: 'customer' | 'staff' | 'owner', userId, name }
async function linkTelegramAccount({ telegramChatId, phone }) {
  const { data } = await client.post('/api/auth/telegram-link/', {
    telegramChatId,
    phone,
  });
  return data;
}

// Bot xizmatlari uchun maxsus sarlavha (backenda ixtiyoriy tekshiriladi)
function botHeaders() {
  return BOT_TOKEN ? { 'x-bot-token': BOT_TOKEN } : {};
}

// Ustaxonaning faol xizmatlari: { services: [{ id, name, price, ... }] }
async function getServices() {
  const { data } = await client.get('/api/bot/services/');
  return data;
}

// Yangi buyurtma yaratadi. Kutilayotgan javob: orderSerializer (id, queue_number, status, ...)
async function createOrder({ telegram_chat_id, service_id, description }) {
  const { data } = await client.post('/api/bot/orders/', { telegram_chat_id, service_id, description }, { headers: botHeaders() });
  return data;
}

// Erkin matn asosida AI tasniflashi orqali buyurtma yaratadi.
// Javob: orderSerializer | { needs_clarification, question } | { manual_required } | { relevant: false }
// AI tasnifi sekin bo'lishi mumkin — oddiy 15s o'rniga 30s beramiz.
async function createOrderFromText({ telegram_chat_id, text }) {
  const { data } = await client.post(
    '/api/bot/orders/from_text/',
    { telegram_chat_id, text },
    { headers: botHeaders(), timeout: 30000 }
  );
  return data;
}

// Mijozning hozirgi faol buyurtmasi (yo'q bo'lsa null)
async function getActiveOrder({ telegram_chat_id }) {
  try {
    const { data } = await client.get('/api/bot/orders/active/', {
      params: { telegram_chat_id },
      headers: botHeaders(),
    });
    return data;
  } catch (err) {
    if (err.response && err.response.status === 404) return null;
    throw err;
  }
}

// Faol buyurtmani bekor qiladi
async function cancelActiveOrder({ telegram_chat_id }) {
  const { data } = await client.post('/api/bot/orders/cancel/', { telegram_chat_id }, { headers: botHeaders() });
  return data;
}

// Xodimning bugungi tayinlangan vazifalari: { active_orders: [...] }
async function getTodayTasks({ telegram_chat_id }) {
  const { data } = await client.get('/api/bot/staff/today/', {
    params: { telegram_chat_id },
    headers: botHeaders(),
  });
  return data;
}

// Ega uchun bugungi hisobot + kam qolgan ombor
async function getDailyReport({ telegram_chat_id }) {
  const { data } = await client.get('/api/bot/report/daily/', {
    params: { telegram_chat_id },
    headers: botHeaders(),
  });
  return data;
}

// Kam qolgan ombor mahsulotlari
async function getLowStockItems({ telegram_chat_id }) {
  const { data } = await client.get('/api/bot/inventory/low/', {
    params: { telegram_chat_id },
    headers: botHeaders(),
  });
  return data.lowStock || [];
}

module.exports = {
  linkTelegramAccount,
  getServices,
  createOrder,
  createOrderFromText,
  getActiveOrder,
  cancelActiveOrder,
  getTodayTasks,
  getDailyReport,
  getLowStockItems,
};
