const path = require("path");
const fs = require("fs");
const { db, uid, notify, notifyAdmin } = require("./db");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "complaints");

const COMPLAINT_STATUSES = ["RAISED", "UNDER_REVIEW", "ACCEPTED", "REJECTED", "RESOLVED", "CLOSED"];
const COMPLAINT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const COMPLAINT_CATEGORIES = [
  "Money Transfer Issue",
  "Wallet Funding Issue",
  "Payment Failure",
  "Transaction Dispute",
  "KYC Issue",
  "Login Issue",
  "Security Concern",
  "Account Restriction",
  "Technical Bug",
  "Forgot Transaction PIN",
  "Other"
];
const FORGOT_PIN_CATEGORY = "Forgot Transaction PIN";
const PIN_RESET_ELIGIBLE_STATUSES = new Set(["UNDER_REVIEW", "ACCEPTED", "RESOLVED"]);
/** Terminal statuses — user may open a new complaint in the same category after these. */
const TERMINAL_COMPLAINT_STATUSES = ["REJECTED", "CLOSED", "RESOLVED"];
const CUSTOM_CATEGORY_SENTINEL = "__custom__";
const MAX_COMPLAINT_ATTACHMENTS = 10;

const STATUS_LABELS = {
  RAISED: "Complaint Raised",
  UNDER_REVIEW: "Under Review",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  RESOLVED: "Resolved",
  CLOSED: "Closed"
};

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function nextComplaintId() {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `CMP-${day}-`;
  const last = db.prepare(`
    SELECT complaint_id FROM complaints WHERE complaint_id LIKE ? ORDER BY complaint_id DESC LIMIT 1
  `).get(`${prefix}%`);
  let seq = 1;
  if (last?.complaint_id) {
    const tail = last.complaint_id.slice(prefix.length);
    const n = parseInt(tail, 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(6, "0")}`;
}

function sanitizeText(value, max = 5000) {
  return String(value || "").trim().slice(0, max);
}

function notifyAllAdmins(title, message) {
  const admins = db.prepare("SELECT admin_id FROM admins").all();
  admins.forEach((row) => notifyAdmin(row.admin_id, title, message, "support"));
}

function notifyUserComplaint(userId, complaintId, title, message) {
  notify(userId, title, message, "support", complaintId);
}

function recordStatusHistory(complaintId, oldStatus, newStatus, changedByType, changedById) {
  db.prepare(`
    INSERT INTO complaint_status_history (history_id, complaint_id, old_status, new_status, changed_by_type, changed_by_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uid("HIS"), complaintId, oldStatus || null, newStatus, changedByType, changedById || null);
}

function setComplaintStatus(complaint, newStatus, actor) {
  const oldStatus = complaint.status;
  if (oldStatus === newStatus) return complaint;
  if (!COMPLAINT_STATUSES.includes(newStatus)) throw new Error("Invalid complaint status.");

  const now = new Date().toISOString();
  const extras = [];
  const values = [newStatus, now];
  if (newStatus === "ACCEPTED") {
    extras.push("accepted_at = ?");
    values.push(now);
  }
  if (newStatus === "RESOLVED") {
    extras.push("resolved_at = ?");
    values.push(now);
  }
  if (newStatus === "CLOSED") {
    extras.push("closed_at = ?");
    values.push(now);
  }
  const setClause = ["status = ?", "updated_at = ?", ...extras].join(", ");
  values.push(complaint.complaint_id);
  db.prepare(`UPDATE complaints SET ${setClause} WHERE complaint_id = ?`).run(...values);

  recordStatusHistory(complaint.complaint_id, oldStatus, newStatus, actor.type, actor.id);

  const title = `Complaint ${complaint.complaint_id} updated`;
  const label = STATUS_LABELS[newStatus] || newStatus;
  notifyUserComplaint(
    complaint.user_id,
    complaint.complaint_id,
    title,
    `Your complaint ${complaint.complaint_id} is now: ${label}.`
  );

  if (complaint.category === FORGOT_PIN_CATEGORY && PIN_RESET_ELIGIBLE_STATUSES.has(newStatus)) {
    db.prepare("UPDATE users SET pin_reset_allowed = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
      .run(complaint.user_id);
    notify(
      complaint.user_id,
      "Reset your transaction PIN",
      "Your forgot-PIN request was approved. Open Profile → Security to set a new 4-digit PIN.",
      "security",
      complaint.complaint_id
    );
  }

  return db.prepare("SELECT * FROM complaints WHERE complaint_id = ?").get(complaint.complaint_id);
}

function findOpenComplaintByCategory(userId, category) {
  const placeholders = TERMINAL_COMPLAINT_STATUSES.map(() => "?").join(", ");
  return db.prepare(`
    SELECT complaint_id, status FROM complaints
    WHERE user_id = ? AND category = ? AND status NOT IN (${placeholders})
    ORDER BY datetime(created_at) DESC LIMIT 1
  `).get(userId, category, ...TERMINAL_COMPLAINT_STATUSES);
}

function createForgotPinComplaint(userId) {
  const open = findOpenComplaintByCategory(userId, FORGOT_PIN_CATEGORY);
  if (open) {
    return {
      complaint_id: open.complaint_id,
      status: open.status,
      already_open: true
    };
  }

  const user = db.prepare("SELECT full_name, wallet_id FROM users u JOIN wallets w ON w.user_id = u.user_id WHERE u.user_id = ?").get(userId);
  const walletId = user?.wallet_id || null;
  const complaintId = nextComplaintId();
  const now = new Date().toISOString();
  const subject = "Forgot transaction PIN — reset request";
  const description = "User requested a transaction PIN reset via the forgot PIN option. Verify identity before allowing PIN change in Profile → Security.";

  db.prepare(`
    INSERT INTO complaints (
      complaint_id, user_id, wallet_id, transaction_id, subject, category, description,
      status, priority, created_at, updated_at
    ) VALUES (?, ?, ?, NULL, ?, ?, ?, 'RAISED', 'HIGH', ?, ?)
  `).run(complaintId, userId, walletId, subject, FORGOT_PIN_CATEGORY, description, now, now);

  recordStatusHistory(complaintId, null, "RAISED", "user", userId);
  db.prepare(`
    INSERT INTO complaint_messages (message_id, complaint_id, sender_type, sender_id, message)
    VALUES (?, ?, 'user', ?, ?)
  `).run(uid("MSG"), complaintId, userId, description);

  notifyUserComplaint(userId, complaintId, "Forgot PIN request submitted", `Complaint ${complaintId} was created. An admin will review it shortly.`);
  notifyAllAdmins("Forgot PIN request", `User ${userId} submitted forgot-PIN complaint ${complaintId}.`);

  return { complaint_id: complaintId, status: "RAISED", already_open: false };
}

function saveAttachments(complaintId, files = []) {
  ensureUploadDir();
  const saved = [];
  files.forEach((file) => {
    const attachmentId = uid("ATT");
    const safeName = `${attachmentId}_${path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const dest = path.join(UPLOAD_DIR, safeName);
    fs.renameSync(file.path, dest);
    const fileUrl = `/uploads/complaints/${safeName}`;
    db.prepare(`
      INSERT INTO complaint_attachments (attachment_id, complaint_id, file_url, file_name, mime_type, file_size)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(attachmentId, complaintId, fileUrl, file.originalname, file.mimetype, file.size);
    saved.push({ attachment_id: attachmentId, file_url: fileUrl, file_name: file.originalname });
  });
  return saved;
}

function getComplaintRow(complaintId) {
  return db.prepare(`
    SELECT c.*, u.full_name AS user_name, u.email AS user_email, u.phone_number AS user_phone
    FROM complaints c
    INNER JOIN users u ON u.user_id = c.user_id
    WHERE c.complaint_id = ?
  `).get(complaintId);
}

function assertUserOwnsComplaint(complaintId, userId) {
  const row = db.prepare("SELECT complaint_id FROM complaints WHERE complaint_id = ? AND user_id = ?").get(complaintId, userId);
  if (!row) throw new Error("Complaint not found.");
}

function shapeComplaintList(row) {
  return {
    complaint_id: row.complaint_id,
    user_id: row.user_id,
    user_name: row.user_name,
    wallet_id: row.wallet_id,
    transaction_id: row.transaction_id,
    subject: row.subject,
    category: row.category,
    status: row.status,
    priority: row.priority,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function getAttachments(complaintId) {
  return db.prepare(`
    SELECT attachment_id, complaint_id, file_url, file_name, mime_type, file_size, uploaded_at
    FROM complaint_attachments WHERE complaint_id = ? ORDER BY uploaded_at ASC
  `).all(complaintId);
}

function getMessages(complaintId) {
  return db.prepare(`
    SELECT message_id, complaint_id, sender_type, sender_id, message, attachment_url, attachment_name, created_at
    FROM complaint_messages WHERE complaint_id = ? ORDER BY datetime(created_at) ASC
  `).all(complaintId);
}

function getStatusHistory(complaintId) {
  return db.prepare(`
    SELECT history_id, complaint_id, old_status, new_status, changed_by_type, changed_by_id, changed_at
    FROM complaint_status_history WHERE complaint_id = ? ORDER BY datetime(changed_at) ASC
  `).all(complaintId);
}

function buildTimeline(complaint, history) {
  const seen = new Set();
  const timeline = [];
  const add = (status, at) => {
    if (!status || seen.has(status)) return;
    seen.add(status);
    timeline.push({ status, label: STATUS_LABELS[status] || status, at });
  };
  history.forEach((h) => add(h.new_status, h.changed_at));
  add(complaint.status, complaint.updated_at);
  if (complaint.created_at) add("RAISED", complaint.created_at);
  const order = COMPLAINT_STATUSES;
  timeline.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  return timeline;
}

function getComplaintDetail(complaintId) {
  const complaint = getComplaintRow(complaintId);
  if (!complaint) return null;
  const history = getStatusHistory(complaintId);
  return {
    ...shapeComplaintList(complaint),
    description: complaint.description,
    accepted_at: complaint.accepted_at,
    resolved_at: complaint.resolved_at,
    closed_at: complaint.closed_at,
    user_email: complaint.user_email,
    user_phone: complaint.user_phone,
    attachments: getAttachments(complaintId),
    messages: getMessages(complaintId),
    history,
    timeline: buildTimeline(complaint, history)
  };
}

function resolveComplaintCategory(body) {
  let category = sanitizeText(body.category, 80);
  const custom = sanitizeText(body.customCategory || body.custom_category, 80);

  if (category === CUSTOM_CATEGORY_SENTINEL) {
    if (!custom) throw new Error("Please enter your custom category.");
    category = custom;
  }
  if (!category) throw new Error("Please select a complaint category.");

  if (COMPLAINT_CATEGORIES.includes(category)) return category;
  if (category.length >= 3 && category.length <= 80) return category;
  throw new Error("Invalid complaint category. Choose from the list or enter 3–80 characters.");
}

function createComplaint({ userId, body, files }) {
  const subject = sanitizeText(body.subject, 200);
  const category = resolveComplaintCategory(body);
  const description = sanitizeText(body.description, 5000);
  const walletId = sanitizeText(body.walletId || body.wallet_id, 64) || null;
  const transactionId = sanitizeText(body.transactionId || body.transaction_id, 64) || null;

  if (!subject || !description) throw new Error("Subject and description are required.");

  const openSame = findOpenComplaintByCategory(userId, category);
  if (openSame) {
    throw new Error(
      `You already have an open complaint in "${category}" (${openSame.complaint_id}). Track it under Help & Support, or wait until an admin marks it resolved.`
    );
  }

  const fileList = Array.isArray(files) ? files : [];
  if (fileList.length > MAX_COMPLAINT_ATTACHMENTS) {
    throw new Error(`You can attach up to ${MAX_COMPLAINT_ATTACHMENTS} files per complaint.`);
  }

  if (walletId) {
    const ok = db.prepare("SELECT 1 FROM wallets WHERE wallet_id = ? AND user_id = ?").get(walletId, userId);
    if (!ok) throw new Error("Wallet ID does not belong to your account.");
  }

  const complaintId = nextComplaintId();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO complaints (
      complaint_id, user_id, wallet_id, transaction_id, subject, category, description,
      status, priority, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'RAISED', 'MEDIUM', ?, ?)
  `).run(complaintId, userId, walletId, transactionId, subject, category, description, now, now);

  recordStatusHistory(complaintId, null, "RAISED", "user", userId);

  const attachments = saveAttachments(complaintId, files);

  db.prepare(`
    INSERT INTO complaint_messages (message_id, complaint_id, sender_type, sender_id, message)
    VALUES (?, ?, 'user', ?, ?)
  `).run(uid("MSG"), complaintId, userId, description);

  notifyUserComplaint(
    userId,
    complaintId,
    "Complaint submitted",
    `Your complaint ${complaintId} has been submitted successfully.`
  );
  notifyAllAdmins(
    "New support complaint",
    `New complaint ${complaintId} from user ${userId}: ${subject}`
  );

  return { complaint_id: complaintId, attachments };
}

function listUserComplaints(userId) {
  const rows = db.prepare(`
    SELECT c.*, u.full_name AS user_name
    FROM complaints c
    INNER JOIN users u ON u.user_id = c.user_id
    WHERE c.user_id = ?
    ORDER BY datetime(c.updated_at) DESC
  `).all(userId);
  return rows.map(shapeComplaintList);
}

function listAdminComplaints(filters = {}) {
  const clauses = ["1=1"];
  const params = [];
  if (filters.status) {
    clauses.push("c.status = ?");
    params.push(filters.status);
  }
  if (filters.category) {
    clauses.push("c.category = ?");
    params.push(filters.category);
  }
  if (filters.userId) {
    clauses.push("c.user_id = ?");
    params.push(filters.userId);
  }
  if (filters.priority) {
    clauses.push("c.priority = ?");
    params.push(filters.priority);
  }
  if (filters.q) {
    clauses.push("(c.complaint_id LIKE ? OR c.subject LIKE ? OR u.full_name LIKE ? OR c.user_id LIKE ?)");
    const like = `%${filters.q}%`;
    params.push(like, like, like, like);
  }
  if (filters.from) {
    clauses.push("date(c.created_at) >= date(?)");
    params.push(filters.from);
  }
  if (filters.to) {
    clauses.push("date(c.created_at) <= date(?)");
    params.push(filters.to);
  }

  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
  const offset = Math.max(Number(filters.offset) || 0, 0);

  const where = clauses.join(" AND ");
  const rows = db.prepare(`
    SELECT c.*, u.full_name AS user_name
    FROM complaints c
    INNER JOIN users u ON u.user_id = c.user_id
    WHERE ${where}
    ORDER BY datetime(c.updated_at) DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(`
    SELECT COUNT(*) AS count FROM complaints c
    INNER JOIN users u ON u.user_id = c.user_id
    WHERE ${where}
  `).get(...params).count;

  return { rows: rows.map(shapeComplaintList), total, limit, offset };
}

function getAdminStats() {
  const byStatus = db.prepare(`
    SELECT status, COUNT(*) AS count FROM complaints GROUP BY status
  `).all();
  const map = Object.fromEntries(byStatus.map((r) => [r.status, r.count]));
  const total = byStatus.reduce((s, r) => s + r.count, 0);
  const open = (map.RAISED || 0) + (map.UNDER_REVIEW || 0) + (map.ACCEPTED || 0);
  return {
    total,
    open,
    raised: map.RAISED || 0,
    under_review: map.UNDER_REVIEW || 0,
    accepted: map.ACCEPTED || 0,
    rejected: map.REJECTED || 0,
    resolved: map.RESOLVED || 0,
    closed: map.CLOSED || 0,
    by_status: map
  };
}

function addMessage(complaintId, sender, messageText, file = null) {
  const complaint = db.prepare("SELECT * FROM complaints WHERE complaint_id = ?").get(complaintId);
  if (!complaint) throw new Error("Complaint not found.");

  const message = sanitizeText(messageText, 4000);
  if (!message && !file) throw new Error("Message or attachment is required.");

  let attachmentUrl = null;
  let attachmentName = null;
  if (file) {
    ensureUploadDir();
    const attachmentId = uid("MSGF");
    const safeName = `${attachmentId}_${path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const dest = path.join(UPLOAD_DIR, safeName);
    fs.renameSync(file.path, dest);
    attachmentUrl = `/uploads/complaints/${safeName}`;
    attachmentName = file.originalname;
  }

  const messageId = uid("MSG");
  db.prepare(`
    INSERT INTO complaint_messages (message_id, complaint_id, sender_type, sender_id, message, attachment_url, attachment_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(messageId, complaintId, sender.type, sender.id, message || "(attachment)", attachmentUrl, attachmentName);

  db.prepare("UPDATE complaints SET updated_at = CURRENT_TIMESTAMP WHERE complaint_id = ?").run(complaintId);

  if (sender.type === "admin") {
    notifyUserComplaint(
      complaint.user_id,
      complaintId,
      "Support replied",
      `Support team replied to your complaint ${complaintId}.`
    );
  } else {
    notifyAllAdmins(
      "User replied to complaint",
      `User ${sender.id} sent a new message on ${complaintId}.`
    );
  }

  return { message_id: messageId, attachment_url: attachmentUrl };
}

function updatePriority(complaintId, priority) {
  if (!COMPLAINT_PRIORITIES.includes(priority)) throw new Error("Invalid priority.");
  const complaint = db.prepare("SELECT * FROM complaints WHERE complaint_id = ?").get(complaintId);
  if (!complaint) throw new Error("Complaint not found.");
  db.prepare("UPDATE complaints SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE complaint_id = ?").run(priority, complaintId);
  notifyUserComplaint(
    complaint.user_id,
    complaintId,
    "Complaint priority updated",
    `Priority for ${complaintId} is now ${priority}.`
  );
  return getComplaintDetail(complaintId);
}

module.exports = {
  UPLOAD_DIR,
  COMPLAINT_STATUSES,
  COMPLAINT_PRIORITIES,
  COMPLAINT_CATEGORIES,
  CUSTOM_CATEGORY_SENTINEL,
  MAX_COMPLAINT_ATTACHMENTS,
  resolveComplaintCategory,
  STATUS_LABELS,
  ensureUploadDir,
  createComplaint,
  listUserComplaints,
  listAdminComplaints,
  getComplaintDetail,
  getAdminStats,
  assertUserOwnsComplaint,
  addMessage,
  setComplaintStatus,
  updatePriority,
  getComplaintRow,
  createForgotPinComplaint,
  FORGOT_PIN_CATEGORY
};
