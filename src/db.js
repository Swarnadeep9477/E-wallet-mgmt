const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const QRCode = require("qrcode");

const db = new Database(path.join(__dirname, "..", "wallet.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const PROTECTED_ADMIN_EMAIL = "admin345@gmail.com";
const UPI_HANDLES = ["@ybl", "@axl", "@paytm", "@oksbi"];

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-5)}`.toUpperCase();
}

function walletIdFor(name = "", phone = "") {
  const cleanName = String(name).replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 4) || "USER";
  const cleanPhone = String(phone).replace(/\D/g, "").slice(-4) || Math.floor(1000 + Math.random() * 9000);
  let candidate = `SWP${cleanName}${cleanPhone}`;
  let counter = 1;
  while (db.prepare("SELECT 1 FROM wallets WHERE wallet_id = ?").get(candidate)) {
    candidate = `SWP${cleanName}${cleanPhone}${counter}`;
    counter += 1;
  }
  return candidate;
}

function adminWalletIdFor(name = "ADMIN") {
  const cleanName = String(name).replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6) || "ADMIN";
  let candidate = `SWP${cleanName}`;
  let counter = 1;
  while (db.prepare("SELECT 1 FROM wallets WHERE wallet_id = ?").get(candidate)) {
    candidate = `SWP${cleanName}${counter}`;
    counter += 1;
  }
  return candidate;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isAdminEmail(email) {
  return Boolean(db.prepare("SELECT 1 FROM admins WHERE email = ?").get(normalizeEmail(email)));
}

function isKycVerifiedForUser(userId) {
  const row = db.prepare("SELECT kyc_status, account_status FROM users WHERE user_id = ?").get(userId);
  if (!row) return false;
  if (String(row.account_status || "active").toLowerCase() !== "active") return false;
  return String(row.kyc_status || "").trim().toLowerCase() === "verified";
}

function validateTransactionPin(pin) {
  const value = String(pin ?? "").trim();
  if (!/^\d{4}$/.test(value)) {
    throw new Error("Transaction PIN must be exactly 4 digits.");
  }
  return value;
}

function verifyWalletPin(wallet, pin) {
  if (!wallet?.wallet_id) throw new Error("Wallet not found.");
  assertWalletActive(wallet);
  const pinValue = validateTransactionPin(pin);
  const fresh = db.prepare("SELECT transaction_pin_hash FROM wallets WHERE wallet_id = ?").get(wallet.wallet_id);
  if (!fresh || !bcrypt.compareSync(pinValue, fresh.transaction_pin_hash)) {
    throw new Error("Wrong transaction PIN. Transaction failed.");
  }
  return pinValue;
}

function assertWalletActive(wallet) {
  const status = String(wallet?.wallet_status || "active").toLowerCase();
  if (status !== "active") {
    throw new Error(`Your wallet is ${status}. Contact support to restore access.`);
  }
}

async function repairUserWalletAssets(userId) {
  const user = db.prepare("SELECT user_id, full_name, phone_number FROM users WHERE user_id = ?").get(userId);
  if (!user) return null;

  let wallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(userId);
  if (!wallet) {
    const walletId = walletIdFor(user.full_name, user.phone_number);
    const pinValue = "1234";
    db.prepare(`
      INSERT INTO wallets (wallet_id, user_id, balance, currency, wallet_status, transaction_pin_hash, transaction_pin_plain)
      VALUES (?, ?, 0, 'INR', 'active', ?, ?)
    `).run(walletId, userId, bcrypt.hashSync(pinValue, 12), pinValue);
    notify(
      userId,
      "Wallet linked",
      `Wallet ${walletId} was created for your account. Default PIN is 1234 — change it in Profile immediately.`,
      "system"
    );
    wallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(userId);
  }

  const hasQr = db.prepare("SELECT 1 FROM wallet_qr WHERE wallet_id = ? AND is_active = 1").get(wallet.wallet_id);
  if (!hasQr) await createWalletQr(wallet.wallet_id);

  return wallet;
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  if (last10.length !== 10) throw new Error("Phone number must be 10 digits.");
  return last10;
}

function isAdult(dob) {
  if (!dob) return false;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const monthDiff = today.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < born.getDate())) age -= 1;
  return age >= 18;
}

function normalizeUpiHandle(handle) {
  const raw = String(handle || "@ybl").trim().toLowerCase();
  const withAt = raw.startsWith("@") ? raw : `@${raw}`;
  if (!UPI_HANDLES.includes(withAt)) throw new Error(`UPI handle must be one of: ${UPI_HANDLES.join(", ")}`);
  return withAt;
}

function buildUpiId(phone, handle) {
  const digits = String(phone).replace(/\D/g, "");
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  if (last10.length !== 10) throw new Error("Phone number must be 10 digits for UPI ID.");
  const suffix = normalizeUpiHandle(handle);
  return `${last10}${suffix}`;
}

function resetDatabase() {
  db.exec(`
    DROP TABLE IF EXISTS complaint_status_history;
    DROP TABLE IF EXISTS complaint_messages;
    DROP TABLE IF EXISTS complaint_attachments;
    DROP TABLE IF EXISTS complaints;
    DROP TABLE IF EXISTS notifications;
    DROP TABLE IF EXISTS transactions;
    DROP TABLE IF EXISTS wallet_qr;
    DROP TABLE IF EXISTS wallets;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS admins;
  `);
}

function shapeWalletProfile(row) {
  if (!row) return null;
  return {
    user_id: row.user_id || null,
    admin_id: row.admin_id || null,
    name: row.full_name || row.admin_name || "User",
    full_name: row.full_name || row.admin_name,
    email: row.email,
    phone: row.phone_number || "",
    phone_number: row.phone_number || "",
    upi_id: row.upi_id || "",
    bank_account_no: row.bank_account_no || "",
    bank_name: row.bank_name || "",
    address: row.address || "",
    dob: row.date_of_birth || "",
    date_of_birth: row.date_of_birth || "",
    gender: row.gender || "",
    kyc_status: row.kyc_status || "",
    account_status: row.account_status || "active",
    pin_reset_allowed: Boolean(Number(row.pin_reset_allowed)),
    wallet_id: row.wallet_id,
    balance: row.balance,
    currency: row.currency,
    status: row.wallet_status,
    wallet_status: row.wallet_status,
    qr_payload: row.qr_code_value,
    qr_image: row.qr_image_url,
    qr_code_value: row.qr_code_value,
    qr_image_url: row.qr_image_url,
    is_admin: Boolean(row.admin_id)
  };
}

async function setupDatabase() {
  const usersTable = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
  const userColumns = usersTable ? db.prepare("PRAGMA table_info(users)").all().map((c) => c.name) : [];
  const walletColumns = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'wallets'").get()
    ? db.prepare("PRAGMA table_info(wallets)").all().map((c) => c.name)
    : [];
  const needsReset = !usersTable || !userColumns.includes("upi_id") || !userColumns.includes("bank_name") || !walletColumns.includes("admin_id");

  const existingAdmin = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'admins'").get()
    ? db.prepare("SELECT * FROM admins WHERE email = ?").get(PROTECTED_ADMIN_EMAIL)
    : null;
  const adminData = existingAdmin ? { ...existingAdmin } : null;

  if (needsReset) resetDatabase();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone_number TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_plain TEXT,
      bank_account_no TEXT NOT NULL UNIQUE,
      bank_name TEXT NOT NULL,
      upi_id TEXT NOT NULL UNIQUE,
      upi_handle TEXT NOT NULL DEFAULT '@ybl',
      date_of_birth TEXT NOT NULL,
      gender TEXT,
      address TEXT,
      kyc_status TEXT NOT NULL DEFAULT 'pending',
      profile_photo TEXT,
      account_status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_plain TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_id TEXT NOT NULL UNIQUE,
      user_id TEXT UNIQUE,
      admin_id TEXT UNIQUE,
      balance INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'INR',
      wallet_status TEXT NOT NULL DEFAULT 'active',
      daily_limit INTEGER NOT NULL DEFAULT 1000000,
      monthly_limit INTEGER NOT NULL DEFAULT 10000000,
      transaction_pin_hash TEXT NOT NULL,
      transaction_pin_plain TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (admin_id) REFERENCES admins(admin_id) ON DELETE CASCADE,
      CHECK (
        (user_id IS NOT NULL AND admin_id IS NULL) OR
        (user_id IS NULL AND admin_id IS NOT NULL)
      )
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT NOT NULL UNIQUE,
      wallet_id TEXT NOT NULL,
      sender_wallet_id TEXT,
      receiver_wallet_id TEXT,
      transaction_type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      transaction_fee INTEGER NOT NULL DEFAULT 0,
      previous_balance INTEGER,
      current_balance INTEGER,
      payment_method TEXT,
      reference_number TEXT,
      remarks TEXT,
      transaction_status TEXT NOT NULL DEFAULT 'success',
      transaction_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      notification_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (wallet_id) REFERENCES wallets(wallet_id) ON DELETE CASCADE,
      FOREIGN KEY (sender_wallet_id) REFERENCES wallets(wallet_id) ON DELETE SET NULL,
      FOREIGN KEY (receiver_wallet_id) REFERENCES wallets(wallet_id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS wallet_qr (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      qr_id TEXT NOT NULL UNIQUE,
      wallet_id TEXT NOT NULL,
      qr_code_value TEXT NOT NULL,
      qr_image_url TEXT NOT NULL,
      qr_type TEXT NOT NULL DEFAULT 'payment',
      expiry_date TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (wallet_id) REFERENCES wallets(wallet_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_id TEXT NOT NULL UNIQUE,
      user_id TEXT,
      admin_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      notification_type TEXT NOT NULL DEFAULT 'transaction',
      is_read INTEGER NOT NULL DEFAULT 0,
      sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (admin_id) REFERENCES admins(admin_id) ON DELETE CASCADE,
      CHECK (
        (user_id IS NOT NULL AND admin_id IS NULL) OR
        (user_id IS NULL AND admin_id IS NOT NULL)
      )
    );
  `);

  migrateNotificationsTable();
  migrateComplaintsSchema();
  migrateMoneyRequestsSchema();

  const defaultAdminPassword = "Admin345@";
  const defaultAdminId = adminData?.admin_id || uid("ADM");
  const defaultAdminWalletId = adminWalletIdFor("ADMIN");

  db.prepare("DELETE FROM admins WHERE email = ?").run(PROTECTED_ADMIN_EMAIL);
  db.prepare(`
    INSERT INTO admins (admin_id, name, email, password_hash, password_plain, created_at)
    VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
  `).run(defaultAdminId, adminData?.name || "Admin User", PROTECTED_ADMIN_EMAIL, bcrypt.hashSync(defaultAdminPassword, 12), defaultAdminPassword, adminData?.created_at || null);

  db.prepare(`
    INSERT INTO wallets (wallet_id, admin_id, balance, currency, wallet_status, daily_limit, monthly_limit, transaction_pin_hash, transaction_pin_plain)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(admin_id) DO UPDATE SET
      wallet_id = excluded.wallet_id,
      transaction_pin_hash = excluded.transaction_pin_hash,
      transaction_pin_plain = excluded.transaction_pin_plain,
      wallet_status = excluded.wallet_status,
      updated_at = CURRENT_TIMESTAMP
  `).run(defaultAdminWalletId, defaultAdminId, 9999991900, "INR", "active", 10000000, 100000000, bcrypt.hashSync("1234", 12), "1234");

  if (!db.prepare("SELECT 1 FROM wallet_qr WHERE wallet_id = ? AND is_active = 1").get(defaultAdminWalletId)) {
    await createWalletQr(defaultAdminWalletId);
  }

  purgeAdminShadowUsers();
}

