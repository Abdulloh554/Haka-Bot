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

module.exports = { saveLinkedUser, getLinkedUser };
