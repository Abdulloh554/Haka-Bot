const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "..", "data", "linked_users.json");

function ensureStorage() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, "{}", "utf8");
  }
}

function readUsers() {
  ensureStorage();

  try {
    const raw = fs.readFileSync(dbPath, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function writeUsers(users) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(users, null, 2), "utf8");
}

function saveLinkedUser(telegramId, { phone, role, backendUserId, name }) {
  const users = readUsers();
  const id = String(telegramId);

  users[id] = {
    ...users[id],
    telegram_id: Number(telegramId),
    phone: phone || users[id]?.phone || null,
    role: role || users[id]?.role || null,
    backend_user_id: backendUserId || users[id]?.backend_user_id || null,
    name: name || users[id]?.name || null,
    linked_at: users[id]?.linked_at || new Date().toISOString(),
  };

  writeUsers(users);
  return users[id];
}

function getLinkedUser(telegramId) {
  const users = readUsers();
  const matched = users[String(telegramId)];
  return matched || null;
}

// ============ AI aniqlashtirish sessiyasi (vaqtinchalik holat) ============

const pendingPath = path.join(__dirname, "..", "data", "pending_clarification.json");

function readPending() {
  ensureStorage();

  try {
    const raw = fs.readFileSync(pendingPath, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function writePending(pending) {
  fs.mkdirSync(path.dirname(pendingPath), { recursive: true });
  fs.writeFileSync(pendingPath, JSON.stringify(pending, null, 2), "utf8");
}

// Aniqlashtiruvchi savol yuborilgan mijozning original matnini saqlaydi.
function setPendingClarification(telegramId, { original_text, question }) {
  const pending = readPending();
  pending[String(telegramId)] = {
    original_text,
    question,
    created_at: new Date().toISOString(),
  };
  writePending(pending);
}

function getPendingClarification(telegramId) {
  const pending = readPending();
  const entry = pending[String(telegramId)];
  if (!entry) return null;
  // 30 daqiqadan eski bo'lsa tozalab, null qaytaramiz
  const ageMs = Date.now() - new Date(entry.created_at).getTime();
  if (ageMs > 30 * 60 * 1000) {
    clearPendingClarification(telegramId);
    return null;
  }
  return entry;
}

function clearPendingClarification(telegramId) {
  const pending = readPending();
  delete pending[String(telegramId)];
  writePending(pending);
}

module.exports = {
  saveLinkedUser,
  getLinkedUser,
  setPendingClarification,
  getPendingClarification,
  clearPendingClarification,
};