function migrateNotificationsTable() {
  const cols = db.prepare("PRAGMA table_info(notifications)").all().map((c) => c.name);
  if (!cols.length || cols.includes("admin_id")) return;
  db.exec(`
    CREATE TABLE notifications_migrated (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_id TEXT NOT NULL UNIQUE,
      user_id TEXT,
      admin_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      notification_type TEXT NOT NULL DEFAULT 'transaction',
      is_read INTEGER NOT NULL DEFAULT 0,
      sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (admin_id) REFERENCES admins(admin_id) ON DELETE CASCADE,
      CHECK (
        (user_id IS NOT NULL AND admin_id IS NULL) OR
        (user_id IS NULL AND admin_id IS NOT NULL)
      )
    );
    INSERT INTO notifications_migrated (id, notification_id, user_id, title, message, notification_type, is_read, sent_at, read_at)
    SELECT id, notification_id, user_id, title, message, notification_type, is_read, sent_at, read_at FROM notifications;
    DROP TABLE notifications;
    ALTER TABLE notifications_migrated RENAME TO notifications;
  `);
}

function purgeAdminShadowUsers() {
  const rows = db.prepare(`
    SELECT id FROM users
    WHERE LOWER(email) IN (SELECT LOWER(email) FROM admins)
       OR LOWER(email) = ?
       OR user_id LIKE 'USR_ADMIN%'
  `).all(PROTECTED_ADMIN_EMAIL);
  for (const row of rows) {
    try {
      adminDeleteRow("users", row.id);
    } catch (error) {
      console.warn("purgeAdminShadowUsers:", error.message);
    }
  }
}

