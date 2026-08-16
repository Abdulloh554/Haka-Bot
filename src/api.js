const axios = require('axios');

const BASE_URL = process.env.API_BASE_URL || 'https://ustachibackend.onrender.com';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * ====================================================================
 * MUHIM: Bu faylda ishlatilgan endpoint manzillari — frontend/backend
 * hujjatida aniq YOZILMAGAN, shuning uchun taxminiy (REST/DRF konventsiyasi
 * bo'yicha, /api/health/ namunasidan kelib chiqib) qo'yilgan.
 *
 * Haqiqiy hujjat (Swagger/Postman) kelganda FAQAT shu fayldagi
 * url manzillarini va response maydonlarini tuzating — boshqa
 * hech qanday faylga tegishning hojati yo'q.
 * ====================================================================
 */

// Telegram chatId'ni tizimdagi foydalanuvchi (telefon raqami) bilan bog'laydi.
// Kutilayotgan javob: { role: 'customer' | 'staff' | 'owner', userId, name }
async function linkTelegramAccount({ telegramChatId, phone }) {
  const { data } = await client.post('/api/auth/telegram-link/', {
    telegramChatId,
    phone,
  });
  return data;
}

// --- MIJOZ ---

// Yangi buyurtma yaratadi. Kutilayotgan javob: { queueNumber, estimatedTime, orderId }
async function createOrder({ telegramChatId, serviceType }) {
  const { data } = await client.post('/api/orders/', {
    telegramChatId,
    serviceType,
  });
  return data;
}

// Mijozning hozirgi faol buyurtmasini qaytaradi (yo'q bo'lsa null/404)
async function getActiveOrder({ telegramChatId }) {
  try {
    const { data } = await client.get('/api/orders/active/', {
      params: { telegramChatId },
    });
    return data;
  } catch (err) {
    if (err.response && err.response.status === 404) return null;
    throw err;
  }
}

// Faol buyurtmani bekor qiladi
async function cancelActiveOrder({ telegramChatId }) {
  const { data } = await client.post('/api/orders/cancel/', { telegramChatId });
  return data;
}

// --- USTA (STAFF) ---

// Bugungi tayinlangan vazifalar ro'yxati
async function getTodayTasks({ telegramChatId }) {
  const { data } = await client.get('/api/staff/today/', {
    params: { telegramChatId },
  });
  return data; // kutilgan: [{ orderId, customerName, service, time, status }]
}

// --- EGA (OWNER) ---

// Bugungi qisqa hisobot
async function getDailyReport({ telegramChatId }) {
  const { data } = await client.get('/api/reports/daily/', {
    params: { telegramChatId },
  });
  return data; // kutilgan: { revenue, ordersCount, busyStaff, freeStaff }
}

// Kam qolgan ombor mahsulotlari
async function getLowStockItems({ telegramChatId }) {
  const { data } = await client.get('/api/inventory/low-stock/', {
    params: { telegramChatId },
  });
  return data; // kutilgan: [{ name, quantity, threshold }]
}

module.exports = {
  linkTelegramAccount,
  createOrder,
  getActiveOrder,
  cancelActiveOrder,
  getTodayTasks,
  getDailyReport,
  getLowStockItems,
};
