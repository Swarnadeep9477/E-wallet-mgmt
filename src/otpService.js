const nodemailer = require("nodemailer");

// otpService.js
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});
transporter.verify((err, success) => {
  if (err) {
    console.error("SMTP ERROR:", err);
  } else {
    console.log("SMTP READY");
  }
});

const bcrypt = require("bcryptjs");
const { db, uid, normalizeEmail } = require("./db");

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  if (last10.length !== 10) throw new Error("Phone number must be 10 digits.");
  return last10;
}

function normalizeTarget(channel, target) {
  if (channel === "email") return normalizeEmail(target);
  if (channel === "phone") return normalizePhone(target);
  throw new Error("Invalid OTP channel.");
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function ensureOtpTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS otp_challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_id TEXT NOT NULL UNIQUE,
      channel TEXT NOT NULL CHECK (channel IN ('email', 'phone')),
      target TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT 'signup',
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      verified_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_otp_channel_target ON otp_challenges(channel, target, purpose);
  `);
}

function getLatestChallenge(channel, target, purpose = "signup") {
  const normalized = normalizeTarget(channel, target);
  return db.prepare(`
    SELECT * FROM otp_challenges
    WHERE channel = ? AND target = ? AND purpose = ?
    ORDER BY datetime(created_at) DESC LIMIT 1
  `).get(channel, normalized, purpose);
}

async function sendOtp({ channel, target, purpose = "signup" }) {
  ensureOtpTable();
  const normalized = normalizeTarget(channel, target);
  const existing = getLatestChallenge(channel, normalized, purpose);
  if (existing?.created_at) {
    const elapsed = Date.now() - new Date(existing.created_at).getTime();
    if (elapsed < OTP_COOLDOWN_MS) {
      const waitSec = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000);
      throw new Error(`Please wait ${waitSec}s before requesting another OTP.`);
    }
  }

  const code = generateOtpCode();
  const challengeId = uid("OTP");
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  db.prepare("DELETE FROM otp_challenges WHERE channel = ? AND target = ? AND purpose = ?").run(channel, normalized, purpose);
  db.prepare(`
    INSERT INTO otp_challenges (challenge_id, channel, target, purpose, code_hash, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(challengeId, channel, normalized, purpose, bcrypt.hashSync(code, 10), expiresAt);
  // In otpService.js sendOtp() function
if (channel === "email") {
  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: normalized,
      subject: "SwiftPay OTP Verification",
      text: `Your OTP is ${code}. It is valid for 5 minutes.`
    });
  } catch (emailError) {
    console.error("Email send failed:", emailError.message);
    // Still save OTP to DB for testing, but log the error
    throw new Error("Failed to send OTP email. Please try phone verification.");
  }
}

  const deliveryHint = channel === "email"
    ? `Email OTP sent to ${normalized}`
    : `SMS OTP sent to +91 ${normalized}`;

  console.log(`[SwiftPay OTP][${purpose}] ${channel}=${normalized} code=${code}`);

  return {
    ok: true,
    challenge_id: challengeId,
    channel,
    target: normalized,
    purpose,
    expires_at: expiresAt,
    delivery_hint: deliveryHint,
    dev_otp: code
  };
}

function verifyOtp({ channel, target, code, purpose = "signup" }) {
  ensureOtpTable();
  if (!code || String(code).trim().length !== 6) throw new Error("Enter the 6-digit OTP.");
  const normalized = normalizeTarget(channel, target);
  const row = getLatestChallenge(channel, normalized, purpose);
  if (!row) throw new Error("No OTP found. Request a new code.");
  if (row.verified_at) return { ok: true, already_verified: true, target: normalized };
  if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("OTP expired. Request a new code.");
  if (!bcrypt.compareSync(String(code).trim(), row.code_hash)) throw new Error("Invalid OTP. Please try again.");

  db.prepare("UPDATE otp_challenges SET verified_at = ? WHERE challenge_id = ?").run(new Date().toISOString(), row.challenge_id);
  return { ok: true, target: normalized, purpose };
}

function isOtpVerified(channel, target, purpose = "signup") {
  ensureOtpTable();
  const normalized = normalizeTarget(channel, target);
  const row = db.prepare(`
    SELECT verified_at FROM otp_challenges
    WHERE channel = ? AND target = ? AND purpose = ? AND verified_at IS NOT NULL
    ORDER BY datetime(verified_at) DESC LIMIT 1
  `).get(channel, normalized, purpose);
  return Boolean(row?.verified_at);
}

function clearOtp(channel, target, purpose = "signup") {
  ensureOtpTable();
  const normalized = normalizeTarget(channel, target);
  db.prepare("DELETE FROM otp_challenges WHERE channel = ? AND target = ? AND purpose = ?").run(channel, normalized, purpose);
}

module.exports = {
  sendOtp,
  verifyOtp,
  isOtpVerified,
  clearOtp,
  normalizePhone
};