async function createWalletQr(walletId) {
  const payload = JSON.stringify({ app: "SwiftPay", wallet_id: walletId, action: "pay" });
  const qrImage = await QRCode.toDataURL(payload, { margin: 1, width: 240 });
  const expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO wallet_qr (qr_id, wallet_id, qr_code_value, qr_image_url, qr_type, expiry_date, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uid("QR"), walletId, payload, qrImage, "payment", expiryDate, 1);
}

function createNotification({ userId = null, adminId = null, title, message, notificationType = "transaction", complaintId = null }) {
  if ((!userId && !adminId) || (userId && adminId)) {
    throw new Error("Notification must belong to exactly one user or admin.");
  }
  const notificationId = uid("NTF");
  db.prepare(`
    INSERT INTO notifications (notification_id, user_id, admin_id, title, message, notification_type, complaint_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(notificationId, userId, adminId, title, message, notificationType, complaintId || null);
  return notificationId;
}

function notify(userId, title, message, notificationType = "transaction", complaintId = null) {
  return createNotification({ userId, title, message, notificationType, complaintId });
}

function notifyAdmin(adminId, title, message, notificationType = "transaction", complaintId = null) {
  return createNotification({ adminId, title, message, notificationType, complaintId });
}

function migrateUserExtras() {
  const userCols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  if (!userCols.includes("pin_reset_allowed")) {
    db.exec("ALTER TABLE users ADD COLUMN pin_reset_allowed INTEGER NOT NULL DEFAULT 0");
  }
}

function migrateComplaintsSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      wallet_id TEXT,
      transaction_id TEXT,
      subject TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'RAISED',
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      accepted_at TEXT,
      resolved_at TEXT,
      closed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS complaint_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attachment_id TEXT NOT NULL UNIQUE,
      complaint_id TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER,
      uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS complaint_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL UNIQUE,
      complaint_id TEXT NOT NULL,
      sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'admin')),
      sender_id TEXT NOT NULL,
      message TEXT NOT NULL,
      attachment_url TEXT,
      attachment_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS complaint_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      history_id TEXT NOT NULL UNIQUE,
      complaint_id TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      changed_by_type TEXT NOT NULL CHECK (changed_by_type IN ('user', 'admin', 'system')),
      changed_by_id TEXT,
      changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE CASCADE
    );
  `);

  const notifCols = db.prepare("PRAGMA table_info(notifications)").all().map((c) => c.name);
  if (!notifCols.includes("complaint_id")) {
    db.exec("ALTER TABLE notifications ADD COLUMN complaint_id TEXT");
  }
  migrateUserExtras();
}

