const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const {
  db, setupDatabase, createWalletQr, uid, walletIdFor, notify, notifyAdmin, currentUser, currentAdmin,
  getWalletByAuth, resolveReceiverWallet, getBillSettlementWalletId, adminDeleteRow, buildUpiId, isAdult, isAdminEmail,
  validateTransactionPin, verifyWalletPin, assertWalletActive, repairUserWalletAssets, normalizeEmail, normalizeUpiHandle,
  UPI_HANDLES, PROTECTED_ADMIN_EMAIL, adminWalletIdFor, isKycVerifiedForUser
} = require("./db");

const { registerComplaintRoutes } = require("./complaintsRoutes");
const { setComplaintStatus, FORGOT_PIN_CATEGORY } = require("./complaintsService");
const {
  createMoneyRequestFromAuth,
  listMoneyRequestsForAuth,
  respondToMoneyRequest,
  payMoneyRequest,
  cancelMoneyRequest
} = require("./moneyRequestsService");
const { sendOtp, verifyOtp, isOtpVerified, clearOtp } = require("./otpService");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-wallet-secret-change-me";

/* Landing page first */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/home.html"));
});

/* Auth / app portal */
app.get("/portal", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.use(express.static(path.join(__dirname, "../public")));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());




function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function setAuthCookie(res, payload) {
  res.cookie("token", signToken(payload), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function auth(requiredRole) {
  return (req, res, next) => {
    try {
      const token = req.cookies.token || (req.headers.authorization || "").replace("Bearer ", "");
      const payload = jwt.verify(token, JWT_SECRET);
      if (requiredRole && payload.role !== requiredRole) {
        return res.status(403).json({ error: payload.role === "admin" ? "Use Admin login." : "Use User login." });
      }
      req.auth = payload;
      next();
    } catch {
      res.status(401).json({ error: "Please log in again." });
    }
  };
}

function authWallet(req, res, next) {
  try {
    const token = req.cookies.token || (req.headers.authorization || "").replace("Bearer ", "");
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== "user" && payload.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (payload.role === "user" && !payload.userId) return res.status(401).json({ error: "Please log in again." });
    if (payload.role === "admin" && !payload.adminId) return res.status(401).json({ error: "Please log in again." });
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: "Please log in again." });
  }
}

function requireUserKyc(req, res, next) {
  if (req.auth.role === "admin") return next();
  if (!isKycVerifiedForUser(req.auth.userId)) {
    const row = db.prepare("SELECT kyc_status FROM users WHERE user_id = ?").get(req.auth.userId);
    const status = row?.kyc_status || "pending";
    return res.status(403).json({
      error: `KYC must be verified before transactions. Your status: ${status}.`
    });
  }
  next();
}

registerComplaintRoutes(app, { auth });