function currentUser(userId) {
  const row = db.prepare(`
    SELECT u.user_id, NULL AS admin_id, u.full_name, u.email, u.phone_number, u.upi_id, u.bank_account_no, u.bank_name,
           u.address, u.date_of_birth, u.gender, u.kyc_status, u.account_status, u.pin_reset_allowed,
           w.wallet_id, w.balance, w.currency, w.wallet_status, q.qr_code_value, q.qr_image_url
    FROM users u
    JOIN wallets w ON w.user_id = u.user_id
    LEFT JOIN wallet_qr q ON q.wallet_id = w.wallet_id AND q.is_active = 1
    WHERE u.user_id = ?
  `).get(userId);
  return shapeWalletProfile(row);
}

function currentAdmin(adminId) {
  const row = db.prepare(`
    SELECT NULL AS user_id, a.admin_id, a.name AS admin_name, a.email, NULL AS phone_number, NULL AS upi_id,
           NULL AS bank_account_no, NULL AS bank_name, NULL AS address, NULL AS date_of_birth, NULL AS gender,
           'verified' AS kyc_status, 'active' AS account_status,
           w.wallet_id, w.balance, w.currency, w.wallet_status, q.qr_code_value, q.qr_image_url
    FROM admins a
    JOIN wallets w ON w.admin_id = a.admin_id
    LEFT JOIN wallet_qr q ON q.wallet_id = w.wallet_id AND q.is_active = 1
    WHERE a.admin_id = ?
  `).get(adminId);
  return shapeWalletProfile(row);
}

function getWalletByAuth(auth) {
  if (auth.role === "user") return db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(auth.userId);
  if (auth.role === "admin") return db.prepare("SELECT * FROM wallets WHERE admin_id = ?").get(auth.adminId);
  return null;
}

/** Shared wallet for bill/recharge settlements (FK-safe; one admin wallet only). */
function getBillSettlementWalletId() {
  const admin = db.prepare("SELECT admin_id FROM admins ORDER BY created_at ASC LIMIT 1").get();
  if (!admin) throw new Error("Bill payment is temporarily unavailable. Contact support.");

  const wallet = db.prepare(`
    SELECT wallet_id FROM wallets WHERE admin_id = ? AND wallet_status = 'active' LIMIT 1
  `).get(admin.admin_id);
  if (!wallet) throw new Error("Bill settlement wallet is not configured. Contact support.");
  return wallet.wallet_id;
}

function migrateMoneyRequestsSchema() {
  const table = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'money_requests'").get();
  const cols = table ? db.prepare("PRAGMA table_info(money_requests)").all().map((c) => c.name) : [];

  if (!table) {
    db.exec(`
      CREATE TABLE money_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL UNIQUE,
        requester_user_id TEXT,
        requester_admin_id TEXT,
        requester_wallet_id TEXT NOT NULL,
        payer_user_id TEXT,
        payer_admin_id TEXT,
        payer_wallet_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        note TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        payment_method TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        responded_at TEXT,
        paid_at TEXT,
        FOREIGN KEY (requester_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (payer_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (requester_admin_id) REFERENCES admins(admin_id) ON DELETE CASCADE,
        FOREIGN KEY (payer_admin_id) REFERENCES admins(admin_id) ON DELETE CASCADE,
        FOREIGN KEY (requester_wallet_id) REFERENCES wallets(wallet_id) ON DELETE CASCADE,
        FOREIGN KEY (payer_wallet_id) REFERENCES wallets(wallet_id) ON DELETE CASCADE,
        CHECK (
          (requester_user_id IS NOT NULL AND requester_admin_id IS NULL) OR
          (requester_user_id IS NULL AND requester_admin_id IS NOT NULL)
        ),
        CHECK (
          (payer_user_id IS NOT NULL AND payer_admin_id IS NULL) OR
          (payer_user_id IS NULL AND payer_admin_id IS NOT NULL)
        )
      );
    `);
    return;
  }

  if (cols.includes("requester_admin_id")) return;

  db.exec(`
    CREATE TABLE money_requests_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL UNIQUE,
      requester_user_id TEXT,
      requester_admin_id TEXT,
      requester_wallet_id TEXT NOT NULL,
      payer_user_id TEXT,
      payer_admin_id TEXT,
      payer_wallet_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      payment_method TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      responded_at TEXT,
      paid_at TEXT,
      FOREIGN KEY (requester_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (payer_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (requester_admin_id) REFERENCES admins(admin_id) ON DELETE CASCADE,
      FOREIGN KEY (payer_admin_id) REFERENCES admins(admin_id) ON DELETE CASCADE,
      FOREIGN KEY (requester_wallet_id) REFERENCES wallets(wallet_id) ON DELETE CASCADE,
      FOREIGN KEY (payer_wallet_id) REFERENCES wallets(wallet_id) ON DELETE CASCADE,
      CHECK (
        (requester_user_id IS NOT NULL AND requester_admin_id IS NULL) OR
        (requester_user_id IS NULL AND requester_admin_id IS NOT NULL)
      ),
      CHECK (
        (payer_user_id IS NOT NULL AND payer_admin_id IS NULL) OR
        (payer_user_id IS NULL AND payer_admin_id IS NOT NULL)
      )
    );
    INSERT INTO money_requests_new (
      request_id, requester_user_id, requester_admin_id, requester_wallet_id,
      payer_user_id, payer_admin_id, payer_wallet_id,
      amount, note, status, payment_method, created_at, updated_at, responded_at, paid_at
    )
    SELECT
      request_id, requester_user_id, NULL, requester_wallet_id,
      payer_user_id, NULL, payer_wallet_id,
      amount, note, status, payment_method, created_at, updated_at, responded_at, paid_at
    FROM money_requests;
    DROP TABLE money_requests;
    ALTER TABLE money_requests_new RENAME TO money_requests;
  `);
}