app.post("/api/auth/otp/send", async (req, res) => {
  try {
    const { channel, target, purpose } = req.body || {};
    if (!channel || !target) return res.status(400).json({ error: "Channel and target are required." });

    if ((purpose || "signup") === "signup" && channel === "email") {
      const emailNorm = normalizeEmail(target);
      if (isAdminEmail(emailNorm)) {
        return res.status(409).json({ error: "This email is reserved for admin login only." });
      }
      if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(emailNorm)) {
        return res.status(409).json({ error: "This email is already registered. Try logging in instead." });
      }
      if (db.prepare("SELECT 1 FROM admins WHERE email = ?").get(emailNorm)) {
        return res.status(409).json({ error: "This email is already used by an administrator." });
      }
    }

    const result = await sendOtp({ channel, target, purpose: purpose || "signup" });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/auth/otp/verify", (req, res) => {
  try {
    const { channel, target, code, purpose } = req.body || {};
    const result = verifyOtp({ channel, target, code, purpose: purpose || "signup" });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/auth/forgot-password/send", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: "Email is required." });
    const user = db.prepare("SELECT user_id FROM users WHERE email = ?").get(email);
    if (!user) {
      return res.json({ ok: true, message: "If this email is registered, an OTP has been sent." });
    }
    const result = await sendOtp({ channel: "email", target: email, purpose: "reset_password" });
    res.json({ ok: true, message: result.delivery_hint, dev_otp: result.dev_otp });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/auth/forgot-password/reset", (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const { code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "Email, OTP and new password are required." });
    }
    if (String(newPassword).length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
    const user = db.prepare("SELECT user_id FROM users WHERE email = ?").get(email);
    if (!user) return res.status(400).json({ error: "Invalid reset request." });
    verifyOtp({ channel: "email", target: email, code, purpose: "reset_password" });
    db.prepare("UPDATE users SET password_hash = ?, password_plain = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
      .run(bcrypt.hashSync(String(newPassword), 12), String(newPassword), user.user_id);
    clearOtp("email", email, "reset_password");
    notify(user.user_id, "Password reset", "Your login password was reset successfully.", "security");
    res.json({ ok: true, message: "Password updated. You can log in now." });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

function profileForAuth(auth) {
  return auth.role === "admin" ? currentAdmin(auth.adminId) : currentUser(auth.userId);
}

function buildBillReceiverWalletId(billType, provider) {
  const typeMap = {
    "Electricity Board": "Electricity",
    "Water Tax": "Water",
    DTH: "DTH",
    Broadband: "Broadband"
  };
  const prefix = typeMap[billType] || String(billType || "Bill").replace(/\s+/g, "");
  const prov = String(provider || "").trim().replace(/\s+/g, "");
  return prov ? `${prefix}_${prov}` : prefix;
}

function moneyToPaise(value, { allowZero = false } = {}) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error("Amount must be a valid number.");
  if (allowZero) {
    if (amount < 0) throw new Error("Amount cannot be negative.");
    return Math.round(amount * 100);
  }
  if (amount <= 0) throw new Error("Amount must be greater than 0.");
  return Math.round(amount * 100);
}

function paiseToMoney(paise) {
  return Number((paise / 100).toFixed(2));
}

function notifyAuthParty(auth, title, message, notificationType = "transaction") {
  if (auth.role === "user") return notify(auth.userId, title, message, notificationType);
  if (auth.role === "admin") return notifyAdmin(auth.adminId, title, message, notificationType);
  return null;
}

function pickBody(body, ...keys) {
  for (const key of keys) {
    const value = body[key];
    if (value != null && String(value).trim() !== "") return value;
  }
  return undefined;
}

const ADMIN_INSERT_TABLES = new Set(["users", "admins", "wallets", "wallet_qr", "transactions", "notifications"]);

async function adminInsertRow(table, body) {
  switch (table) {
    case "admins": {
      const name = String(pickBody(body, "name") || "").trim();
      const email = normalizeEmail(pickBody(body, "email"));
      const password = pickBody(body, "password_plain", "password");
      const pinValue = validateTransactionPin(pickBody(body, "transaction_pin_plain", "transactionPin"));
      if (!name || !email || !password) throw new Error("Name, email and password are required.");
      if (db.prepare("SELECT 1 FROM admins WHERE email = ?").get(email)) throw new Error("Admin email already exists.");
      if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) throw new Error("Email already used by a user.");
      const adminId = pickBody(body, "admin_id") || uid("ADM");
      const walletId = pickBody(body, "wallet_id") || adminWalletIdFor(name);
      const balance = body.balance != null && body.balance !== "" ? moneyToPaise(body.balance) : 0;
      const currency = pickBody(body, "currency") || "INR";
      const walletStatus = pickBody(body, "wallet_status") || "active";
      db.transaction(() => {
        db.prepare(`
          INSERT INTO admins (admin_id, name, email, password_hash, password_plain)
          VALUES (?, ?, ?, ?, ?)
        `).run(adminId, name, email, bcrypt.hashSync(String(password), 12), String(password));
        db.prepare(`
          INSERT INTO wallets (wallet_id, admin_id, balance, currency, wallet_status, transaction_pin_hash, transaction_pin_plain)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(walletId, adminId, balance, currency, walletStatus, bcrypt.hashSync(pinValue, 12), pinValue);
      })();
      await createWalletQr(walletId);
      return { admin_id: adminId, wallet_id: walletId };
    }
    case "users": {
      const name = String(pickBody(body, "full_name", "name") || "").trim();
      const email = normalizeEmail(pickBody(body, "email"));
      const phone = String(pickBody(body, "phone_number", "phone") || "").trim();
      const password = pickBody(body, "password_plain", "password");
      const transactionPin = pickBody(body, "transaction_pin_plain", "transactionPin");
      const bankAccountNo = pickBody(body, "bank_account_no", "bankAccountNo");
      const bankName = pickBody(body, "bank_name", "bankName");
      const dob = pickBody(body, "date_of_birth", "dob");
      if (!name || !email || !phone || !password || !transactionPin || !bankAccountNo || !bankName || !dob) {
        throw new Error("Name, email, phone, DOB, bank details, password and transaction PIN are required.");
      }
      if (!isAdult(dob)) throw new Error("User must be at least 18 years old.");
      if (isAdminEmail(email)) throw new Error("Email conflicts with admin account.");
      const pinValue = validateTransactionPin(transactionPin);
      const upiId = pickBody(body, "upi_id") || buildUpiId(phone, pickBody(body, "upi_handle") || "@ybl");
      const handle = normalizeUpiHandle(pickBody(body, "upi_handle") || "@ybl");
      const userId = pickBody(body, "user_id") || uid("USR");
      const walletId = pickBody(body, "wallet_id") || walletIdFor(name, phone);
      const create = db.transaction(() => {
        db.prepare(`
          INSERT INTO users (user_id, full_name, email, phone_number, password_hash, password_plain,
            bank_account_no, bank_name, upi_id, upi_handle, address, date_of_birth, gender, kyc_status, account_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          userId, name, email, phone, bcrypt.hashSync(String(password), 12), String(password),
          String(bankAccountNo).trim(), String(bankName).trim(), upiId, handle,
          pickBody(body, "address") || "", dob, pickBody(body, "gender") || "",
          pickBody(body, "kyc_status") || "pending", pickBody(body, "account_status") || "active"
        );
        db.prepare(`
          INSERT INTO wallets (wallet_id, user_id, balance, currency, wallet_status, transaction_pin_hash, transaction_pin_plain)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          walletId, userId,
          body.balance != null && body.balance !== "" ? moneyToPaise(body.balance) : 0,
          pickBody(body, "currency") || "INR",
          pickBody(body, "wallet_status") || "active",
          bcrypt.hashSync(pinValue, 12), pinValue
        );
        return notify(userId, "Wallet created by admin", `Wallet ${walletId} and UPI ${upiId} are ready.`, "system");
      });
      create();
      await createWalletQr(walletId);
      return { user_id: userId, wallet_id: walletId, upi_id: upiId };
    }
    case "wallets": {
      const userId = pickBody(body, "user_id") || null;
      const adminId = pickBody(body, "admin_id") || null;
      if (Boolean(userId) === Boolean(adminId)) {
        throw new Error("Set exactly one of user_id or admin_id (not both).");
      }
      const pinValue = validateTransactionPin(pickBody(body, "transaction_pin_plain", "transactionPin"));
      let walletId = pickBody(body, "wallet_id");
      if (!walletId) {
        if (userId) {
          const user = db.prepare("SELECT full_name, phone_number FROM users WHERE user_id = ?").get(userId);
          if (!user) throw new Error("User not found for user_id.");
          walletId = walletIdFor(user.full_name, user.phone_number);
        } else {
          const admin = db.prepare("SELECT name FROM admins WHERE admin_id = ?").get(adminId);
          if (!admin) throw new Error("Admin not found for admin_id.");
          walletId = adminWalletIdFor(admin.name);
        }
      }
      const balance = body.balance != null && body.balance !== "" ? moneyToPaise(body.balance) : 0;
      db.prepare(`
        INSERT INTO wallets (wallet_id, user_id, admin_id, balance, currency, wallet_status,
          daily_limit, monthly_limit, transaction_pin_hash, transaction_pin_plain)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        walletId, userId, adminId, balance,
        pickBody(body, "currency") || "INR",
        pickBody(body, "wallet_status") || "active",
        Number(pickBody(body, "daily_limit")) || 1000000,
        Number(pickBody(body, "monthly_limit")) || 10000000,
        bcrypt.hashSync(pinValue, 12), pinValue
      );
      return { wallet_id: walletId };
    }
    case "wallet_qr": {
      const walletId = pickBody(body, "wallet_id");
      if (!walletId) throw new Error("wallet_id is required.");
      if (!db.prepare("SELECT 1 FROM wallets WHERE wallet_id = ?").get(walletId)) {
        throw new Error("Wallet not found.");
      }
      const payload = pickBody(body, "qr_code_value", "qr_code");
      if (!payload) {
        await createWalletQr(walletId);
        return { wallet_id: walletId };
      }
      const QRCode = require("qrcode");
      const qrId = pickBody(body, "qr_id") || uid("QR");
      const qrImage = await QRCode.toDataURL(payload, { margin: 1, width: 240 });
      const expiryDate = pickBody(body, "expiry_date") || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      db.prepare(`
        INSERT INTO wallet_qr (qr_id, wallet_id, qr_code_value, qr_image_url, qr_type, expiry_date, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        qrId, walletId, payload, qrImage,
        pickBody(body, "qr_type") || "payment",
        expiryDate,
        pickBody(body, "is_active") != null ? (Number(body.is_active) ? 1 : 0) : 1
      );
      return { qr_id: qrId, wallet_id: walletId };
    }
    case "transactions": {
      const walletId = pickBody(body, "wallet_id");
      if (!walletId) throw new Error("wallet_id is required.");
      if (!db.prepare("SELECT 1 FROM wallets WHERE wallet_id = ?").get(walletId)) {
        throw new Error("Wallet not found.");
      }
      const amount = moneyToPaise(pickBody(body, "amount"));
      const transactionId = pickBody(body, "transaction_id") || uid("TRX");
      const type = pickBody(body, "transaction_type") || "manual";
      db.prepare(`
        INSERT INTO transactions (transaction_id, wallet_id, sender_wallet_id, receiver_wallet_id,
          transaction_type, amount, transaction_fee, previous_balance, current_balance,
          payment_method, reference_number, remarks, transaction_status, notification_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        transactionId,
        walletId,
        pickBody(body, "sender_wallet_id") || null,
        pickBody(body, "receiver_wallet_id") || null,
        type,
        amount,
        Number(pickBody(body, "transaction_fee")) || 0,
        body.previous_balance != null && body.previous_balance !== "" ? moneyToPaise(body.previous_balance) : null,
        body.current_balance != null && body.current_balance !== "" ? moneyToPaise(body.current_balance) : null,
        pickBody(body, "payment_method") || null,
        pickBody(body, "reference_number") || null,
        pickBody(body, "remarks") || null,
        pickBody(body, "transaction_status") || "success",
        pickBody(body, "notification_id") || null
      );
      return { transaction_id: transactionId };
    }
    case "notifications": {
      const userId = pickBody(body, "user_id") || null;
      const adminId = pickBody(body, "admin_id") || null;
      if (Boolean(userId) === Boolean(adminId)) {
        throw new Error("Set exactly one of user_id or admin_id.");
      }
      const title = pickBody(body, "title");
      const message = pickBody(body, "message");
      if (!title || !message) throw new Error("Title and message are required.");
      const notificationId = pickBody(body, "notification_id") || uid("NTF");
      db.prepare(`
        INSERT INTO notifications (notification_id, user_id, admin_id, title, message, notification_type, is_read)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        notificationId, userId, adminId, title, message,
        pickBody(body, "notification_type") || "transaction",
        Number(pickBody(body, "is_read")) ? 1 : 0
      );
      return { notification_id: notificationId };
    }
    default:
      throw new Error("Unknown table.");
  }
}

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, phone, password, bankAccountNo, bankName, address, dob, transactionPin, gender, upiHandle } = req.body;
    const emailNorm = normalizeEmail(email);
    if (!name || !email || !phone || !password || !transactionPin || !bankAccountNo || !bankName || !dob || !gender || !address) {
      return res.status(400).json({ error: "Name, gender, address, email, phone, DOB, bank name, bank account no., password and transaction PIN are required." });
    }
    if (!isOtpVerified("email", emailNorm, "signup")) {
      return res.status(400).json({ error: "Verify your email with OTP before signing up." });
    }
    if (!isOtpVerified("phone", phone, "signup")) {
      return res.status(400).json({ error: "Verify your phone number with OTP before signing up." });
    }
    if (!isAdult(dob)) return res.status(400).json({ error: "You must be at least 18 years old to register." });
    if (isAdminEmail(emailNorm)) return res.status(400).json({ error: "This email is reserved for admin login only." });
    if (db.prepare("SELECT 1 FROM admins WHERE email = ?").get(emailNorm)) {
      return res.status(409).json({ error: "This email is already used by an administrator." });
    }
    const pinValue = validateTransactionPin(transactionPin);

    const upiId = buildUpiId(phone, upiHandle);
    const handle = normalizeUpiHandle(upiHandle);
    const userId = uid("USR");
    const walletId = walletIdFor(name, phone);
    const create = db.transaction(() => {
      db.prepare(`
        INSERT INTO users (user_id, full_name, email, phone_number, password_hash, password_plain,
          bank_account_no, bank_name, upi_id, upi_handle, address, date_of_birth, gender, kyc_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId, name.trim(), emailNorm, phone.trim(), bcrypt.hashSync(password, 12), String(password),
        String(bankAccountNo).trim(), String(bankName).trim(), upiId, handle, address || "", dob, gender || "", "pending"
      );
      db.prepare(`
        INSERT INTO wallets (wallet_id, user_id, balance, transaction_pin_hash, transaction_pin_plain)
        VALUES (?, ?, ?, ?, ?)
      `).run(walletId, userId, 0, bcrypt.hashSync(pinValue, 12), pinValue);
      return notify(userId, "Wallet created", `WELCOME ${name}! Your wallet ${walletId} and UPI ID ${upiId} are ready.`, "system");
    });
    const notificationId = create();
    await createWalletQr(walletId);
    clearOtp("email", emailNorm, "signup");
    clearOtp("phone", phone, "signup");
    setAuthCookie(res, { role: "user", userId });
    res.status(201).json({ user: currentUser(userId), notification_id: notificationId });
  } catch (error) {
    const message = String(error.message || "");
    if (message.includes("UNIQUE")) return res.status(409).json({ error: "Email, phone, bank account or UPI ID already exists." });
    res.status(400).json({ error: message || "Could not create account." });
  }
});

app.post("/api/auth/admin/login", (req, res) => {
  const { email, password } = req.body;
  const emailNorm = normalizeEmail(email);
  const record = db.prepare("SELECT * FROM admins WHERE email = ?").get(emailNorm);
  if (!record || !bcrypt.compareSync(password || "", record.password_hash)) {
    return res.status(401).json({ error: "Invalid admin credentials." });
  }
  setAuthCookie(res, { role: "admin", adminId: record.admin_id });
  return res.json({
    role: "admin",
    admin: { admin_id: record.admin_id, name: record.name, email: record.email },
    user: currentAdmin(record.admin_id)
  });
});

app.post("/api/auth/user/login", (req, res) => {
  const { email, password } = req.body;
  const emailNorm = normalizeEmail(email);
  if (isAdminEmail(emailNorm)) {
    return res.status(403).json({ error: "This account uses Admin login only. Switch to the Admin tab." });
  }
  const record = db.prepare("SELECT * FROM users WHERE email = ?").get(emailNorm);
  if (!record || !bcrypt.compareSync(password || "", record.password_hash)) {
    return res.status(401).json({ error: "Invalid user credentials." });
  }
  setAuthCookie(res, { role: "user", userId: record.user_id });
  res.json({ role: "user", user: currentUser(record.user_id) });
});

app.post("/api/auth/login", (req, res) => {
  res.status(400).json({ error: "Use User login or Admin login separately." });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

app.get("/api/session", (req, res) => {
  try {
    const payload = jwt.verify(req.cookies.token, JWT_SECRET);
    if (payload.role === "admin") {
      const admin = db.prepare("SELECT admin_id, name, email FROM admins WHERE admin_id = ?").get(payload.adminId);
      return res.json({ role: "admin", admin, user: currentAdmin(payload.adminId) });
    }
    if (payload.role === "user") {
      return res.json({ role: "user", user: currentUser(payload.userId) });
    }
    res.json({ role: "guest" });
  } catch {
    res.json({ role: "guest" });
  }
});

app.get("/api/me", authWallet, async (req, res) => {
  try {
    if (req.auth.role === "user") await repairUserWalletAssets(req.auth.userId);
    const user = profileForAuth(req.auth);
    if (!user?.wallet_id) {
      return res.status(404).json({ error: "Wallet not found for this account. Please contact support." });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not load wallet profile." });
  }
});

app.get("/api/meta/upi-handles", (req, res) => res.json({ handles: UPI_HANDLES }));

app.patch("/api/me", authWallet, (req, res) => {
  if (req.auth.role === "admin") {
    return res.status(400).json({ error: "Admin profile fields are managed in the Admins table." });
  }
  const { name, phone, address, dob, gender } = req.body;
  // Updated to use new schema field names
  db.prepare(`
    UPDATE users SET full_name = COALESCE(?, full_name), phone_number = COALESCE(?, phone_number),
      address = COALESCE(?, address), date_of_birth = COALESCE(?, date_of_birth), gender = COALESCE(?, gender), updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(name || null, phone || null, address || null, dob || null, gender || null, req.auth.userId);
  res.json({ user: currentUser(req.auth.userId) });
});

app.patch("/api/me/password", authWallet, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (req.auth.role === "admin") {
    const admin = db.prepare("SELECT password_hash FROM admins WHERE admin_id = ?").get(req.auth.adminId);
    if (!admin || !bcrypt.compareSync(currentPassword || "", admin.password_hash)) {
      return res.status(400).json({ error: "Current password is wrong." });
    }
    db.prepare("UPDATE admins SET password_hash = ?, password_plain = ?, updated_at = CURRENT_TIMESTAMP WHERE admin_id = ?")
      .run(bcrypt.hashSync(newPassword, 12), String(newPassword), req.auth.adminId);
    return res.json({ ok: true, user: currentAdmin(req.auth.adminId) });
  }
  const user = db.prepare("SELECT password_hash FROM users WHERE user_id = ?").get(req.auth.userId);
  if (!user || !bcrypt.compareSync(currentPassword || "", user.password_hash)) return res.status(400).json({ error: "Current password is wrong." });
  db.prepare("UPDATE users SET password_hash = ?, password_plain = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(bcrypt.hashSync(newPassword, 12), String(newPassword), req.auth.userId);
  notify(req.auth.userId, "Password changed", "Your login password was updated.", "security");
  res.json({ ok: true, user: currentUser(req.auth.userId) });
});

app.patch("/api/me/pin", authWallet, (req, res) => {
  try {
    const wallet = getWalletByAuth(req.auth);
    verifyWalletPin(wallet, req.body.currentPin);
    const newPinValue = validateTransactionPin(req.body.newPin);
    db.prepare("UPDATE wallets SET transaction_pin_hash = ?, transaction_pin_plain = ?, updated_at = CURRENT_TIMESTAMP WHERE wallet_id = ?")
      .run(bcrypt.hashSync(newPinValue, 12), newPinValue, wallet.wallet_id);
    notifyAuthParty(req.auth, "PIN changed", "Your wallet transaction PIN was updated.", "security");
    res.json({ ok: true, user: profileForAuth(req.auth) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/api/me/pin/reset-after-forgot", authWallet, (req, res) => {
  try {
    if (req.auth.role !== "user") {
      return res.status(403).json({ error: "Only user accounts can reset PIN this way." });
    }
    const user = db.prepare("SELECT pin_reset_allowed FROM users WHERE user_id = ?").get(req.auth.userId);
    if (!user?.pin_reset_allowed) {
      return res.status(403).json({
        error: "PIN reset not approved yet. Submit a forgot-PIN request and wait for admin review."
      });
    }
    const newPin = req.body.newPin || req.body.new_pin;
    const confirmPin = req.body.confirmPin || req.body.confirm_pin;
    if (!newPin || !confirmPin) return res.status(400).json({ error: "Enter and confirm your new PIN." });
    if (String(newPin) !== String(confirmPin)) return res.status(400).json({ error: "PIN and confirmation do not match." });
    const newPinValue = validateTransactionPin(newPin);
    const wallet = getWalletByAuth(req.auth);
    db.prepare("UPDATE wallets SET transaction_pin_hash = ?, transaction_pin_plain = ?, updated_at = CURRENT_TIMESTAMP WHERE wallet_id = ?")
      .run(bcrypt.hashSync(newPinValue, 12), newPinValue, wallet.wallet_id);

    const openComplaint = db.prepare(`
      SELECT * FROM complaints
      WHERE user_id = ? AND category = ? AND status NOT IN ('REJECTED', 'CLOSED', 'RESOLVED')
      ORDER BY datetime(created_at) DESC LIMIT 1
    `).get(req.auth.userId, FORGOT_PIN_CATEGORY);
    if (openComplaint) {
      setComplaintStatus(openComplaint, "RESOLVED", { type: "user", id: req.auth.userId });
    }

    db.prepare("UPDATE users SET pin_reset_allowed = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(req.auth.userId);
    notify(req.auth.userId, "PIN reset complete", "Your new transaction PIN is now active.", "security");
    res.json({ ok: true, user: currentUser(req.auth.userId) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Enhanced transaction recording with notification_id linkage
function recordTransaction({ type, amount, senderWalletId, receiverWalletId, walletId, fee, prevBalance, currBalance, paymentMethod, referenceNumber, note, status, notificationId = null }) {
  const trxnId = uid("TRX");

  db.prepare(`
    INSERT INTO transactions (transaction_id, wallet_id, sender_wallet_id, receiver_wallet_id, transaction_type, amount, 
      transaction_fee, previous_balance, current_balance, payment_method, reference_number, remarks, transaction_status, notification_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(trxnId, walletId || null, senderWalletId || null, receiverWalletId || null, type, amount, 
    fee || 0, prevBalance || null, currBalance || null, paymentMethod || null, referenceNumber || null, note || null, status || 'success', notificationId);
  
  return { trxnId, notificationId };
}

app.post("/api/wallet/topup", authWallet, requireUserKyc, (req, res) => {
  try {
    const amount = moneyToPaise(req.body.amount);
    const wallet = getWalletByAuth(req.auth);
    if (!wallet) return res.status(404).json({ error: "Wallet not found." });
    assertWalletActive(wallet);
    verifyWalletPin(wallet, req.body.pin);
    const prevBalance = wallet.balance;
    const trxn = db.transaction(() => {
      db.prepare("UPDATE wallets SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE wallet_id = ?").run(amount, wallet.wallet_id);
      const newBalance = prevBalance + amount;
      const notificationId = notifyAuthParty(
        req.auth,
        "Wallet topped up",
        `You added Rs ${paiseToMoney(amount)} to ${wallet.wallet_id}.`,
        "transaction"
      );
      const { trxnId } = recordTransaction({
        type: "top up wallet",
        amount,
        receiverWalletId: wallet.wallet_id,
        walletId: wallet.wallet_id,
        prevBalance,
        currBalance: newBalance,
        paymentMethod: req.body.paymentMethod || req.body.payment_source || "upi",
        note: req.body.note || "Payment gateway top up",
        notificationId
      });
      return { trxnId, notificationId };
    });
    const result = trxn();
    res.json({ trxn_id: result.trxnId, notification_id: result.notificationId, user: profileForAuth(req.auth) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/wallet/send", authWallet, requireUserKyc, (req, res) => {
  try {
    const amount = moneyToPaise(req.body.amount);
    const { receiverWalletId, receiverUpiId, receiverPhone, note } = req.body;
    const sender = getWalletByAuth(req.auth);
    if (!sender) return res.status(404).json({ error: "Sender wallet not found." });
    assertWalletActive(sender);
    verifyWalletPin(sender, req.body.pin);
    const receiver = resolveReceiverWallet({ receiverWalletId, receiverUpiId, receiverPhone });
    if (receiver.wallet_id === sender.wallet_id) return res.status(400).json({ error: "You cannot send money to your own wallet." });
    if (sender.balance < amount) return res.status(400).json({ error: "Insufficient wallet balance." });

    const receiverUser = db.prepare("SELECT user_id, full_name, upi_id, phone_number FROM users WHERE user_id = ?").get(receiver.user_id);
    const senderPrevBalance = sender.balance;
    const receiverPrevBalance = receiver.balance;

    const trxn = db.transaction(() => {
      db.prepare("UPDATE wallets SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE wallet_id = ?").run(amount, sender.wallet_id);
      db.prepare("UPDATE wallets SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE wallet_id = ?").run(amount, receiver.wallet_id);
      const senderNotificationId = notifyAuthParty(
        req.auth,
        "Money sent",
        `You sent Rs ${paiseToMoney(amount)} to ${receiverUser.upi_id || receiver.wallet_id}.`,
        "transaction"
      );
      const receiverNotificationId = notify(
        receiver.user_id,
        "Money received",
        `You received Rs ${paiseToMoney(amount)} from ${sender.wallet_id}.`,
        "transaction"
      );
      const { trxnId } = recordTransaction({
        type: "send money",
        amount,
        senderWalletId: sender.wallet_id,
        receiverWalletId: receiver.wallet_id,
        walletId: sender.wallet_id,
        prevBalance: senderPrevBalance,
        currBalance: senderPrevBalance - amount,
        paymentMethod: req.body.paymentMethod || req.body.payment_source || "wallet",
        note: note || "",
        notificationId: senderNotificationId
      });
      return { trxnId, notificationId: senderNotificationId, receiverNotificationId, receiverName: receiverUser.full_name };
    });
    const result = trxn();
    res.json({ ...result, user: profileForAuth(req.auth) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/wallet/pay-bill", authWallet, requireUserKyc, (req, res) => {
  try {
    const amount = moneyToPaise(req.body.amount);
    const billType = pickBody(req.body, "billType", "biller") || "Bill";
    const provider = pickBody(req.body, "provider") || "";
    const accountRef = pickBody(req.body, "accountRef", "account_ref") || "";
    const billerLabel = provider ? `${billType} — ${provider}` : billType;
    const billerRef = buildBillReceiverWalletId(billType, provider);
    const settlementWalletId = getBillSettlementWalletId();
    const wallet = getWalletByAuth(req.auth);
    if (!wallet) return res.status(404).json({ error: "Wallet not found." });
    assertWalletActive(wallet);
    verifyWalletPin(wallet, req.body.pin);
    if (wallet.balance < amount) return res.status(400).json({ error: "Insufficient wallet balance." });
    const prevBalance = wallet.balance;

    const trxn = db.transaction(() => {
      db.prepare("UPDATE wallets SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE wallet_id = ?").run(amount, wallet.wallet_id);
      db.prepare("UPDATE wallets SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE wallet_id = ?").run(amount, settlementWalletId);
      const notificationId = notifyAuthParty(
        req.auth,
        "Bill paid",
        `Paid Rs ${paiseToMoney(amount)} to ${billerLabel}.`,
        "transaction"
      );
      const { trxnId } = recordTransaction({
        type: "bill payment",
        amount,
        senderWalletId: wallet.wallet_id,
        receiverWalletId: settlementWalletId,
        walletId: wallet.wallet_id,
        prevBalance,
        currBalance: prevBalance - amount,
        paymentMethod: req.body.paymentMethod || "bill_payment",
        referenceNumber: accountRef || billerRef,
        note: `Payment to ${billerLabel} [${billerRef}]`,
        notificationId
      });
      return { trxnId, notificationId };
    });
    const result = trxn();
    res.json({ trxn_id: result.trxnId, notification_id: result.notificationId, user: profileForAuth(req.auth) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/transactions", authWallet, (req, res) => {
  const wallet = getWalletByAuth(req.auth);
  if (!wallet) return res.json({ transactions: [] });
  const rows = db.prepare(`
    SELECT transaction_id as trxn_id, wallet_id, sender_wallet_id, receiver_wallet_id, transaction_type as type, 
      amount, transaction_fee, previous_balance, current_balance, payment_method, reference_number, remarks,
      transaction_status as status, transaction_time, notification_id, created_at
    FROM transactions
    WHERE sender_wallet_id = ? OR receiver_wallet_id = ?
    ORDER BY datetime(created_at) DESC
  `).all(wallet.wallet_id, wallet.wallet_id);
  res.json({ transactions: rows.map((row) => ({ ...row, amount: paiseToMoney(row.amount) })) });
});

app.get("/api/wallet/money-requests", authWallet, requireUserKyc, (req, res) => {
  try {
    const requests = listMoneyRequestsForAuth(req.auth);
    res.json({ requests });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/wallet/money-requests", authWallet, requireUserKyc, (req, res) => {
  try {
    const amount = moneyToPaise(req.body.amount);
    const requesterWallet = getWalletByAuth(req.auth);
    if (!requesterWallet) return res.status(404).json({ error: "Wallet not found." });
    assertWalletActive(requesterWallet);

    const row = createMoneyRequestFromAuth(req.auth, req.body, amount);
    res.status(201).json({
      request: shapeMoneyRequestResponse(row),
      user: profileForAuth(req.auth)
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/api/wallet/money-requests/:id/respond", authWallet, requireUserKyc, (req, res) => {
  try {
    const action = String(req.body.action || "").toLowerCase();
    const updated = respondToMoneyRequest(req.params.id, req.auth, action);
    res.json({
      request: shapeMoneyRequestResponse(updated),
      user: profileForAuth(req.auth)
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/api/wallet/money-requests/:id/cancel", authWallet, requireUserKyc, (req, res) => {
  try {
    const updated = cancelMoneyRequest(req.params.id, req.auth);
    res.json({
      request: shapeMoneyRequestResponse(updated),
      user: profileForAuth(req.auth)
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/wallet/money-requests/:id/pay", authWallet, requireUserKyc, (req, res) => {
  try {
    const payerWallet = getWalletByAuth(req.auth);
    if (!payerWallet) return res.status(404).json({ error: "Wallet not found." });
    assertWalletActive(payerWallet);
    verifyWalletPin(payerWallet, req.body.pin);

    const paymentMethod = req.body.paymentMethod || req.body.payment_source || "upi";
    const payerPrev = payerWallet.balance;
    const updated = payMoneyRequest(req.params.id, req.auth, { paymentMethod });
    const amountPaise = updated.amount_paise;
    recordTransaction({
      type: "money request payment",
      amount: amountPaise,
      senderWalletId: payerWallet.wallet_id,
      receiverWalletId: updated.requester_wallet_id,
      walletId: payerWallet.wallet_id,
      prevBalance: payerPrev,
      currBalance: paymentMethod === "wallet" ? payerPrev - amountPaise : payerPrev,
      paymentMethod,
      note: `Paid request ${req.params.id}`,
      referenceNumber: req.params.id
    });
    res.json({
      request: shapeMoneyRequestResponse(updated),
      user: profileForAuth(req.auth)
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

function shapeMoneyRequestResponse(row) {
  if (!row) return row;
  return { ...row, amount: paiseToMoney(row.amount_paise) };
}

app.get("/api/notifications", authWallet, (req, res) => {
  const rows = req.auth.role === "admin"
    ? db.prepare(`
        SELECT notification_id, admin_id, title, message, notification_type, is_read, sent_at AS created_at, read_at
        FROM notifications WHERE admin_id = ? ORDER BY datetime(sent_at) DESC
      `).all(req.auth.adminId)
    : db.prepare(`
        SELECT notification_id, user_id, title, message, notification_type, is_read, sent_at AS created_at, read_at
        FROM notifications WHERE user_id = ? ORDER BY datetime(sent_at) DESC
      `).all(req.auth.userId);
  res.json({ notifications: rows });
});

app.get("/api/notifications/unread-count", authWallet, (req, res) => {
  const row = req.auth.role === "admin"
    ? db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE admin_id = ? AND is_read = 0").get(req.auth.adminId)
    : db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0").get(req.auth.userId);
  const supportRow = req.auth.role === "admin"
    ? db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE admin_id = ? AND is_read = 0 AND notification_type = 'support'").get(req.auth.adminId)
    : db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0 AND notification_type = 'support'").get(req.auth.userId);
  res.json({
    total: row?.count || 0,
    support: supportRow?.count || 0
  });
});

app.patch("/api/notifications/read", authWallet, (req, res) => {
  if (req.auth.role === "admin") {
    db.prepare("UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE admin_id = ?").run(req.auth.adminId);
  } else {
    db.prepare("UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(req.auth.userId);
  }
  res.json({ ok: true });
});

app.patch("/api/notifications/read/:id", authWallet, (req, res) => {
  if (req.auth.role === "admin") {
    db.prepare("UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE notification_id = ? AND admin_id = ?")
      .run(req.params.id, req.auth.adminId);
  } else {
    db.prepare("UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE notification_id = ? AND user_id = ?")
      .run(req.params.id, req.auth.userId);
  }
  res.json({ ok: true });
});

// Admin endpoints
app.get("/api/admin/overview", auth("admin"), (req, res) => {
  const totals = {
    admins: db.prepare("SELECT COUNT(*) AS count FROM admins").get().count,
    users: db.prepare("SELECT COUNT(*) AS count FROM users").get().count,
    wallets: db.prepare("SELECT COUNT(*) AS count FROM wallets").get().count,
    transactions: db.prepare("SELECT COUNT(*) AS count FROM transactions").get().count,
    notifications: db.prepare("SELECT COUNT(*) AS count FROM notifications").get().count,
    totalBalance: paiseToMoney(db.prepare("SELECT COALESCE(SUM(balance), 0) AS sum FROM wallets").get().sum)
  };
  res.json({ totals });
});

app.delete("/api/admin/:table/:id", auth("admin"), (req, res, next) => {
  const allowed = new Set(["users", "admins", "wallets", "wallet_qr", "transactions", "notifications"]);
  if (!allowed.has(req.params.table)) {
    return res.status(400).json({ error: "This table cannot be deleted from admin." });
  }
  try {
    if (typeof adminDeleteRow !== "function") {
      return res.status(500).json({ error: "Delete handler not loaded. Restart the server." });
    }
    const summary = adminDeleteRow(req.params.table, req.params.id);
    return res.json({ ok: true, summary });
  } catch (error) {
    console.error("Admin delete failed:", req.params.table, req.params.id, error);
    return next(error);
  }
});

app.patch("/api/admin/:table/:id", auth("admin"), (req, res) => {
  const editable = {
    users: ["full_name", "email", "phone_number", "password_plain", "bank_account_no", "bank_name", "upi_id", "upi_handle", "address", "date_of_birth", "gender", "kyc_status", "account_status"],
    admins: ["name", "email", "password_plain"],
    wallets: ["wallet_id", "user_id", "admin_id", "balance", "currency", "wallet_status", "daily_limit", "monthly_limit", "transaction_pin_plain"],
    wallet_qr: ["qr_id", "wallet_id", "qr_code_value", "qr_type", "expiry_date", "is_active"],
    transactions: ["transaction_id", "wallet_id", "sender_wallet_id", "receiver_wallet_id", "transaction_type", "amount", "transaction_fee", "previous_balance", "current_balance", "payment_method", "reference_number", "remarks", "transaction_status", "notification_id"],
    notifications: ["notification_id", "user_id", "admin_id", "title", "message", "notification_type", "is_read"]
  };
  const columns = editable[req.params.table];
  if (!columns) return res.status(400).json({ error: "Unknown table." });

  try {
    const rowId = Number(req.params.id);
    if (!Number.isInteger(rowId) || rowId < 1) {
      return res.status(400).json({ error: "Invalid row id." });
    }

    const body = { ...(req.body || {}) };
    if (body.password_plain === "" || body.password_plain == null) delete body.password_plain;
    if (body.transaction_pin_plain === "" || body.transaction_pin_plain == null) delete body.transaction_pin_plain;
    if (body.email) body.email = normalizeEmail(body.email);

    let changed = false;

    if (body.transaction_pin_plain) {
      const pinValue = validateTransactionPin(body.transaction_pin_plain);
      if (req.params.table === "users") {
        const user = db.prepare("SELECT user_id FROM users WHERE id = ?").get(rowId);
        if (user) {
          db.prepare("UPDATE wallets SET transaction_pin_hash = ?, transaction_pin_plain = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
            .run(bcrypt.hashSync(pinValue, 12), pinValue, user.user_id);
          changed = true;
        }
      }
      if (req.params.table === "admins") {
        const admin = db.prepare("SELECT admin_id FROM admins WHERE id = ?").get(rowId);
        if (admin) {
          db.prepare("UPDATE wallets SET transaction_pin_hash = ?, transaction_pin_plain = ?, updated_at = CURRENT_TIMESTAMP WHERE admin_id = ?")
            .run(bcrypt.hashSync(pinValue, 12), pinValue, admin.admin_id);
          changed = true;
        }
      }
      delete body.transaction_pin_plain;
    }

    if (body.balance != null && body.balance !== "" && (req.params.table === "users" || req.params.table === "admins")) {
      const balancePaise = moneyToPaise(body.balance, { allowZero: true });
      if (req.params.table === "users") {
        const user = db.prepare("SELECT user_id FROM users WHERE id = ?").get(rowId);
        if (user) {
          db.prepare("UPDATE wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(balancePaise, user.user_id);
          changed = true;
        }
      }
      if (req.params.table === "admins") {
        const admin = db.prepare("SELECT admin_id FROM admins WHERE id = ?").get(rowId);
        if (admin) {
          db.prepare("UPDATE wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE admin_id = ?").run(balancePaise, admin.admin_id);
          changed = true;
        }
      }
      delete body.balance;
    }

    const updates = Object.entries(body).filter(([key]) => columns.includes(key));
    const setParts = [];
    const values = [];

    updates.forEach(([key, value]) => {
      if (key === "balance" || key === "previous_balance" || key === "current_balance") {
        setParts.push(`${key} = ?`);
        values.push(moneyToPaise(value, { allowZero: true }));
        return;
      }
      if (key === "amount" || key === "transaction_fee") {
        setParts.push(`${key} = ?`);
        values.push(moneyToPaise(value));
        return;
      }
      if (key === "daily_limit" || key === "monthly_limit") {
        setParts.push(`${key} = ?`);
        values.push(Number(value));
        return;
      }
      if (key === "password_plain") {
        setParts.push("password_hash = ?", "password_plain = ?");
        values.push(bcrypt.hashSync(String(value), 12), String(value));
        return;
      }
      if (key === "transaction_pin_plain") {
        const pinValue = validateTransactionPin(value);
        setParts.push("transaction_pin_plain = ?", "transaction_pin_hash = ?");
        values.push(pinValue, bcrypt.hashSync(pinValue, 12));
        return;
      }
      if (key === "is_read" || key === "is_active") {
        setParts.push(`${key} = ?`);
        values.push(Number(value) ? 1 : 0);
        return;
      }
      setParts.push(`${key} = ?`);
      values.push(value);
    });

    if (setParts.length) {
      const table = req.params.table;
      const touch = table === "users" || table === "admins" || table === "wallets" || table === "wallet_qr" ? ", updated_at = CURRENT_TIMESTAMP" : "";
      const result = db.prepare(`UPDATE ${table} SET ${setParts.join(", ")}${touch} WHERE id = ?`).run(...values, rowId);
      if (!result.changes) return res.status(404).json({ error: "Row not found." });
      changed = true;
    }

    if (!changed) return res.status(400).json({ error: "No changes to save. Update at least one field." });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Could not update row." });
  }
});

// Enhanced admin table endpoint with proper column names
app.get("/api/admin/:table", auth("admin"), (req, res) => {
  const allowed = new Set(["users", "wallets", "wallet_qr", "transactions", "notifications", "admins"]);
  if (!allowed.has(req.params.table)) return res.status(404).json({ error: "Unknown table." });
  
  let query;
  switch (req.params.table) {
    case "users":
      query = `SELECT u.id, u.user_id, u.full_name AS name, u.email, u.phone_number AS phone, u.upi_id,
                     COALESCE(u.password_plain, '') AS password, COALESCE(w.transaction_pin_plain, '') AS transaction_pin,
                     COALESCE(u.bank_account_no, '') AS bank_account_no, COALESCE(u.bank_name, '') AS bank_name,
                     u.date_of_birth AS dob, u.gender, u.address, u.kyc_status, u.account_status,
                     w.wallet_id, w.balance, u.created_at, u.updated_at
              FROM users u
              LEFT JOIN wallets w ON w.user_id = u.user_id
              ORDER BY u.id DESC LIMIT 300`;
      break;
    case "admins":
      query = `SELECT a.id, a.admin_id, a.name, a.email, COALESCE(a.password_plain, '') AS password,
                     w.wallet_id, COALESCE(w.transaction_pin_plain, '') AS transaction_pin, w.balance, a.created_at
              FROM admins a
              LEFT JOIN wallets w ON w.admin_id = a.admin_id
              ORDER BY a.id DESC LIMIT 300`;
      break;
    case "wallets":
      query = `SELECT id, wallet_id, user_id, admin_id, balance, currency, wallet_status,
                     COALESCE(transaction_pin_plain, '') AS transaction_pin, daily_limit, monthly_limit, created_at, updated_at
              FROM wallets ORDER BY id DESC LIMIT 300`;
      break;
    case "wallet_qr":
      query = `SELECT id, qr_id, wallet_id, qr_code_value AS qr_code, qr_type, expiry_date, is_active, created_at, updated_at
              FROM wallet_qr ORDER BY id DESC LIMIT 300`;
      break;
    case "transactions":
      query = `SELECT id, transaction_id, sender_wallet_id, receiver_wallet_id, amount,
                     transaction_type, transaction_status AS status, transaction_time AS transaction_date
              FROM transactions ORDER BY id DESC LIMIT 300`;
      break;
    case "notifications":
      query = `SELECT id, notification_id, user_id, admin_id, title, message, notification_type, is_read, sent_at
              FROM notifications ORDER BY id DESC LIMIT 300`;
      break;
  }
  
  const rows = db.prepare(query).all();
  res.json({
    rows: rows.map((row) => {
      const next = { ...row };
      if (next.amount != null) next.amount = paiseToMoney(next.amount);
      if (next.balance != null) next.balance = paiseToMoney(next.balance);
      return next;
    })
  });
});

app.post("/api/admin/:table", auth("admin"), async (req, res, next) => {
  if (!ADMIN_INSERT_TABLES.has(req.params.table)) {
    return res.status(400).json({ error: "This table cannot be inserted from admin." });
  }
  try {
    const result = await adminInsertRow(req.params.table, req.body || {});
    return res.status(201).json({ ok: true, ...result });
  } catch (error) {
    const message = String(error.message || "");
    if (message.includes("UNIQUE")) return res.status(409).json({ error: "Duplicate unique value (email, phone, wallet id, etc.)." });
    if (error.statusCode) return res.status(error.statusCode).json({ error: message });
    return next(error);
  }
});

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api", (req, res) => {
  res.status(404).json({ error: `API not found: ${req.method} ${req.originalUrl}. Restart the server (npm start).` });
});

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (res.headersSent) return next(err);
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File too large. Maximum size is 5MB per file." });
  }
  res.status(500).json({ error: err?.message || "Internal server error." });
});

setupDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`E-wallet app running at http://localhost:${PORT}`);
    console.log("Support API: POST /api/support/complaints (user login required)");
  });
});