function resolveReceiverWallet({ receiverWalletId, receiverUpiId, receiverPhone }) {
  const walletId = String(receiverWalletId || "").trim();
  const upiId = String(receiverUpiId || "").trim();
  const phoneRaw = String(receiverPhone || "").trim();
  const modes = [walletId, upiId, phoneRaw].filter(Boolean).length;
  if (modes !== 1) throw new Error("Use exactly one of Wallet ID, UPI ID, or phone number.");

  if (phoneRaw) {
    const last10 = normalizePhone(phoneRaw);
    const wallet = db.prepare(`
      SELECT w.* FROM wallets w
      INNER JOIN users u ON u.user_id = w.user_id
      WHERE w.wallet_status = 'active'
        AND (
          u.phone_number = ?
          OR u.phone_number = ?
          OR u.phone_number LIKE '%' || ?
        )
    `).get(last10, `+91${last10}`, last10);
    if (!wallet) throw new Error("No registered user found for this phone number.");
    return wallet;
  }

  if (upiId) {
    const wallet = db.prepare(`
      SELECT w.* FROM wallets w
      INNER JOIN users u ON u.user_id = w.user_id
      WHERE LOWER(u.upi_id) = LOWER(?) AND w.wallet_status = 'active'
    `).get(upiId);
    if (!wallet) throw new Error("No registered user found for this UPI ID.");
    return wallet;
  }

  const wallet = db.prepare(`
    SELECT w.* FROM wallets w
    INNER JOIN users u ON u.user_id = w.user_id
    WHERE w.wallet_id = ? AND w.wallet_status = 'active'
  `).get(walletId);
  if (!wallet) throw new Error("Receiver must be a registered user's Wallet ID.");
  return wallet;
}

function deleteTransactionsForWallet(walletId) {
  if (!walletId) return 0;
  return db.prepare(`
    DELETE FROM transactions
    WHERE wallet_id = ? OR sender_wallet_id = ? OR receiver_wallet_id = ?
  `).run(walletId, walletId, walletId).changes;
}

function runAdminDelete(table, id) {
  switch (table) {
    case "users": {
      const user = db.prepare("SELECT id, user_id, email FROM users WHERE id = ?").get(id);
      if (!user) throw new Error("User not found.");
      const wallet = db.prepare("SELECT wallet_id FROM wallets WHERE user_id = ?").get(user.user_id);
      const walletId = wallet?.wallet_id;
      const transactions = deleteTransactionsForWallet(walletId);
      const wallet_qr = walletId ? db.prepare("DELETE FROM wallet_qr WHERE wallet_id = ?").run(walletId).changes : 0;
      let wallets = 0;
      if (walletId) {
        wallets = db.prepare("DELETE FROM wallets WHERE wallet_id = ?").run(walletId).changes;
        if (!wallets) wallets = db.prepare("DELETE FROM wallets WHERE user_id = ?").run(user.user_id).changes;
        if (!wallets) throw new Error("Could not delete wallet for this user.");
      }
      const notifications = db.prepare("DELETE FROM notifications WHERE user_id = ?").run(user.user_id).changes;
      const users = db.prepare("DELETE FROM users WHERE id = ?").run(id).changes;
      if (!users) throw new Error("User could not be deleted.");
      return { table: "users", users, wallets, wallet_qr, transactions, notifications };
    }
    case "admins": {
      const admin = db.prepare("SELECT id, admin_id, email FROM admins WHERE id = ?").get(id);
      if (!admin) throw new Error("Admin not found.");
      if (isAdminEmail(admin.email)) throw new Error("Primary admin account cannot be deleted.");
      const wallet = db.prepare("SELECT wallet_id FROM wallets WHERE admin_id = ?").get(admin.admin_id);
      const walletId = wallet?.wallet_id;
      const transactions = deleteTransactionsForWallet(walletId);
      const wallet_qr = walletId ? db.prepare("DELETE FROM wallet_qr WHERE wallet_id = ?").run(walletId).changes : 0;
      const wallets = walletId ? db.prepare("DELETE FROM wallets WHERE admin_id = ?").run(admin.admin_id).changes : 0;
      const admins = db.prepare("DELETE FROM admins WHERE id = ?").run(id).changes;
      if (!admins) throw new Error("Admin could not be deleted.");
      return { table: "admins", admins, wallets, wallet_qr, transactions };
    }
    case "wallets": {
      const wallet = db.prepare("SELECT id, wallet_id, user_id, admin_id FROM wallets WHERE id = ?").get(id);
      if (!wallet) throw new Error("Wallet not found.");
      if (wallet.admin_id) {
        const admin = db.prepare("SELECT email FROM admins WHERE admin_id = ?").get(wallet.admin_id);
        if (isAdminEmail(admin?.email)) throw new Error("Primary admin wallet cannot be deleted.");
      }
      const transactions = deleteTransactionsForWallet(wallet.wallet_id);
      const wallet_qr = db.prepare("DELETE FROM wallet_qr WHERE wallet_id = ?").run(wallet.wallet_id).changes;
      const wallets = db.prepare("DELETE FROM wallets WHERE id = ?").run(id).changes;
      if (!wallets) throw new Error("Wallet could not be deleted.");
      return { table: "wallets", wallets, wallet_qr, transactions };
    }
    case "wallet_qr": {
      const wallet_qr = db.prepare("DELETE FROM wallet_qr WHERE id = ?").run(id).changes;
      if (!wallet_qr) throw new Error("Wallet QR row not found.");
      return { table: "wallet_qr", wallet_qr };
    }
    case "transactions": {
      const transactions = db.prepare("DELETE FROM transactions WHERE id = ?").run(id).changes;
      if (!transactions) throw new Error("Transaction not found.");
      return { table: "transactions", transactions };
    }
    case "notifications": {
      const notifications = db.prepare("DELETE FROM notifications WHERE id = ?").run(id).changes;
      if (!notifications) throw new Error("Notification not found.");
      return { table: "notifications", notifications };
    }
    default:
      throw new Error("This table cannot be deleted from admin.");
  }
}

function adminDeleteRow(table, rowId) {
  const id = Number(rowId);
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid row id.");
  const fkWasOn = db.pragma("foreign_keys", { simple: true });
  db.pragma("foreign_keys = OFF");
  try {
    return db.transaction(() => runAdminDelete(table, id))();
  } finally {
    db.pragma(`foreign_keys = ${fkWasOn ? "ON" : "OFF"}`);
  }
}

module.exports = {
  db,
  setupDatabase,
  createWalletQr,
  uid,
  walletIdFor,
  adminWalletIdFor,
  notify,
  notifyAdmin,
  createNotification,
  currentUser,
  currentAdmin,
  getWalletByAuth,
  resolveReceiverWallet,
  getBillSettlementWalletId,
  adminDeleteRow,
  buildUpiId,
  isAdult,
  isAdminEmail,
  isKycVerifiedForUser,
  validateTransactionPin,
  verifyWalletPin,
  assertWalletActive,
  repairUserWalletAssets,
  normalizeEmail,
  normalizePhone,
  normalizeUpiHandle,
  purgeAdminShadowUsers,
  UPI_HANDLES,
  PROTECTED_ADMIN_EMAIL
};
