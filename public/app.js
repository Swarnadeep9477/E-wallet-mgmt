const app = document.querySelector("#app");
const toast = document.querySelector("#toast");

let state = {
  role: "guest",
  user: null,
  admin: null,
  view: "dashboard",
  authTab: "login",
  loginRole: "user",
  transactions: [],
  notifications: [],
  adminTable: "users",
  adminRows: [],
  adminData: {},
  adminSearch: "",
  adminFilterBy: {},
  overview: null,
  pendingPayment: null,
  supportComplaints: [],
  supportDetail: null,
  supportMeta: null,
  supportComplaintId: null,
  adminSupportStats: null,
  adminSupportComplaints: [],
  adminSupportTotal: 0,
  adminSupportFilters: { status: "", category: "", q: "", userId: "" },
  signupOtp: { email: false, phone: false },
  signupOtpDev: { email: "", phone: "" },
  signupData: {},
  unreadCounts: { total: 0, support: 0 },
  moneyRequests: [],
  theme: localStorage.getItem("swiftpay-theme") || "light"
};

const PAYMENT_METHODS = [
  { value: "upi", label: "UPI", desc: "GPay, PhonePe, Paytm", icon: "UP", tone: "upi" },
  { value: "netbanking", label: "Net Banking", desc: "All major banks", icon: "NB", tone: "bank" },
  { value: "debit", label: "Debit Card", desc: "Visa, Mastercard, RuPay", icon: "DC", tone: "card" },
  { value: "credit", label: "Credit Card", desc: "Visa, Mastercard, Amex", icon: "CC", tone: "card" }
];

const TRANSFER_PAYMENT_METHODS = [
  { value: "wallet", label: "SwiftPay Wallet", desc: "Use your available balance", icon: "WL", tone: "wallet" },
  ...PAYMENT_METHODS
];

const MAX_DOB = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
})();

const INDIAN_BANKS = [
  { name: "HDFC Bank", logo: "HDFC", color: "#004B8D", accent: "#ED232A" },
  { name: "ICICI Bank", logo: "ICICI", color: "#B02A1A", accent: "#F58220" },
  { name: "State Bank of India", logo: "SBI", color: "#22409A", accent: "#00A9E0" },
  { name: "Axis Bank", logo: "AXIS", color: "#97144D", accent: "#D71920" },
  { name: "Kotak Mahindra Bank", logo: "Kotak", color: "#ED1C24", accent: "#004B93" },
  { name: "Punjab National Bank", logo: "PNB", color: "#A40000", accent: "#FDB913" },
  { name: "Bank of Baroda", logo: "BoB", color: "#F15A22", accent: "#FFB000" },
  { name: "Canara Bank", logo: "Canara", color: "#00843D", accent: "#FFC72C" },
  { name: "Union Bank of India", logo: "Union", color: "#0B3D91", accent: "#E31E24" },
  { name: "IndusInd Bank", logo: "IndusInd", color: "#98272A", accent: "#D4AF37" },
  { name: "IDFC First Bank", logo: "IDFC", color: "#9D2235", accent: "#C8A45D" },
  { name: "Yes Bank", logo: "YES", color: "#004990", accent: "#E31E24" }
];

const ADMIN_TABLE_SCHEMA = {
  admins: {
    title: "Admin",
    pk: "admin_id",
    filterFields: [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "admin_id", label: "Admin ID" },
      { key: "wallet_id", label: "Wallet ID" }
    ],
    columns: [
      { key: "admin_id", label: "admin_id" },
      { key: "name", label: "name" },
      { key: "email", label: "email" },
      { key: "password", label: "password" },
      { key: "wallet_id", label: "wallet_id" },
      { key: "transaction_pin", label: "transaction_pin" },
      { key: "balance", label: "balance", money: true },
      { key: "created_at", label: "created_at", date: true }
    ],
    deletable: true
  },
  users: {
    title: "User",
    pk: "user_id",
    filterFields: [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "user_id", label: "User ID" },
      { key: "bank_account_no", label: "Bank account no." },
      { key: "bank_name", label: "Bank name" },
      { key: "upi_id", label: "UPI ID" },
      { key: "wallet_id", label: "Wallet ID" },
      { key: "kyc_status", label: "KYC status" }
    ],
    columns: [
      { key: "user_id", label: "user_id" },
      { key: "name", label: "name" },
      { key: "email", label: "email" },
      { key: "phone", label: "phone" },
      { key: "password", label: "password" },
      { key: "transaction_pin", label: "transaction_pin" },
      { key: "bank_account_no", label: "bank_account_no" },
      { key: "bank_name", label: "bank_name" },
      { key: "upi_id", label: "upi_id" },
      { key: "dob", label: "dob", date: true },
      { key: "gender", label: "gender" },
      { key: "address", label: "address", truncate: 40 },
      { key: "wallet_id", label: "wallet_id" },
      { key: "balance", label: "balance", money: true },
      { key: "kyc_status", label: "kyc_status" },
      { key: "account_status", label: "account_status" },
      { key: "created_at", label: "created_at", date: true }
    ],
    deletable: true
  },
  wallets: {
    title: "Wallet",
    pk: "wallet_id",
    filterFields: [
      { key: "wallet_id", label: "Wallet ID" },
      { key: "user_id", label: "User ID" },
      { key: "wallet_status", label: "Status" },
      { key: "currency", label: "Currency" }
    ],
    columns: [
      { key: "wallet_id", label: "wallet_id" },
      { key: "user_id", label: "user_id" },
      { key: "balance", label: "balance", money: true },
      { key: "transaction_pin", label: "transaction_pin" },
      { key: "currency", label: "currency" },
      { key: "wallet_status", label: "wallet_status" },
      { key: "daily_limit", label: "daily_limit" },
      { key: "monthly_limit", label: "monthly_limit" },
      { key: "created_at", label: "created_at", date: true }
    ],
    deletable: true
  },
  transactions: {
    title: "Transaction",
    pk: "transaction_id",
    filterFields: [
      { key: "transaction_id", label: "Transaction ID" },
      { key: "sender_wallet_id", label: "Sender wallet" },
      { key: "receiver_wallet_id", label: "Receiver wallet" },
      { key: "transaction_type", label: "Type" },
      { key: "status", label: "Status" }
    ],
    columns: [
      { key: "transaction_id", label: "transaction_id" },
      { key: "sender_wallet_id", label: "sender_wallet_id" },
      { key: "receiver_wallet_id", label: "receiver_wallet_id" },
      { key: "amount", label: "amount", money: true },
      { key: "transaction_type", label: "transaction_type" },
      { key: "status", label: "status" },
      { key: "transaction_date", label: "transaction_date", date: true }
    ],
    deletable: true
  },
  wallet_qr: {
    title: "Wallet_QR",
    pk: "qr_id",
    filterFields: [
      { key: "qr_id", label: "QR ID" },
      { key: "wallet_id", label: "Wallet ID" },
      { key: "qr_type", label: "QR type" }
    ],
    columns: [
      { key: "qr_id", label: "qr_id" },
      { key: "wallet_id", label: "wallet_id" },
      { key: "qr_code", label: "qr_code", truncate: 40 },
      { key: "qr_type", label: "qr_type" },
      { key: "is_active", label: "is_active", bool: true },
      { key: "expiry_date", label: "expiry_date", date: true },
      { key: "created_at", label: "created_at", date: true }
    ],
    deletable: true
  },
  notifications: {
    title: "Notification",
    pk: "notification_id",
    filterFields: [
      { key: "notification_id", label: "Notification ID" },
      { key: "user_id", label: "User ID" },
      { key: "title", label: "Title" },
      { key: "notification_type", label: "Type" }
    ],
    columns: [
      { key: "notification_id", label: "notification_id" },
      { key: "user_id", label: "user_id" },
      { key: "admin_id", label: "admin_id" },
      { key: "title", label: "title" },
      { key: "message", label: "message", truncate: 48 },
      { key: "notification_type", label: "notification_type" },
      { key: "is_read", label: "is_read", bool: true },
      { key: "sent_at", label: "sent_at", date: true }
    ],
    deletable: true
  }
};

const ADMIN_EDIT_FIELDS = {
  admins: [
    { api: "admin_id", key: "admin_id", label: "Admin ID", readonly: true },
    { api: "name", key: "name", label: "Name" },
    { api: "email", key: "email", label: "Email", type: "email" },
    { api: "password_plain", key: "password", label: "Password (leave blank to keep)" },
    { api: "wallet_id", key: "wallet_id", label: "Wallet ID", readonly: true },
    { api: "balance", key: "balance", label: "Balance (INR)", type: "number", step: "0.01" },
    { api: "transaction_pin_plain", key: "transaction_pin", label: "Transaction PIN (4 digits, blank = keep)" }
  ],
  users: [
    { api: "user_id", key: "user_id", label: "User ID", readonly: true },
    { api: "full_name", key: "name", label: "Full name" },
    { api: "email", key: "email", label: "Email", type: "email" },
    { api: "phone_number", key: "phone", label: "Phone" },
    { api: "password_plain", key: "password", label: "Password (leave blank to keep)" },
    { api: "bank_account_no", key: "bank_account_no", label: "Bank account no." },
    { api: "bank_name", key: "bank_name", label: "Bank name" },
    { api: "upi_id", key: "upi_id", label: "UPI ID" },
    { api: "upi_handle", key: "upi_handle", label: "UPI handle (@ybl, @axl)" },
    { api: "date_of_birth", key: "dob", label: "Date of birth", type: "date" },
    { api: "gender", key: "gender", label: "Gender" },
    { api: "address", key: "address", label: "Address" },
    { api: "kyc_status", key: "kyc_status", label: "KYC status", input: "kyc" },
    { api: "account_status", key: "account_status", label: "Account status", input: "account" },
    { api: "wallet_id", key: "wallet_id", label: "Wallet ID", readonly: true },
    { api: "balance", key: "balance", label: "Balance (INR)", type: "number", step: "0.01" },
    { api: "transaction_pin_plain", key: "transaction_pin", label: "Transaction PIN (4 digits, blank = keep)" }
  ],
  wallets: [
    { api: "wallet_id", key: "wallet_id", label: "Wallet ID" },
    { api: "user_id", key: "user_id", label: "User ID" },
    { api: "admin_id", key: "admin_id", label: "Admin ID" },
    { api: "balance", key: "balance", label: "Balance (INR)", type: "number", step: "0.01" },
    { api: "currency", key: "currency", label: "Currency" },
    { api: "wallet_status", key: "wallet_status", label: "Wallet status" },
    { api: "transaction_pin_plain", key: "transaction_pin", label: "Transaction PIN (4 digits)" },
    { api: "daily_limit", key: "daily_limit", label: "Daily limit (paise)", type: "number" },
    { api: "monthly_limit", key: "monthly_limit", label: "Monthly limit (paise)", type: "number" }
  ],
  transactions: [
    { api: "transaction_id", key: "transaction_id", label: "Transaction ID" },
    { api: "wallet_id", key: "wallet_id", label: "Wallet ID" },
    { api: "sender_wallet_id", key: "sender_wallet_id", label: "Sender wallet" },
    { api: "receiver_wallet_id", key: "receiver_wallet_id", label: "Receiver wallet" },
    { api: "transaction_type", key: "transaction_type", label: "Type" },
    { api: "amount", key: "amount", label: "Amount (INR)", type: "number", step: "0.01" },
    { api: "transaction_status", key: "status", label: "Status" },
    { api: "payment_method", key: "payment_method", label: "Payment method" },
    { api: "reference_number", key: "reference_number", label: "Reference" },
    { api: "remarks", key: "remarks", label: "Remarks" }
  ],
  wallet_qr: [
    { api: "qr_id", key: "qr_id", label: "QR ID" },
    { api: "wallet_id", key: "wallet_id", label: "Wallet ID" },
    { api: "qr_code_value", key: "qr_code", label: "QR code (JSON)" },
    { api: "qr_type", key: "qr_type", label: "QR type" },
    { api: "expiry_date", key: "expiry_date", label: "Expiry", type: "datetime-local" },
    { api: "is_active", key: "is_active", label: "Active (1/0)", type: "number" }
  ],
  notifications: [
    { api: "notification_id", key: "notification_id", label: "Notification ID" },
    { api: "title", key: "title", label: "Title" },
    { api: "message", key: "message", label: "Message" },
    { api: "user_id", key: "user_id", label: "User ID" },
    { api: "admin_id", key: "admin_id", label: "Admin ID" },
    { api: "notification_type", key: "notification_type", label: "Type" },
    { api: "is_read", key: "is_read", label: "Read (1=yes, 0=no)", type: "number" }
  ]
};

const ADMIN_CREATE_FIELDS = {
  admins: [
    { api: "name", label: "Name", required: true },
    { api: "email", label: "Email", type: "email", required: true },
    { api: "password_plain", label: "Password", required: true },
    { api: "transaction_pin_plain", label: "Transaction PIN (4 digits)", required: true },
    { api: "wallet_id", label: "Wallet ID", placeholder: "Auto-generated if empty" },
    { api: "balance", label: "Initial balance (INR)", type: "number", step: "0.01" }
  ],
  users: [
    { api: "full_name", label: "Full name", required: true },
    { api: "email", label: "Email", type: "email", required: true },
    { api: "phone_number", label: "Phone (10 digits)", required: true },
    { api: "password_plain", label: "Password", required: true },
    { api: "transaction_pin_plain", label: "Transaction PIN (4 digits)", required: true },
    { api: "bank_account_no", label: "Bank account no.", required: true },
    { api: "bank_name", label: "Bank name", required: true },
    { api: "upi_handle", label: "UPI handle", placeholder: "@ybl" },
    { api: "date_of_birth", label: "Date of birth", type: "date", required: true },
    { api: "gender", label: "Gender" },
    { api: "address", label: "Address" },
    { api: "kyc_status", label: "KYC status", placeholder: "pending" }
  ],
  wallets: [
    { api: "wallet_id", label: "Wallet ID", placeholder: "Auto-generated if empty" },
    { api: "user_id", label: "User ID", placeholder: "Use user_id OR admin_id" },
    { api: "admin_id", label: "Admin ID" },
    { api: "balance", label: "Balance (INR)", type: "number", step: "0.01" },
    { api: "currency", label: "Currency", placeholder: "INR" },
    { api: "wallet_status", label: "Status", placeholder: "active" },
    { api: "transaction_pin_plain", label: "Transaction PIN (4 digits)", required: true },
    { api: "daily_limit", label: "Daily limit (paise)", type: "number" },
    { api: "monthly_limit", label: "Monthly limit (paise)", type: "number" }
  ],
  wallet_qr: [
    { api: "wallet_id", label: "Wallet ID", required: true },
    { api: "qr_code_value", label: "QR payload (JSON)", placeholder: "Auto-generated if empty" },
    { api: "qr_type", label: "QR type", placeholder: "payment" },
    { api: "expiry_date", label: "Expiry", type: "datetime-local" },
    { api: "is_active", label: "Active (1/0)", type: "number", placeholder: "1" }
  ],
  transactions: [
    { api: "transaction_id", label: "Transaction ID", placeholder: "Auto-generated if empty" },
    { api: "wallet_id", label: "Wallet ID", required: true },
    { api: "sender_wallet_id", label: "Sender wallet" },
    { api: "receiver_wallet_id", label: "Receiver wallet" },
    { api: "transaction_type", label: "Type", required: true, placeholder: "send money" },
    { api: "amount", label: "Amount (INR)", type: "number", step: "0.01", required: true },
    { api: "transaction_status", label: "Status", placeholder: "success" },
    { api: "payment_method", label: "Payment method" },
    { api: "reference_number", label: "Reference" },
    { api: "remarks", label: "Remarks" }
  ],
  notifications: [
    { api: "title", label: "Title", required: true },
    { api: "message", label: "Message", required: true },
    { api: "user_id", label: "User ID", placeholder: "user_id OR admin_id" },
    { api: "admin_id", label: "Admin ID" },
    { api: "notification_type", label: "Type", placeholder: "transaction" },
    { api: "is_read", label: "Read (1/0)", type: "number", placeholder: "0" }
  ]
};

const money = (n) => `Rs ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const walletMoney = (paise) => money(Number(paise || 0) / 100);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
const firstName = (name) => String(name || "User").trim().split(/\s+/)[0];
const initials = (name) => String(name || "U").trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";

const TX_VIEWS = new Set(["transfer", "bills", "recharge", "add-money", "qrpay"]);


function animateCountUpEl(el) {
  if (el.dataset.counted === "1") return;
  el.dataset.counted = "1";
  const target = parseFloat(el.getAttribute("data-count"));
  if (Number.isNaN(target)) return;
  const decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
  const duration = 900;
  const start = performance.now();
  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = target * eased;
    el.textContent = value.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = target.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };
  requestAnimationFrame(tick);
}

function initCountUps() {
  document.querySelectorAll("[data-count]").forEach(animateCountUpEl);
}

function initDashboardWalletTilt() {
  const hero = document.getElementById("dashWalletHero");
  if (!hero || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  hero.addEventListener("mousemove", (e) => {
    const rect = hero.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotateX = ((y / rect.height) - 0.5) * -6;
    const rotateY = ((x / rect.width) - 0.5) * 8;
    hero.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    const shine = document.getElementById("dashWalletShine");
    if (shine) {
      shine.style.setProperty("--mx", `${(x / rect.width) * 100}%`);
      shine.style.setProperty("--my", `${(y / rect.height) * 100}%`);
    }
  });
  hero.addEventListener("mouseleave", () => {
    hero.style.transform = "rotateX(0deg) rotateY(0deg)";
  });
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn || btn.disabled) return;
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
  btn.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
});

function isUserKycVerified() {
  return state.role !== "user" || String(state.user?.kyc_status || "").trim().toLowerCase() === "verified";
}

function assertUserCanTransact() {
  if (!isUserKycVerified()) {
    throw new Error(`KYC must be verified before transactions. Your status: ${state.user?.kyc_status || "pending"}.`);
  }
}

function kycStatusBanner() {
  if (state.role !== "user" || isUserKycVerified()) return "";
  const status = esc(state.user?.kyc_status || "pending");
  return `<div class="kyc-banner" role="alert">
    <strong>KYC not verified</strong>
    <p>Current status: <span class="kyc-badge">${status}</span>. Payments and transfers are disabled until an admin sets KYC to <strong>verified</strong>.</p>
  </div>`;
}

function walletHealthBanner() {
  const u = state.user;
  if (!u?.wallet_id) {
    return `<div class="kyc-banner wallet-alert" role="alert"><strong>Wallet not linked</strong><p>Your account has no wallet. Refresh the page or contact support.</p></div>`;
  }
  const walletStatus = String(u.wallet_status || u.status || "active").toLowerCase();
  const accountStatus = String(u.account_status || "active").toLowerCase();
  let html = "";
  if (walletStatus !== "active") {
    html += `<div class="kyc-banner wallet-alert" role="alert"><strong>Wallet ${esc(walletStatus)}</strong><p>Transfers and payments are disabled until an admin sets wallet status to <strong>active</strong>.</p></div>`;
  }
  if (accountStatus !== "active") {
    html += `<div class="kyc-banner wallet-alert" role="alert"><strong>Account ${esc(accountStatus)}</strong><p>Your user account is restricted. Contact support.</p></div>`;
  }
  return html;
}

function qrImageTag(user = state.user) {
  const src = user?.qr_image || user?.qr_image_url;
  if (!src) {
    return `<div class="support-file-empty" style="margin-top:12px">QR code is being generated. Refresh this page in a moment.</div>`;
  }
  return `<img class="qr big-qr" src="${esc(src)}" alt="Wallet QR code">`;
}

function kycBlockedPage(title) {
  return shell(title, `
    ${kycStatusBanner()}
    <div class="form-card wide kyc-block-card">
      <h2>Transactions unavailable</h2>
      <p class="subtle">You can still view your balance, history, notifications, and profile. Ask an admin to verify your KYC in the Users table.</p>
      <button type="button" class="gradient-button" data-view="dashboard">Back to dashboard</button>
    </div>
  `, "KY");
}

function passwordField(label, name, attrs = "") {
  const id = `pwd_${name}_${Math.random().toString(36).slice(2, 8)}`;
  return `<label>${label}<span class="password-wrap"><input id="${id}" name="${name}" type="password" ${attrs}><button type="button" class="password-toggle" data-target="${id}" aria-label="Show password" title="Show password"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg></button></span></label>`;
}

function ensureAdminFilter(table) {
  const fields = ADMIN_TABLE_SCHEMA[table]?.filterFields;
  if (!fields?.length) return;
  if (!state.adminFilterBy[table]) state.adminFilterBy[table] = fields[0].key;
}

function adminFilterOptions(table) {
  ensureAdminFilter(table);
  const fields = ADMIN_TABLE_SCHEMA[table]?.filterFields || [];
  const active = state.adminFilterBy[table];
  return fields.map((f) => `<option value="${esc(f.key)}" ${f.key === active ? "selected" : ""}>${esc(f.label)}</option>`).join("");
}

function refreshAdminTableUi() {
  const card = document.querySelector(".admin-table-card");
  if (!card) return;
  const meta = card.querySelector(".admin-table-meta");
  if (meta) {
    const spans = meta.querySelectorAll("span");
    if (spans[1]) spans[1].textContent = `${adminVisibleRows().length} rows`;
  }
  const host = card.querySelector(".admin-table-host");
  if (host) host.outerHTML = adminTableMarkup();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

function applyTheme(theme) {
  const next = theme === "dark" ? "dark" : "light";
  state.theme = next;
  localStorage.setItem("swiftpay-theme", next);
  document.documentElement.setAttribute("data-theme", next);
  const btn = document.getElementById("nightModeBtn");
  if (btn) {
    btn.title = next === "dark" ? "Switch to light mode" : "Switch to night mode";
    btn.setAttribute("aria-pressed", next === "dark" ? "true" : "false");
    btn.textContent = next === "dark" ? "☀" : "☾";
  }
}

function toggleNightMode() {
  applyTheme(state.theme === "dark" ? "light" : "dark");
}

function canUseMoneyRequests() {
  return state.role === "admin" || (state.role === "user" && isUserKycVerified());
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status} ${res.statusText}). Restart the server if this persists.`);
  }
  return data;
}

function formData(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  form.querySelectorAll("[data-mirror-radio]").forEach((input) => {
    data[input.name] = data[input.dataset.mirrorRadio] || input.value;
  });
  return data;
}

function swiftPayBrandMarkup(extraClass = "") {
  return `<span class="swiftpay-brand ${extraClass}"><img src="/swiftpay-icon.png" alt="" class="swiftpay-logo" aria-hidden="true"><a href="home.html" style="color:white;text-decoration: none">SwiftPay</a></span>`;
}

function bankIconMarkup(bank) {
  return `<span class="bank-logo" style="--bank-color:${esc(bank.color)};--bank-accent:${esc(bank.accent)}" aria-hidden="true"><span>${esc(bank.logo)}</span></span>`;
}

function bankPickerField(selectedName = "") {
  const selected = INDIAN_BANKS.find((b) => b.name === selectedName) || null;
  const triggerLabel = selected
    ? `<span class="bank-picker-value">${bankIconMarkup(selected)}<span>${esc(selected.name)}</span></span>`
    : `<span class="bank-picker-placeholder">Select your bank</span>`;
  return `
    <label class="bank-picker-label">Bank <span class="bank-picker-required">*</span>
      <div class="bank-picker" data-bank-picker>
        <input type="hidden" name="bankName" value="${esc(selected?.name || "")}" required>
        <button type="button" class="bank-picker-trigger" aria-haspopup="listbox" aria-expanded="false">
          ${triggerLabel}
          <span class="bank-picker-chevron" aria-hidden="true"></span>
        </button>
        <ul class="bank-picker-menu" role="listbox" hidden>
          ${INDIAN_BANKS.map((bank) => `
            <li role="option">
              <button type="button" class="bank-picker-option${selected?.name === bank.name ? " selected" : ""}" data-bank-name="${esc(bank.name)}">
                ${bankIconMarkup(bank)}
                <span class="bank-picker-option-name">${esc(bank.name)}</span>
              </button>
            </li>`).join("")}
        </ul>
      </div>
    </label>`;
}

function closeAllBankPickers(except) {
  document.querySelectorAll("[data-bank-picker].open").forEach((picker) => {
    if (except && picker === except) return;
    picker.classList.remove("open");
    const menu = picker.querySelector(".bank-picker-menu");
    const trigger = picker.querySelector(".bank-picker-trigger");
    if (menu) menu.hidden = true;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  });
}

function setBankPickerValue(picker, bankName) {
  const bank = INDIAN_BANKS.find((b) => b.name === bankName);
  if (!bank) return;
  const hidden = picker.querySelector('input[name="bankName"]');
  const trigger = picker.querySelector(".bank-picker-trigger");
  if (hidden) hidden.value = bank.name;
  if (trigger) {
    trigger.innerHTML = `<span class="bank-picker-value">${bankIconMarkup(bank)}<span>${esc(bank.name)}</span></span><span class="bank-picker-chevron" aria-hidden="true"></span>`;
  }
  picker.querySelectorAll(".bank-picker-option").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.bankName === bank.name);
  });
  closeAllBankPickers();
}

function openForgotPasswordModal() {
  const overlay = document.createElement("div");
  overlay.className = "admin-modal-overlay";
  overlay.id = "forgotPasswordModal";
  overlay.innerHTML = `
    <div class="auth-modal" role="dialog">
      <div class="admin-modal-head">
        <h2>Reset password</h2>
        <button type="button" class="admin-modal-close" id="closeForgotPassword" aria-label="Close">×</button>
      </div>
      <form class="admin-modal-form grid" id="forgotPasswordForm">
        <p class="subtle">We will send a 6-digit OTP to your registered email.</p>
        <label>Email <input name="email" type="email" required placeholder="you@example.com"></label>
        <div class="otp-verify-block" data-otp-channel="email">
          <div class="otp-verify-head">
            <span>Email OTP</span>
            <button type="button" class="secondary otp-send-btn" data-otp-send="email" data-otp-purpose="reset_password">Send OTP</button>
          </div>
          <input name="code" type="text" inputmode="numeric" maxlength="6" pattern="\\d{6}" placeholder="6-digit OTP" required>
          <p class="otp-dev-hint subtle hidden" id="forgotPwDevOtp"></p>
        </div>
        ${passwordField("New password", "newPassword", 'minlength="6" required')}
        <div class="admin-modal-actions">
          <button type="button" class="secondary" id="closeForgotPassword2">Cancel</button>
          <button type="submit" class="gradient-button">Update password</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.classList.add("modal-open");
}

function closeForgotPasswordModal() {
  document.querySelector("#forgotPasswordModal")?.remove();
  document.body.classList.remove("modal-open");
}

function selectPaymentMethodCard(card) {
  const grid = card.closest(".payment-method-grid");
  if (!grid) return;
  const block = grid.closest(".payment-source-block");
  const hidden = block?.querySelector("[data-payment-source-input]");
  const value = card.dataset.paymentValue;
  if (!hidden || !value) return;
  hidden.value = value;
  grid.querySelectorAll(".payment-method-card").forEach((btn) => {
    const on = btn === card;
    btn.classList.toggle("selected", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function authScreen() {
  app.innerHTML = `
    <section class="auth-shell">
      <div class="auth-art">
        <div class="auth-art-bg">
          <div class="auth-blob blob-a"></div>
          <div class="auth-blob blob-b"></div>
          <div class="auth-grid"></div>
        </div>
        <div class="auth-art-top">
          <div class="brand">${swiftPayBrandMarkup("auth-brand-logo")}</div>
        </div>
        <div class="auth-art-mid">
          <span class="auth-tagline-eyebrow">Demo wallet platform</span>
          <h1>E-wallet management - just get yo damn wallet gang.</h1>
          <p>Every user receives a unique user ID, memorable wallet ID and QR payment code. Money is dummy, but authentication and records are stored in the local database.</p>
        </div>
        <div class="auth-art-bottom">
          <div class="auth-trust-row">
            <span class="auth-trust-chip">🔒 256-bit encrypted</span>
            <span class="auth-trust-chip">⚡ Instant wallet setup</span>
            <span class="auth-trust-chip">🎓 Academic sandbox</span>
          </div>
        </div>
      </div>
      <div class="auth-panel">
        <div class="auth-card">
          <div class="tabs">
            <button class="${state.authTab === "login" ? "active" : ""}" data-auth-tab="login">Login</button>
            <button class="${state.authTab === "signup" ? "active" : ""}" data-auth-tab="signup">Sign up</button>
          </div>
          ${state.authTab === "login" ? loginForm() : signupForm()}
        </div>
      </div>
    </section>
  `;
}

function loginForm() {
  return `
    <h2 class="form-title">Welcome back</h2>
    <p class="subtle">${state.loginRole === "admin" ? "Administrator login only — not for registered users." : "Registered user login — use Sign up if you are new."}</p>
    <form class="grid" id="loginForm">
      <div class="segmented">
        <button type="button" class="${state.loginRole === "user" ? "active" : ""}" data-login-role="user">User</button>
        <button type="button" class="${state.loginRole === "admin" ? "active" : ""}" data-login-role="admin">Admin</button>
      </div>
      <label>Email <input name="email" type="email" required placeholder="you@example.com"></label>
      ${passwordField("Password", "password", "required")}
      ${state.loginRole === "user" ? `<button type="button" class="link-button auth-forgot-link" id="openForgotPassword">Forgot password?</button>` : ""}
      <button>Login</button>
    </form>
  `;
}

function validateBankAccField(input) {
  let e = input.parentNode.querySelector('.bank-acc-err');
  const valid = /^\d{8,18}$/.test(input.value.trim());

  if (!valid) {
    if (!e) {
      input.insertAdjacentHTML(
        'afterend',
        '<div class="bank-acc-err" style="color:red;font-size:12px;margin-top:4px;">Bank account number must be 8 to 18 digits</div>'
      );
    }
  } else if (e) {
    e.remove();
  }
}

function showFieldError(input, message) {
  if (!input) return;
  let err = input.parentNode.querySelector(".field-err");
  if (!err) {
    err = document.createElement("div");
    err.className = "field-err";
    err.style.cssText = "color:red;font-size:12px;margin-top:4px;";
    input.insertAdjacentElement("afterend", err);
  }
  err.textContent = message;
}

function clearFieldError(input) {
  if (!input) return;
  const err = input.parentNode.querySelector(".field-err");
  if (err) err.remove();
}

function clearBankAccError(input) {
  const e = input.parentNode.querySelector('.bank-acc-err');
  if (e) e.remove();
}

function signupForm() {
  const d = state.signupData || {};
  const selectedUpi = d.upiHandle || "@ybl";
  const upiItems = [{ label: "@ybl (PhonePe)", value: "@ybl" }, { label: "@axl (Axis)", value: "@axl" }, { label: "@paytm", value: "@paytm" }, { label: "@oksbi", value: "@oksbi" }];
  const upiActiveIndex = Math.max(0, upiItems.findIndex(i => i.value === selectedUpi));
  return `
    <h2 class="form-title">Create wallet</h2>
    <p class="subtle">Verify email and phone with OTP, then complete your profile. UPI ID is generated from your phone.</p>
    <form class="grid" id="signupForm">
      <div class="two">
        <label>Full name <input name="name" required placeholder="Your name" value="${esc(d.name || '')}"></label>
        <label>Date of birth <input name="dob" type="date" required max="${MAX_DOB}" value="${esc(d.dob || '')}"></label>
      </div>
      <label>Email <input name="email" id="signupEmail" type="email" required placeholder="you@example.com" value="${esc(d.email || '')}" ${state.signupOtp.email ? 'readonly' : ''} oninput="clearFieldError(this)"></label>
      ${otpVerifyBlock("email", "Email verification", "email", state.signupOtp.email)}
      <label>Phone (10 digits) <input name="phone" id="signupPhone" required placeholder="9876543210" inputmode="numeric" maxlength="10" value="${esc(d.phone || '')}" ${state.signupOtp.phone ? 'readonly' : ''}></label>
      ${otpVerifyBlock("phone", "Phone verification", "phone", state.signupOtp.phone)}
      <div class="two bank-signup-row">
        ${bankPickerField(d.bankName || '')}
        <label>Bank account no. (unique) <input name="bankAccountNo" required placeholder="12345678" value="${esc(d.bankAccountNo || '')}" onblur="validateBankAccField(this)" oninput="clearBankAccError(this)"></label>
      </div>
      <label>UPI provider ${chipGroup("upiHandle", upiItems, upiActiveIndex)}</label>
      <input type="hidden" name="upiHandle" value="${esc(selectedUpi)}" data-mirror-radio="upiHandle">
      <div class="two">
        ${passwordField("Password", "password", 'required minlength="6"')}
        ${passwordField("Transaction PIN (4 digits)", "transactionPin", 'required minlength="4" maxlength="4" pattern="\\d{4}" inputmode="numeric"')}
      </div>
      <label>Address <input name="address" placeholder="City, state (optional)" value="${esc(d.address || '')}"></label>
      <button>Create account and wallet</button>
    </form>
  `;
}

function navBadge(count) {
  if (!count || count <= 0) return "";
  const label = count > 99 ? "99+" : String(count);
  return `<span class="nav-badge-pill" aria-label="${label} unread">${label}</span>`;
}

function unreadNotificationCount() {
  if (state.unreadCounts?.total != null) return state.unreadCounts.total;
  return (state.notifications || []).filter((n) => !Number(n.is_read)).length;
}

function unreadSupportCount() {
  if (state.unreadCounts?.support != null) return state.unreadCounts.support;
  return (state.notifications || []).filter((n) => !Number(n.is_read) && String(n.notification_type || "").toLowerCase() === "support").length;
}

function navButton(id, label, icon) {
  let badge = "";
  if (id === "notifications") badge = navBadge(unreadNotificationCount());
  if (id === "support" || id === "admin-support") badge = navBadge(unreadSupportCount());
  return `<button class="${state.view === id ? "active" : ""}" data-view="${id}"><span class="nav-icon" aria-hidden="true">${icon}</span><span class="nav-label">${label}</span>${badge}</button>`;
}

function notificationBellBtn() {
  const count = unreadNotificationCount();
  const badge = count > 0
    ? `<span class="topbar-notif-badge" aria-label="${count} unread">${count > 99 ? '99+' : count}</span>`
    : '';
  const isActive = state.view === 'notifications';
  return `<button type="button" class="ghost-icon ghost-icon-notif${isActive ? ' active-notif' : ''}" id="topbarNotifBtn" title="Notifications" aria-label="Notifications${count > 0 ? `, ${count} unread` : ''}">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
    ${badge}
  </button>`;
}

function todayDateDisplay() {
  const date = new Date();
  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  const formatted = date.toLocaleDateString('en-US', options);
  return `<div class="topbar-date" aria-label="Current date">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
    <span>${formatted}</span>
  </div>`;
}

function shell(title, body) {
  const nav = state.role === "admin"
    ? [
      ["dashboard", "Dashboard", "DB"],
      ["wallet", "My Wallet", "WL"],
      ["add-money", "Add Money", "+-"],
      ["transfer", "Transfer", "TR"],
      ["bills", "Pay Bills", "$"],
      ["recharge", "Recharge", "RC"],
      ["qrpay", "QR Pay", "QR"],
      ["history", "Transactions", "HX"],
      ["support", "Help & Support", "SP"],
      ["profile", "Profile", "PF"],
      ["admin", "Admin Panel", "AD"],
      ["admin-support", "Support Admin", "SA"]
    ]
    : [
      ["dashboard", "Dashboard", "DB"],
      ["wallet", "My Wallet", "WL"],
      ["add-money", "Add Money", "+-"],
      ["transfer", "Transfer", "TR"],
      ["bills", "Pay Bills", "$"],
      ["recharge", "Recharge", "RC"],
      ["qrpay", "QR Pay", "QR"],
      ["history", "Transactions", "HX"],
      ["support", "Help & Support", "SP"],
      ["profile", "Profile", "PF"]
    ];

  app.innerHTML = `
    <section class="layout">
      <aside class="sidebar">
        <div class="brand">${swiftPayBrandMarkup("sidebar-brand-logo")}</div>
        <div class="nav">${nav.map(([id, label, icon]) => navButton(id, label, icon)).join("")}</div>
        ${state.role === "user" ? `<div class="sidebar-footer"><div class="avatar">${initials(state.user?.name)}</div><div><strong>${esc(state.user?.name)}</strong><span>${esc(state.user?.email)}</span></div></div>` : ""}
        ${state.role === "admin" ? `<div class="sidebar-footer"><div class="avatar">AU</div><div><strong>${esc(state.admin?.name || "Admin User")}</strong><span>${esc(state.admin?.email)}</span></div></div>` : ""}
        <button
          class="logout-link"
          id="logoutBtn"
          type="button"
          style="display:flex; justify-content:center; align-items:center; transition:0.25s ease;"
          onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(0,0,0,0.18)';"
          onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';"
        >
          Sign out
        </button>
      </aside>
      <section class="content">
        <div class="topbar">
          <h1>${title}</h1>
          <div class="top-icons">
            ${todayDateDisplay()}
            ${notificationBellBtn()}
          </div>
        </div>
        ${body}
      </section>
    </section>
  `;
}

function balanceStrip(label = "Available Balance", icon = "BAL") {
  return `<div class="balance-strip"><span class="balance-icon">${icon}</span><div><span>${label}</span><strong>${walletMoney(state.user.balance)}</strong></div></div>`;
}

function pageCard(title, body, icon = "BAL") {
  return `<div class="pay-shell">${balanceStrip(title === "Add Virtual Money" ? "Current Balance" : "Available Balance", icon)}<div class="form-card"><h2>${title}</h2>${body}</div></div>`;
}

function amountInput() {
  return `<label>Amount (INR)<div class="currency-input"><span>Rs</span><input name="amount" type="number" step="0.01" min="1" required placeholder="0.00"></div></label>`;
}

function chipGroup(name, items, activeIndex = 0) {
  return `<div class="chip-grid">${items.map((item, index) => `<label class="choice-chip ${index === activeIndex ? "selected" : ""}"><input type="radio" name="${name}" value="${esc(item.value || item)}" ${index === activeIndex ? "checked" : ""}><span>${item.icon ? `<b>${item.icon}</b>` : ""}${esc(item.label || item)}</span></label>`).join("")}</div>`;
}

function segmentPicker(name, items, defaultValue) {
  const list = items.map((item) => (typeof item === "string" ? { label: item, value: item } : item));
  return `
    <div class="segment-picker" data-segment-picker="${esc(name)}">
      <input type="hidden" name="${esc(name)}" value="${esc(defaultValue)}" data-segment-input>
      <div class="segment-picker-grid" role="radiogroup" aria-label="${esc(name)}">
        ${list.map((item) => `
          <button type="button" class="segment-option${item.value === defaultValue ? " selected" : ""}"
            data-segment-value="${esc(item.value)}" aria-pressed="${item.value === defaultValue ? "true" : "false"}">
            ${esc(item.label)}
          </button>`).join("")}
      </div>
    </div>`;
}

function syncPayByTargets(mode) {
  const wallet = document.querySelector(".pay-target-wallet");
  const upi = document.querySelector(".pay-target-upi");
  const phone = document.querySelector(".pay-target-phone");
  if (!wallet && !upi && !phone) return;
  
  wallet?.classList.toggle("hidden", mode !== "wallet");
  if (wallet) wallet.querySelectorAll("input").forEach(i => i.disabled = mode !== "wallet");
  
  upi?.classList.toggle("hidden", mode !== "upi");
  if (upi) upi.querySelectorAll("input").forEach(i => i.disabled = mode !== "upi");
  
  phone?.classList.toggle("hidden", mode !== "phone");
  if (phone) phone.querySelectorAll("input").forEach(i => i.disabled = mode !== "phone");
}

function selectSegmentOption(button) {
  const picker = button.closest("[data-segment-picker]");
  if (!picker) return;
  const hidden = picker.querySelector("[data-segment-input]");
  const value = button.dataset.segmentValue;
  if (!hidden || !value) return;
  hidden.value = value;
  picker.querySelectorAll(".segment-option").forEach((btn) => {
    const on = btn === button;
    btn.classList.toggle("selected", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  if (picker.dataset.segmentPicker === "payBy") syncPayByTargets(value);
  if (picker.dataset.segmentPicker === "requestPayBy") syncRequestPayByTargets(value);
  if (picker.dataset.segmentPicker === "transferMode") syncTransferModePanels(value);
}

function syncRequestPayByTargets(mode) {
  const wallet = document.querySelector(".pay-target-request-wallet");
  const upi = document.querySelector(".pay-target-request-upi");
  const phone = document.querySelector(".pay-target-request-phone");
  if (!wallet && !upi && !phone) return;
  
  wallet?.classList.toggle("hidden", mode !== "wallet");
  if (wallet) wallet.querySelectorAll("input").forEach(i => i.disabled = mode !== "wallet");
  
  upi?.classList.toggle("hidden", mode !== "upi");
  if (upi) upi.querySelectorAll("input").forEach(i => i.disabled = mode !== "upi");
  
  phone?.classList.toggle("hidden", mode !== "phone");
  if (phone) phone.querySelectorAll("input").forEach(i => i.disabled = mode !== "phone");
}

function syncTransferModePanels(mode) {
  const sendPanel = document.querySelector(".transfer-send-panel");
  const requestPanel = document.querySelector(".transfer-request-panel");
  if (sendPanel) {
    sendPanel.classList.toggle("hidden", mode !== "send");
    sendPanel.querySelectorAll("input, select, textarea").forEach(el => el.disabled = mode !== "send");
  }
  if (requestPanel) {
    requestPanel.classList.toggle("hidden", mode !== "request");
    requestPanel.querySelectorAll("input, select, textarea").forEach(el => el.disabled = mode !== "request");
  }
  
  const form = document.getElementById("moneyForm");
  if (!form) return;
  form.dataset.endpoint = mode === "send" ? "/api/wallet/send" : "/api/wallet/money-requests";
  form.dataset.kind = mode === "send" ? "transfer" : "request-money";
  const btn = form.querySelector(".gradient-button");
  if (btn) btn.textContent = mode === "send" ? "Send Money" : "Request Money";
}

function paymentSourcePicker(name, methods, defaultValue = "upi") {
  const list = methods || PAYMENT_METHODS;
  return `
    <div class="payment-source-block">
      <span class="payment-source-label">Payment source</span>
      <input type="hidden" name="${name}" value="${esc(defaultValue)}" data-payment-source-input>
      <div class="payment-method-grid" role="radiogroup" aria-label="Payment source">
        ${list.map((m, i) => `
          <button type="button" class="payment-method-card tone-${m.tone}${m.value === defaultValue ? " selected" : ""}"
            data-payment-value="${esc(m.value)}" aria-pressed="${m.value === defaultValue ? "true" : "false"}">
            <span class="payment-method-icon" aria-hidden="true">${esc(m.icon)}</span>
            <span class="payment-method-text">
              <strong>${esc(m.label)}</strong>
              <small>${esc(m.desc)}</small>
            </span>
            <span class="payment-method-check" aria-hidden="true"></span>
          </button>`).join("")}
      </div>
    </div>`;
}

function otpVerifyBlock(channel, label, inputName, verified) {
  const devHint = channel !== "email" && state.signupOtpDev?.[channel]
    ? `<p class="otp-dev-hint subtle">Demo OTP: <code>${esc(state.signupOtpDev[channel])}</code> (also in server console)</p>`
    : "";
  return `
    <div class="otp-verify-block" data-otp-channel="${channel}">
      <div class="otp-verify-head">
        <span>${esc(label)} ${verified ? '<span class="otp-verified-badge">Verified</span>' : ""}</span>
        <button type="button" class="secondary otp-send-btn" data-otp-send="${channel}" ${verified ? "disabled" : ""}>Send OTP</button>
      </div>
      <div class="otp-input-row">
        <input name="${inputName}Otp" type="text" inputmode="numeric" maxlength="6" pattern="\\d{6}" placeholder="6-digit OTP" ${verified ? "disabled" : ""} autocomplete="one-time-code">
        <button type="button" class="secondary otp-verify-btn" data-otp-verify="${channel}" ${verified ? "disabled" : ""}>Verify</button>
      </div>
      <input type="hidden" name="${inputName}Verified" value="${verified ? "1" : "0"}">
      ${devHint}
    </div>`;
}

function userDashboard() {
  const u = state.user;
  if (!u?.wallet_id) {
    return shell("Dashboard", `${walletHealthBanner()}<div class="dashboard-wrap"><div class="form-card wide"><h2>Wallet unavailable</h2><p class="subtle">Could not load your wallet. Try Refresh (top right) or sign out and sign in again.</p></div></div>`);
  }
  const totalIn = state.transactions.filter((t) => t.receiver_wallet_id === u.wallet_id).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalOut = state.transactions.filter((t) => t.sender_wallet_id === u.wallet_id).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  shell("Dashboard", `
    <div class="dashboard-wrap dashboard-home">
      ${kycStatusBanner()}
      ${walletHealthBanner()}
      <div class="welcome"><h2>Good day, ${esc(firstName(u.name))}</h2><p>Here's your financial overview</p></div>
      <div class="overview-grid">
        <div class="wallet-hero wallet-hero-dash" id="dashWalletHero">
          <div class="wallet-hero-shine" id="dashWalletShine"></div>
          <span class="wallet-mini-icon">WL</span>
          <div>Total Balance</div>
          <strong>Rs <span data-count="${(Number(u.balance || 0) / 100).toFixed(2)}" data-decimals="2">0</span></strong>
          <small>Wallet ID</small>
          <span>${esc(u.wallet_id)}</span>
          ${u.upi_id ? `<small>UPI ID</small><span>${esc(u.upi_id)}</span>` : ""}
        </div>
        <div class="side-metrics">
          <div class="mini-stat in">
            <div class="mini-stat-accent"></div>
            <div class="mini-stat-icon">↙</div>
            <div class="mini-stat-content">
              <p>Total In</p>
              <strong>₹ <span data-count="${Number(totalIn).toFixed(2)}" data-decimals="2">0</span></strong>
              <small>Money received</small>
            </div>
          </div>

          <div class="mini-stat out">
            <div class="mini-stat-accent"></div>
            <div class="mini-stat-icon">↗</div>
            <div class="mini-stat-content">
              <p>Total Out</p>
              <strong>₹ <span data-count="${Number(totalOut).toFixed(2)}" data-decimals="2">0</span></strong>
              <small>Money spent</small>
            </div>
          </div>
        </div>
      </div>
      <div class="form-card wide">
        <h2>Quick Actions</h2>
        <div class="quick-grid">
          ${[["add-money", "+", "Add Money"], ["transfer", "TR", "Transfer"], ["bills", "$", "Pay Bills"], ["recharge", "RC", "Recharge"], ["qrpay", "QR", "QR Pay"], ["history", "HX", "History"]].map(([view, icon, label]) => {
            const locked = state.role === "user" && TX_VIEWS.has(view) && !isUserKycVerified();
            return `<button type="button" class="quick-action${locked ? " disabled" : ""}" data-view="${view}" ${locked ? 'title="Verify KYC first"' : ""}><span>${icon}</span>${label}</button>`;
          }).join("")}
        </div>
      </div>
      <div class="form-card wide">
        <div class="section-row"><h2>Recent Transactions</h2><button class="link-button" data-view="history">View all -></button></div>
        ${state.transactions.length ? transactionsTable(state.transactions.slice(0, 6)) : `<div class="empty-state"><div>HX</div><p>No transactions yet</p></div>`}
      </div>
    </div>
  `);
  requestAnimationFrame(() => {
    initCountUps();
    initDashboardWalletTilt();
  });
}

function transactionsTable(rows) {
  if (!rows.length) return `<div class="subtle">No transactions yet.</div>`;
  return `<div class="scroll"><table><thead><tr><th>Trxn ID</th><th>Type</th><th>Amount</th><th>From</th><th>To / Biller</th><th>Date</th></tr></thead><tbody>
    ${rows.map((t) => `<tr><td>${esc(t.trxn_id)}</td><td><span class="badge">${esc(t.type)}</span></td><td>${money(t.amount)}</td><td>${esc(t.sender_wallet_id || "-")}</td><td>${esc(t.receiver_wallet_id || t.biller || "-")}</td><td>${esc(t.created_at)}</td></tr>`).join("")}
  </tbody></table></div>`;
}

function renderMoneyRequestsPanel() {
  const items = state.moneyRequests || [];
  const header = state.role === "admin"
    ? `<h3>Money requests ${items.length ? `<span class="subtle">(${items.length})</span>` : ""}</h3><p class="subtle">All platform requests — accept/decline incoming, or cancel ones you sent.</p>`
    : `<h3>Money requests</h3><p class="subtle">Incoming requests need your action. Outgoing shows status until paid or closed.</p>`;
  if (!items.length) {
    return `<div class="money-requests-block">${header}<div class="money-requests-empty subtle">No money requests yet.</div></div>`;
  }
  const cards = items.map((r) => {
    const incoming = r.direction === "incoming";
    const outgoing = r.direction === "outgoing";
    const status = String(r.status || "").toUpperCase();
    let actions = "";
    if (incoming && status === "PENDING") {
      actions = `<div class="money-request-actions">
        <button type="button" class="secondary" data-request-action="reject" data-request-id="${esc(r.request_id)}">Decline</button>
        <button type="button" class="gradient-button" data-request-action="accept" data-request-id="${esc(r.request_id)}" data-request-amount="${esc(r.amount)}">Accept &amp; pay</button>
      </div>`;
    } else if (incoming && status === "ACCEPTED") {
      actions = `<div class="money-request-actions">
        <button type="button" class="gradient-button" data-request-action="pay" data-request-id="${esc(r.request_id)}" data-request-amount="${esc(r.amount)}">Pay now</button>
      </div>`;
    } else if (outgoing && status === "PENDING") {
      actions = `<div class="money-request-actions">
        <button type="button" class="secondary" data-request-action="cancel" data-request-id="${esc(r.request_id)}">Cancel request</button>
      </div>`;
    }
    const peer = incoming
      ? (r.requester_name || r.requester_wallet_id)
      : (r.payer_name || r.payer_wallet_id);
    const prefix = incoming ? "Request from" : "Request to";
    const dirLabel = r.direction === "other" ? "Watching" : (incoming ? "Incoming" : "Outgoing");
    return `<div class="money-request-card ${incoming ? "incoming" : outgoing ? "outgoing" : ""}">
      <div class="money-request-head"><strong>${prefix} ${esc(peer)}</strong><span class="money-request-status">${esc(status)} · ${dirLabel}</span></div>
      <p class="money-request-amount">${money(r.amount)}</p>
      <p class="subtle money-request-id">${esc(r.request_id)}</p>
      ${r.note ? `<p class="subtle">${esc(r.note)}</p>` : ""}
      ${actions}
    </div>`;
  }).join("");
  return `<div class="money-requests-block">${header}<div class="money-requests-list">${cards}</div></div>`;
}

function initMoneyTransferForm() {
  syncTransferModePanels("send");
  syncRequestPayByTargets("wallet");
  syncPayByTargets("wallet");
}

function openMoneyRequestPayCheckout(requestId, amount) {
  assertUserCanTransact();
  state.pendingPayment = {
    title: "Pay money request",
    endpoint: `/api/wallet/money-requests/${requestId}/pay`,
    payload: { amount, paymentMethod: "upi" },
    successView: "transfer",
    moneyRequestPay: true
  };
  const overlay = document.createElement("div");
  overlay.className = "checkout-overlay";
  overlay.id = "checkoutOverlay";
  overlay.innerHTML = `
    <div class="upi-pin-box checkout-with-pay" role="dialog" aria-modal="true" data-pin="">
      <div class="upi-pin-head">
        <div class="upi-brand-row"><span class="upi-lock">SP</span><strong>SwiftPay</strong><span>Secure Pay</span></div>
        <button class="upi-close" id="closeCheckout" type="button" aria-label="Close">x</button>
      </div>
      <h2>Pay money request</h2>
      <div class="upi-amount">${money(amount)}</div>
      <div class="checkout-pay-methods">${paymentSourcePicker("paymentMethod", PAYMENT_METHODS, "upi")}</div>
      <div class="upi-label">ENTER WALLET PIN</div>
      <div class="upi-dots" aria-label="PIN length"><span></span><span></span><span></span><span></span></div>
      <div class="upi-error" id="upiError"></div>
      <button type="button" class="gradient-button upi-confirm" id="confirmPinBtn">Confirm payment</button>
      <div class="upi-keypad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-pin-key="${n}">${n}</button>`).join("")}
        <span></span><button type="button" data-pin-key="0">0</button><button type="button" data-pin-back aria-label="Backspace">⌫</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const hiddenPay = overlay.querySelector("[data-payment-source-input]");
  if (hiddenPay) {
    overlay.querySelectorAll(".payment-method-card").forEach((card) => {
      card.addEventListener("click", () => {
        selectPaymentMethodCard(card);
        state.pendingPayment.payload.paymentMethod = card.dataset.paymentValue;
      });
    });
  }
}

function actionForm(kind) {
  if (state.role === "user" && !isUserKycVerified()) {
    const titles = { transfer: "Transfer Money", bills: "Pay Bills", recharge: "Mobile Recharge", "add-money": "Add Money" };
    return kycBlockedPage(titles[kind] || "Payment");
  }
  const configs = {
    transfer: ["Send Money", "/api/wallet/send", "BAL", `
      ${segmentPicker("transferMode", [{ label: "Send Money", value: "send" }, { label: "Request Money", value: "request" }], "send")}
      <div class="transfer-send-panel">
        <label class="send-to-label">Send to (pick one)</label>
        ${segmentPicker("payBy", [{ label: "Wallet ID", value: "wallet" }, { label: "UPI ID", value: "upi" }, { label: "Phone", value: "phone" }], "wallet")}
        <label class="pay-target pay-target-wallet">Receiver Wallet ID <input name="receiverWalletId" placeholder="SWPXXXX1234"></label>
        <label class="pay-target pay-target-upi hidden">Receiver UPI ID <input name="receiverUpiId" placeholder="9876543210@ybl"></label>
        <label class="pay-target pay-target-phone hidden">Receiver phone (10 digits) <input name="receiverPhone" placeholder="9876543210" inputmode="numeric"></label>
        <p class="subtle">Receiver must be a registered user. Enter your transaction PIN at confirmation.</p>
        ${amountInput()}
        ${paymentSourcePicker("paymentMethod", TRANSFER_PAYMENT_METHODS, "wallet")}
        <label>Note (optional) <input name="note" placeholder="Rent, dinner, etc."></label>
      </div>
      <div class="transfer-request-panel hidden">
        <label class="send-to-label">Request from (pick one)</label>
        ${segmentPicker("requestPayBy", [{ label: "Wallet ID", value: "wallet" }, { label: "UPI ID", value: "upi" }, { label: "Phone", value: "phone" }], "wallet")}
        <label class="pay-target pay-target-request-wallet">Payer Wallet ID <input name="payerWalletId" placeholder="SWPXXXX1234" disabled></label>
        <label class="pay-target pay-target-request-upi hidden">Payer UPI ID <input name="payerUpiId" placeholder="9876543210@ybl" disabled></label>
        <label class="pay-target pay-target-request-phone hidden">Payer phone (10 digits) <input name="payerPhone" placeholder="9876543210" inputmode="numeric" disabled></label>
        <p class="subtle">They will get a notification. If they accept, they complete payment with UPI, card, net banking, or wallet balance.</p>
        ${amountInput()}
        <label>Note (optional) <input name="requestNote" placeholder="Dinner split, rent share, etc." disabled></label>
      </div>`],
    bills: ["Bill Payment", "/api/wallet/pay-bill", "BAL", `
      <label>Bill Type ${chipGroup("billType", [{ label: "Electricity", value: "Electricity Board", icon: "$" }, { label: "Water", value: "Water Tax", icon: "~" }, { label: "DTH", value: "DTH", icon: "TV" }, { label: "Broadband", value: "Broadband", icon: "WI" }])}</label>
      <input type="hidden" name="biller" value="Electricity Board" data-mirror-radio="billType">
      <label>Provider ${chipGroup("provider", ["BESCOM", "MSEDCL", "TPDDL", "KSEB", "PSPCL"])}</label>
      <label>Consumer / Account ID <input name="accountRef" required placeholder="Your account number"></label>
      <label>Bill Month (optional) <input name="billMonth" type="month"></label>
      ${amountInput()}`],
    recharge: ["Mobile Recharge", "/api/wallet/pay-bill", "RC", `
      <label>Mobile Number <input name="accountRef" required placeholder="10-digit mobile number" inputmode="numeric"></label>
      <label>Operator ${chipGroup("biller", ["Jio", "Airtel", "Vi (Vodafone Idea)", "BSNL", "MTNL"])}</label>
      <label>Select Pack or Enter Amount
        <div class="pack-grid">
          ${[["19", "1 Day / 200MB"], ["49", "7 Days / 1GB/day"], ["179", "28 Days / 1.5GB/day"], ["299", "28 Days / 2GB/day"], ["599", "84 Days / 1.5GB/day"], ["999", "84 Days / 3GB/day"]].map(([amount, detail]) => `<button type="button" class="pack-option" data-amount="${amount}"><strong>Rs${amount}</strong><span>${detail}</span></button>`).join("")}
        </div>
      </label>
      ${amountInput()}`],
    "add-money": ["Add Virtual Money", "/api/wallet/topup", "WL", `
      ${amountInput()}
      <label>Quick amounts <div class="quick-amounts">${[100, 500, 1000, 2000, 5000, 10000].map((n) => `<button type="button" class="amount-pill" data-amount="${n}">${money(n).replace(".00", "")}</button>`).join("")}</div></label>
      ${paymentSourcePicker("paymentMethod", PAYMENT_METHODS, "upi")}
      <input name="note" type="hidden" value="Virtual money top-up">`]
  };

  const [title, endpoint, icon, fields] = configs[kind];
  shell(kind === "transfer" ? "Transfer Money" : kind === "bills" ? "Pay Bills" : kind === "recharge" ? "Mobile Recharge" : "Add Money", `
    ${pageCard(title, `
      <form class="grid" id="moneyForm" data-kind="${kind}" data-endpoint="${endpoint}">
        ${fields}
        <button class="gradient-button">${kind === "transfer" ? "Send Money" : kind === "recharge" ? "Recharge Now" : kind === "add-money" ? "+ Add Money" : "Pay Bill"}</button>
      </form>
    `, icon)}
    ${kind === "transfer" ? renderMoneyRequestsPanel() : ""}
  `);
  if (kind === "transfer") {
    requestAnimationFrame(() => initMoneyTransferForm());
  }
}

function qrPay() {
  if (state.role === "user" && !isUserKycVerified()) return kycBlockedPage("QR Pay");
  shell("QR Pay", `
    <div class="pay-shell">
      ${balanceStrip("Available Balance", "QR")}
      <div class="form-card">
        <h2>Scan or paste QR payload</h2>
        <form class="grid" id="qrPayForm">
          <label>QR payload or wallet ID <textarea name="payload" required placeholder='{"app":"SwiftPay","wallet_id":"SWPXXXX1234","action":"pay"}'></textarea></label>
          ${amountInput()}
          <button class="gradient-button">Pay scanned wallet</button>
        </form>
      </div>
      <div class="form-card">
        <h2>Your QR Code</h2>
        <p class="subtle">Share this code to receive payments instantly</p>
        ${qrImageTag()}
      </div>
    </div>
  `);
}

function walletView() {
  if (!state.user?.wallet_id) {
    return shell("My Wallet", `${walletHealthBanner()}<div class="wallet-page"><div class="form-card wide"><h2>Wallet unavailable</h2><p class="subtle">Refresh the page or contact support if this continues.</p></div></div>`);
  }
  const walletLabel = String(state.user.wallet_status || state.user.status || "active").toLowerCase() === "active"
    ? (isUserKycVerified() ? "Active" : `KYC: ${esc(state.user.kyc_status || "pending")}`)
    : esc(state.user.wallet_status || state.user.status || "restricted");
  shell("My Wallet", `
    <div class="wallet-page">
      ${kycStatusBanner()}
      ${walletHealthBanner()}
      <div class="wallet-hero large">
        <div class="wallet-title"><span class="wallet-mini-icon">WL</span><span>SwiftPay Wallet</span><span class="muted-pill">${walletLabel}</span></div>
        <small>Available Balance</small>
        <strong>${walletMoney(state.user.balance)}</strong>
        <small>Wallet ID</small>
        <span>${esc(state.user.wallet_id)}</span>
        ${state.user.upi_id ? `<small>UPI ID</small><span>${esc(state.user.upi_id)}</span>` : ""}
      </div>
      <div class="form-card wide pin-card">
        <span class="pin-icon">PIN</span>
        <div><strong>Payment PIN</strong><p>PIN is set. You can change it from Profile settings.</p></div>
        <button class="gradient-button" data-view="profile">Change PIN</button>
      </div>
      <div class="form-card wide">
        <h2>Your QR Code</h2>
        <p class="subtle">Share this code to receive payments instantly</p>
        ${qrImageTag()}
      </div>
      <div class="wallet-actions">
        <button type="button" class="wallet-action${isUserKycVerified() ? "" : " disabled"}" data-view="add-money" ${isUserKycVerified() ? "" : 'title="Verify KYC first"'}><span>+</span>Add Money</button>
        <button type="button" class="wallet-action${isUserKycVerified() ? "" : " disabled"}" data-view="transfer" ${isUserKycVerified() ? "" : 'title="Verify KYC first"'}><span>TR</span>Transfer</button>
        <button type="button" class="wallet-action${isUserKycVerified() ? "" : " disabled"}" data-view="bills" ${isUserKycVerified() ? "" : 'title="Verify KYC first"'}><span>$</span>Pay Bills</button>
      </div>
    </div>
  `);
}

function notificationTypeMeta(type) {
  const key = String(type || "transaction").toLowerCase();
  const map = {
    transaction: { label: "Transaction", icon: "TX", tone: "tx" },
    kyc: { label: "KYC", icon: "KY", tone: "kyc" },
    security: { label: "Security", icon: "SC", tone: "security" },
    support: { label: "Support", icon: "SP", tone: "support" },
    complaint: { label: "Support", icon: "SP", tone: "support" },
    admin: { label: "Admin", icon: "AD", tone: "admin" },
    system: { label: "System", icon: "SY", tone: "system" }
  };
  return map[key] || { label: "Alert", icon: "NT", tone: "system" };
}

function formatNotificationTime(value) {
  if (!value) return "";
  const raw = String(value).replace(" ", "T");
  const date = new Date(raw.endsWith("Z") ? raw : `${raw}Z`);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 19).replace("T", " ");
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return date.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function renderNotificationCard(n) {
  const meta = notificationTypeMeta(n.notification_type);
  const unread = !Number(n.is_read);
  return `
    <article class="notification-card ${unread ? "unread" : "read"}" role="listitem">
      <div class="notification-icon tone-${meta.tone}" aria-hidden="true">${meta.icon}</div>
      <div class="notification-body">
        <div class="notification-top">
          <h3 class="notification-title">${esc(n.title)}</h3>
          ${unread ? `<span class="notification-unread-dot" title="Unread"></span>` : ""}
        </div>
        <p class="notification-message">${esc(n.message)}</p>
        <div class="notification-meta">
          <span class="notification-type-pill">${esc(meta.label)}</span>
          <time class="notification-time">${esc(formatNotificationTime(n.created_at || n.sent_at))}</time>
        </div>
      </div>
    </article>`;
}

function notificationsView() {
  const items = state.notifications || [];
  const unreadCount = items.filter((n) => !Number(n.is_read)).length;
  shell("Notifications", `
    <div class="dashboard-wrap notifications-page">
      <div class="notifications-hero">
        <div>
          <p class="notifications-eyebrow">Inbox</p>
          <h2>Your notifications</h2>
          <p class="subtle">${unreadCount ? `${unreadCount} unread message${unreadCount === 1 ? "" : "s"}` : "You're all caught up"}</p>
        </div>
        ${items.length ? `<button type="button" class="secondary notifications-mark-read" id="markReadBtn">Mark all read</button>` : ""}
      </div>
      <div class="notifications-feed" role="list">
        ${items.length
    ? items.map(renderNotificationCard).join("")
    : `<div class="notifications-empty">
            <div class="notifications-empty-icon" aria-hidden="true">NT</div>
            <h3>No notifications yet</h3>
            <p>Transfers, KYC updates, and support replies will appear here.</p>
          </div>`}
      </div>
    </div>
  `);
}

function history() {
  shell("Transactions", `<div class="dashboard-wrap"><div class="form-card wide"><h2>All wallet transactions</h2>${transactionsTable(state.transactions)}</div></div>`);
}

function profile() {
  const isAdmin = state.role === "admin";
  const pinResetAllowed = Boolean(state.user?.pin_reset_allowed);
  shell("Profile Settings", `
    <div class="dashboard-wrap two-col">
      ${isAdmin ? `<div class="form-card"><h2>Admin account</h2><p class="subtle">Wallet ID: <strong>${esc(state.user?.wallet_id)}</strong></p><p class="subtle">Admins are managed in Admin Panel → Admins table.</p></div>` : `
      <div class="form-card"><h2>Change profile</h2>
        <form class="grid" id="profileForm">
          <label>Name <input name="name" value="${esc(state.user.name)}"></label>
          <label>Phone <input name="phone" value="${esc(state.user.phone)}"></label>
          <label>UPI ID <input value="${esc(state.user.upi_id)}" readonly></label>
          <label>KYC status <input value="${esc(state.user.kyc_status || "pending")}" readonly title="Only admin can change this"></label>
          <label>Date of birth <input name="dob" type="date" value="${esc(state.user.dob)}" max="${MAX_DOB}"></label>
          <label>Address <input name="address" value="${esc(state.user.address)}"></label>
          <button class="gradient-button">Save profile</button>
        </form>
      </div>`}
      <div class="form-card"><h2>Security</h2>
        <form class="grid" id="passwordForm">
          ${passwordField("Current password", "currentPassword", "required")}
          ${passwordField("New password", "newPassword", 'minlength="6" required')}
          <button class="gradient-button">Change password</button>
        </form>
        <hr>
        <form class="grid" id="pinForm">
          ${passwordField("Current PIN", "currentPin", 'required minlength="4" maxlength="4" pattern="\\d{4}" inputmode="numeric"')}
          ${passwordField("New PIN (4 digits)", "newPin", 'minlength="4" maxlength="4" pattern="\\d{4}" required inputmode="numeric"')}
          <button class="gradient-button">Change transaction PIN</button>
        </form>
        <hr>
        <div class="pin-forgot-block">
          <h3 class="profile-subhead">Forgot transaction PIN?</h3>
          <p class="subtle">This raises a support ticket. After an admin marks it under review, accepted, or resolved, you can set a new PIN below.</p>
          <button type="button" class="secondary" id="forgotPinBtn">Request PIN reset</button>
        </div>
        ${pinResetAllowed ? `
        <div class="pin-reset-approved">
          <p class="pin-reset-notice">Your forgot-PIN request was approved. Set a new 4-digit transaction PIN.</p>
          <form class="grid" id="pinResetForm">
            ${passwordField("New PIN", "newPin", 'required minlength="4" maxlength="4" pattern="\\d{4}" inputmode="numeric"')}
            ${passwordField("Confirm new PIN", "confirmPin", 'required minlength="4" maxlength="4" pattern="\\d{4}" inputmode="numeric"')}
            <button type="submit" class="gradient-button">Set new PIN</button>
          </form>
        </div>` : ""}
      </div>
    </div>
  `);
}

function adminDashboard() {
  const t = state.overview || {};
  const users = state.adminData.users || [];
  const wallets = state.adminData.wallets || [];
  const transactions = state.adminData.transactions || [];
  const notifications = state.adminData.notifications || [];
  const walletQr = state.adminData.wallet_qr || [];
  const admins = state.adminData.admins || [];
  const schema = ADMIN_TABLE_SCHEMA[state.adminTable];
  ensureAdminFilter(state.adminTable);

  shell("Admin Dashboard", `
    <div class="admin-page">
      <div class="admin-stats">
        <div class="admin-stat admin-stat-glow"><span>Total Users</span><strong><span data-count="${t.users || 0}">0</span></strong><b class="stat-icon users">US</b></div>
        <div class="admin-stat admin-stat-glow"><span>Total Wallets</span><strong><span data-count="${t.wallets || 0}">0</span></strong><b class="stat-icon wallets">WL</b></div>
        <div class="admin-stat admin-stat-glow"><span>Total Transactions</span><strong><span data-count="${t.transactions || 0}">0</span></strong><b class="stat-icon txns">TR</b></div>
        <div class="admin-stat admin-stat-wide admin-stat-glow"><span>Money In System</span><strong>Rs <span data-count="${Number(t.totalBalance || 0).toFixed(2)}" data-decimals="2">0</span></strong><b class="stat-icon money">IN</b></div>
      </div>

      <section class="admin-panel">
        <header class="admin-panel-head">
          <div>
            <h2>Database Tables</h2>
            <p>ER model — primary & foreign keys</p>
          </div>
          <div class="admin-schema-tags">
            <span class="schema-tag pk">PK: user_id</span>
            <span class="schema-tag pk">wallet_id</span>
            <span class="schema-tag pk">transaction_id</span>
            <span class="schema-tag pk">qr_id</span>
            <span class="schema-tag pk">notification_id</span>
          </div>
          <div class="admin-schema-tags fk">
            <span class="schema-tag fk">Wallet.user_id → User</span>
            <span class="schema-tag fk">Transaction → Wallet</span>
            <span class="schema-tag fk">Wallet_QR.wallet_id → Wallet</span>
            <span class="schema-tag fk">Notification.user_id → User</span>
          </div>
        </header>

        <div class="admin-tabs" role="tablist">
          ${[
            ["admins", "Admins", admins.length],
            ["users", "Users", users.length],
            ["wallets", "Wallets", wallets.length],
            ["transactions", "Transactions", transactions.length],
            ["notifications", "Notifications", notifications.length],
            ["wallet_qr", "Wallet QR", walletQr.length]
          ].map(([id, label, count]) => `<button type="button" role="tab" aria-selected="${state.adminTable === id}" class="${state.adminTable === id ? "active" : ""}" data-admin-table="${id}">${label}<em>${count}</em></button>`).join("")}
        </div>

        <div class="admin-table-card">
          <div class="admin-table-tools">
            <div class="admin-filter-row">
              <label class="admin-filter-by">
                <span>Filter by</span>
                <select id="adminFilterField">${adminFilterOptions(state.adminTable)}</select>
              </label>
              <label class="admin-search">
                <span>Search</span>
                <input id="adminSearch" placeholder="Type to filter ${esc(schema?.title || "table")}..." value="${esc(state.adminSearch)}">
              </label>
            </div>
            <div class="admin-table-meta">
              <span class="admin-table-name">${esc(schema?.title || "")}</span>
              <span>${adminVisibleRows().length} rows</span>
              <span class="admin-pk">PK: <code>${esc(schema?.pk || "")}</code></span>
              <button type="button" class="gradient-button admin-add-row" id="adminAddRowBtn">+ Add row</button>
            </div>
          </div>
          ${adminTableMarkup()}
        </div>
      </section>
    </div>
  `);

  requestAnimationFrame(() => initCountUps());
}

function adminVisibleRows() {
  const rows = state.adminData[state.adminTable] || [];
  const q = state.adminSearch.trim().toLowerCase();
  if (!q) return rows;
  ensureAdminFilter(state.adminTable);
  const field = state.adminFilterBy[state.adminTable];
  return rows.filter((row) => String(row[field] ?? "").toLowerCase().includes(q));
}

function formatAdminCell(row, column) {
  let raw = row[column.key];
  if (column.key === "qr_code" && (raw == null || raw === "")) raw = row.qr_payload || row.qr_code_value;
  if (raw == null || raw === "") return "—";
  if (column.bool) return Number(raw) ? "yes" : "no";
  if (column.money) return money(raw);
  let text = String(raw);
  if (column.date) text = text.slice(0, 19).replace("T", " ");
  if (column.truncate && text.length > column.truncate) text = `${text.slice(0, column.truncate)}…`;
  return text;
}

function adminTableMarkup() {
  const schema = ADMIN_TABLE_SCHEMA[state.adminTable];
  const rows = adminVisibleRows();
  if (!schema) return `<div class="admin-table-host"><div class="subtle">Unknown table.</div></div>`;
  const head = schema.columns.map((c) => `<th>${esc(c.label)}</th>`).join("");
  const monoKeys = new Set(["user_id", "wallet_id", "transaction_id", "qr_id", "notification_id", "sender_wallet_id", "receiver_wallet_id", "email", "phone", "qr_code", "bank_account_no", "password", "transaction_pin"]);
  const body = rows.map((row) => {
    const cells = schema.columns.map((column) => {
      const display = formatAdminCell(row, column);
      let full = row[column.key];
      if (column.key === "qr_code" && (full == null || full === "")) full = row.qr_payload || row.qr_code_value;
      full = full == null ? "" : String(full);
      const mono = monoKeys.has(column.key) ? " col-mono" : "";
      return `<td class="${mono.trim()}" title="${esc(full)}">${esc(display)}</td>`;
    }).join("");
    const actions = `<button type="button" class="table-action" data-edit-id="${row.id}">Edit</button><button type="button" class="table-danger" data-delete-id="${row.id}">Delete</button>`;
    return `<tr>${cells}<td class="admin-actions">${actions}</td></tr>`;
  }).join("");
  const empty = rows.length ? "" : `<div class="admin-empty">No rows in ${esc(schema.title)}.</div>`;
  return `<div class="admin-table-host"><div class="admin-table-scroll"><table class="admin-clean-table" aria-label="${esc(schema.title)} table"><thead><tr>${head}<th>actions</th></tr></thead><tbody>${body}</tbody></table></div>${empty}</div>`;
}

function openAdminEditModal(row) {
  const table = state.adminTable;
  const fields = ADMIN_EDIT_FIELDS[table] || [];
  const overlay = document.createElement("div");
  overlay.className = "admin-modal-overlay";
  overlay.id = "adminModalOverlay";
  overlay.innerHTML = `
    <div class="admin-modal" role="dialog" aria-modal="true">
      <div class="admin-modal-head">
        <h2>Edit ${esc(ADMIN_TABLE_SCHEMA[table]?.title || table)}</h2>
        <button type="button" class="admin-modal-close" id="closeAdminModal" aria-label="Close">×</button>
      </div>
      <form class="admin-modal-form grid" id="adminEditForm" data-row-id="${row.id}">
        ${fields.map((field) => adminEditFieldHtml(field, row)).join("")}
        <p class="subtle">Leave password and PIN blank to keep current values. Set KYC to <strong>verified</strong> to allow user transactions.</p>
        <div class="admin-modal-actions">
          <button type="button" class="secondary" id="cancelAdminModal">Cancel</button>
          <button type="submit" class="gradient-button">Save changes</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.classList.add("modal-open");
}

function closeAdminEditModal() {
  document.querySelector("#adminModalOverlay")?.remove();
  document.body.classList.remove("modal-open");
}

function adminFormFieldMarkup(field, value = "") {
  const isPwd = /password|pin/i.test(field.label);
  const req = field.required ? " required" : "";
  const placeholder = field.placeholder ? ` placeholder="${esc(field.placeholder)}"` : "";
  if (isPwd) {
    return passwordField(field.label, field.api, `${req}${placeholder} inputmode="numeric"`.trim());
  }
  const type = field.type || "text";
  const step = field.step ? ` step="${field.step}"` : "";
  return `<label>${esc(field.label)}<input name="${field.api}" type="${type}"${step}${req}${placeholder} value="${esc(value)}"></label>`;
}

function openAdminCreateModal() {
  const table = state.adminTable;
  const fields = ADMIN_CREATE_FIELDS[table] || [];
  if (!fields.length) {
    showToast("Cannot add rows to this table.");
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = "admin-modal-overlay";
  overlay.id = "adminModalOverlay";
  overlay.innerHTML = `
    <div class="admin-modal" role="dialog" aria-modal="true">
      <div class="admin-modal-head">
        <h2>Add ${esc(ADMIN_TABLE_SCHEMA[table]?.title || table)}</h2>
        <button type="button" class="admin-modal-close" id="closeAdminModal" aria-label="Close">×</button>
      </div>
      <form class="admin-modal-form grid" id="adminCreateForm">
        ${fields.map((field) => adminFormFieldMarkup(field)).join("")}
        <div class="admin-modal-actions">
          <button type="button" class="secondary" id="cancelAdminModal">Cancel</button>
          <button type="submit" class="gradient-button">Add row</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.classList.add("modal-open");
}

function adminEditBodyFromForm(form) {
  const body = {};
  const rowId = form.dataset.rowId;
  const row = state.adminRows.find((r) => String(r.id) === String(rowId));
  form.querySelectorAll("input[name], select[name], textarea[name]").forEach((el) => {
    if (!el.name) return;
    const value = el.type === "checkbox" ? (el.checked ? 1 : 0) : el.value;
    if (el.name === "balance" && row) {
      const prevRupee = (Number(row.balance || 0) / 100).toFixed(2);
      const nextRupee = Number(value || 0).toFixed(2);
      if (prevRupee === nextRupee) return;
    }
    body[el.name] = value;
  });
  if (body.password_plain === "") delete body.password_plain;
  if (body.transaction_pin_plain === "") delete body.transaction_pin_plain;
  return body;
}

function adminEditFieldHtml(field, row) {
  const raw = row[field.key] ?? "";
  const value = esc(String(raw));
  if (field.readonly) {
    return `<label>${esc(field.label)}<input type="text" value="${value}" readonly tabindex="-1"></label>`;
  }
  if (field.input === "kyc") {
    const current = String(raw).toLowerCase();
    const opts = ["pending", "verified", "rejected"]
      .map((s) => `<option value="${s}" ${current === s ? "selected" : ""}>${s}</option>`)
      .join("");
    return `<label>${esc(field.label)}<select name="${field.api}">${opts}</select></label>`;
  }
  if (field.input === "account") {
    const current = String(raw).toLowerCase();
    const opts = ["active", "suspended", "closed"]
      .map((s) => `<option value="${s}" ${current === s ? "selected" : ""}>${s}</option>`)
      .join("");
    return `<label>${esc(field.label)}<select name="${field.api}">${opts}</select></label>`;
  }
  const isPwd = /password|pin/i.test(field.label);
  if (isPwd) {
    return passwordField(field.label, field.api, `value="${value}" autocomplete="off"`);
  }
  const type = field.type || "text";
  const step = field.step ? ` step="${field.step}"` : "";
  if (field.key === "balance") {
    const rupees = (Number(raw || 0) / 100).toFixed(2);
    return `<label>${esc(field.label)}<input name="${field.api}" type="number" step="0.01" min="0" value="${esc(rupees)}"></label>`;
  }
  if (field.api === "message") {
    return `<label>${esc(field.label)}<textarea name="${field.api}" rows="3">${value}</textarea></label>`;
  }
  return `<label>${esc(field.label)}<input name="${field.api}" type="${type}"${step} value="${value}"></label>`;
}

function adminTables() {
  const tables = ["users", "wallets", "wallet_qr", "transactions", "notifications", "admins"];
  const rows = state.adminRows;
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  shell("Manage Tables", `
    <div class="panel"><div class="actions">${tables.map((t) => `<button class="${state.adminTable === t ? "" : "secondary"}" data-admin-table="${t}">${t}</button>`).join("")}</div></div>
    <div class="panel scroll">
      <table class="admin-table"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}<th>Action</th></tr></thead><tbody>
      ${rows.map((r) => `<tr>${cols.map((c) => `<td title="${esc(r[c])}">${esc(r[c])}</td>`).join("")}<td>${["users", "transactions", "notifications"].includes(state.adminTable) ? `<button class="danger" data-delete-id="${r.id}">Delete</button>` : `<span class="subtle">Protected</span>`}</td></tr>`).join("")}
      </tbody></table>${rows.length ? "" : `<div class="subtle">No rows in this table.</div>`}
    </div>
  `);
}

function adminCreateUser() {
  shell("Add User", `<div class="panel"><h2>Create user and wallet</h2><form class="grid" id="adminUserForm">${signupForm().match(/<form class="grid" id="signupForm">([\s\S]*)<\/form>/)[1].replace("Create account and wallet", "Add user")}</form></div>`);
}

async function loadWalletData() {
  try {
    const me = await api("/api/me");
    state.user = me.user;
  } catch (error) {
    showToast(error.message);
    state.user = state.user || null;
  }
  try {
    const tx = await api("/api/transactions");
    state.transactions = tx.transactions || [];
  } catch {
    state.transactions = state.transactions || [];
  }
  try {
    const notifs = await api("/api/notifications");
    state.notifications = notifs.notifications || [];
  } catch {
    state.notifications = state.notifications || [];
  }
  try {
    const unread = await api("/api/notifications/unread-count");
    state.unreadCounts = { total: unread.total || 0, support: unread.support || 0 };
  } catch {
    state.unreadCounts = { total: unreadNotificationCount(), support: unreadSupportCount() };
  }
  if (state.role === "user" || state.role === "admin") {
    try {
      const mr = await api("/api/wallet/money-requests");
      state.moneyRequests = mr.requests || [];
    } catch {
      state.moneyRequests = state.moneyRequests || [];
    }
  }
}

async function loadAdmin() {
  const [overview, admins, users, wallets, transactions, notifications, walletQr] = await Promise.all([
    api("/api/admin/overview"),
    api("/api/admin/admins"),
    api("/api/admin/users"),
    api("/api/admin/wallets"),
    api("/api/admin/transactions"),
    api("/api/admin/notifications"),
    api("/api/admin/wallet_qr")
  ]);
  state.overview = overview.totals;
  state.adminData = {
    admins: admins.rows,
    users: users.rows,
    wallets: wallets.rows,
    transactions: transactions.rows,
    notifications: notifications.rows,
    wallet_qr: walletQr.rows
  };
  state.adminRows = state.adminData[state.adminTable] || [];
}

async function route(view = state.view) {
  state.view = view;
  if (state.role === "guest") return authScreen();
  if (state.role === "user") {
    await loadWalletData();
    if (view === "transfer" || view === "bills" || view === "recharge" || view === "add-money") return actionForm(view);
    if (view === "wallet") return walletView();
    if (view === "qrpay") return qrPay();
    if (view === "history") return history();
    if (view === "notifications") return notificationsView();
    if (view === "profile") return profile();
    if (view === "support" || view === "support-new" || view === "support-detail") return routeSupport(view);
    return userDashboard();
  }
  if (state.role === "admin") {
    await loadWalletData();
    if (view === "transfer" || view === "bills" || view === "recharge" || view === "add-money") return actionForm(view);
    if (view === "wallet") return walletView();
    if (view === "qrpay") return qrPay();
    if (view === "history") return history();
    if (view === "notifications") return notificationsView();
    if (view === "profile") return profile();
    if (view === "admin-support" || view === "support-detail") return routeSupport(view);
    if (view !== "admin" && view !== "users" && view !== "create-user") return userDashboard();
    await loadAdmin();
    if (view === "users") return adminTables();
    if (view === "create-user") return adminCreateUser();
    return adminDashboard();
  }
}

function openCheckout({ title, endpoint, payload, successView = "dashboard" }) {
  assertUserCanTransact();
  state.pendingPayment = { title, endpoint, payload, successView };
  const overlay = document.createElement("div");
  overlay.className = "checkout-overlay";
  overlay.id = "checkoutOverlay";
  overlay.innerHTML = `
    <div class="upi-pin-box" role="dialog" aria-modal="true" aria-labelledby="checkoutTitle" data-pin="">
      <div class="upi-pin-head">
        <div class="upi-brand-row">
          <span class="upi-lock">SP</span>
          <strong>SwiftPay</strong>
          <i></i>
          <span>Secure Pay</span>
        </div>
        <button class="upi-close" id="closeCheckout" type="button" aria-label="Close">x</button>
      </div>
      <div class="upi-shield">SH</div>
      <h2 id="checkoutTitle">${esc(title)}</h2>
      <div class="upi-amount">${money(payload.amount)}</div>
      <div class="upi-step"><span></span><span></span></div>
      <div class="upi-divider"></div>
      <div class="upi-label">ENTER WALLET PIN</div>
      <div class="upi-dots" aria-label="PIN length">
        <span></span><span></span><span></span><span></span>
      </div>
      <div class="upi-error" id="upiError"></div>
      <button type="button" class="gradient-button upi-confirm" id="confirmPinBtn">Confirm PIN</button>
      <div class="upi-keypad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-pin-key="${n}">${n}</button>`).join("")}
        <span></span>
        <button type="button" data-pin-key="0">0</button>
        <button type="button" data-pin-back aria-label="Backspace">⌫</button>
      </div>
      <div class="upi-safe">256-bit encrypted · RBI compliant</div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function closeCheckout() {
  state.pendingPayment = null;
  document.querySelector("#checkoutOverlay")?.remove();
}

function updatePinDisplay(box) {
  const pin = box.dataset.pin || "";
  box.querySelectorAll(".upi-dots span").forEach((dot, index) => dot.classList.toggle("filled", index < pin.length));
}

function isValidCheckoutPin(pin) {
  return /^\d{4}$/.test(pin);
}

async function submitCheckoutPin(box) {
  const pending = state.pendingPayment;
  const pin = box.dataset.pin || "";
  if (!pending || box.dataset.busy === "1") return;
  if (!isValidCheckoutPin(pin)) {
    box.querySelector("#upiError").textContent = "Enter your 4-digit transaction PIN.";
    return;
  }
  box.dataset.busy = "1";
  box.classList.add("paying");
  box.querySelector("#upiError").textContent = "";
  try {
    const payMethod = document.querySelector("#checkoutOverlay [data-payment-source-input]")?.value
      || pending.payload.paymentMethod;
    const data = await api(pending.endpoint, { method: "POST", body: { ...pending.payload, pin, paymentMethod: payMethod } });
    if (data.user) state.user = data.user;
    closeCheckout();
    showToast("Payment successful.");
    await loadWalletData();
    return route(pending.successView);
  } catch (error) {
    box.dataset.pin = "";
    updatePinDisplay(box);
    box.classList.remove("paying");
    box.dataset.busy = "0";
    box.querySelector("#upiError").textContent = error.message;
  }
}

document.addEventListener("click", async (e) => {
  if (e.target.closest("#topbarNotifBtn")) {
    return route("notifications");
  }

  const reqBtn = e.target.closest("[data-request-action]");
  if (reqBtn && canUseMoneyRequests()) {
    try {
      assertUserCanTransact();
      const id = reqBtn.dataset.requestId;
      const amount = reqBtn.dataset.requestAmount;
      const action = reqBtn.dataset.requestAction;
      if (action === "reject") {
        await api(`/api/wallet/money-requests/${id}/respond`, { method: "PATCH", body: { action: "reject" } });
        showToast("Request declined.");
        await loadWalletData();
        return route("transfer");
      }
      if (action === "cancel") {
        await api(`/api/wallet/money-requests/${id}/cancel`, { method: "PATCH" });
        showToast("Request cancelled.");
        await loadWalletData();
        return route("transfer");
      }
      if (action === "accept") {
        await api(`/api/wallet/money-requests/${id}/respond`, { method: "PATCH", body: { action: "accept" } });
        showToast("Request accepted. Choose payment method and enter PIN.");
        return openMoneyRequestPayCheckout(id, amount);
      }
      if (action === "pay") {
        return openMoneyRequestPayCheckout(id, amount);
      }
    } catch (err) {
      showToast(err.message);
    }
    return;
  }

  const segmentBtn = e.target.closest(".segment-option");
  if (segmentBtn) {
    selectSegmentOption(segmentBtn);
    return;
  }

  const payCard = e.target.closest(".payment-method-card");
  if (payCard) {
    selectPaymentMethodCard(payCard);
    return;
  }

  if (e.target.id === "openForgotPassword") {
    openForgotPasswordModal();
    return;
  }
  if (e.target.id === "closeForgotPassword" || e.target.id === "closeForgotPassword2" || (e.target.id === "forgotPasswordModal" && e.target === e.currentTarget)) {
    closeForgotPasswordModal();
    return;
  }

  if (e.target.closest("[data-otp-send]")) {
    const btn = e.target.closest("[data-otp-send]");
    const channel = btn.dataset.otpSend;
    const purpose = btn.dataset.otpPurpose || "signup";
    const form = btn.closest("form") || document;
    const target = channel === "email"
      ? (form.querySelector("#signupEmail") || form.querySelector('input[name="email"]'))?.value?.trim()
      : (form.querySelector("#signupPhone") || form.querySelector('input[name="phone"]'))?.value?.trim();
    if (!target) {
      showToast(channel === "email" ? "Enter your email first." : "Enter your phone first.");
      return;
    }
    try {
      // Save current form data before re-rendering
      if (purpose === "signup" && form && form.id === "signupForm") {
        saveSignupFormData(form);
      }
      const data = await api("/api/auth/otp/send", { method: "POST", body: { channel, target, purpose } });
      if (purpose === "signup") state.signupOtpDev[channel] = channel === "email" ? "" : (data.dev_otp || "");
      const hint = document.getElementById("forgotPwDevOtp");
      if (hint && data.dev_otp) {
        hint.textContent = `Demo OTP: ${data.dev_otp}`;
        hint.classList.remove("hidden");
      }
      showToast(data.delivery_hint || "OTP sent.");
      if (purpose === "signup") authScreen();
    } catch (err) {
      if (purpose === "signup" && (channel === "email" || channel === "phone")) {
        const fieldInput = channel === "email"
          ? (form.querySelector("#signupEmail") || form.querySelector('input[name="email"]'))
          : (form.querySelector("#signupPhone") || form.querySelector('input[name="phone"]'));
        showFieldError(fieldInput, err.message);
      }
      showToast(err.message);
    }
    return;
  }

  if (e.target.closest("[data-otp-verify]")) {
    const btn = e.target.closest("[data-otp-verify]");
    const channel = btn.dataset.otpVerify;
    const block = btn.closest("[data-otp-channel]") || btn.closest(".otp-verify-block");
    const form = btn.closest("form") || document;
    const target = channel === "email"
      ? (form.querySelector("#signupEmail") || form.querySelector('input[name="email"]'))?.value?.trim()
      : (form.querySelector("#signupPhone") || form.querySelector('input[name="phone"]'))?.value?.trim();
    const code = block?.querySelector('input[name$="Otp"], input[name="code"]')?.value?.trim();
    if (!target || !code) {
      showToast("Enter the OTP code.");
      return;
    }
    try {
      // Save current form data before re-rendering
      if (form && form.id === "signupForm") {
        saveSignupFormData(form);
      }
      await api("/api/auth/otp/verify", { method: "POST", body: { channel, target, code, purpose: "signup" } });
      state.signupOtp[channel] = true;
      showToast(`${channel === "email" ? "Email" : "Phone"} verified.`);
      authScreen();
    } catch (err) { showToast(err.message); }
    return;
  }

  if (e.target.id === "forgotPinBtn") {
    try {
      const data = await api("/api/support/forgot-pin", { method: "POST" });
      showToast(data.message || "Forgot PIN request submitted.");
      state.view = "support";
      return route("support");
    } catch (err) { showToast(err.message); }
    return;
  }

  const authTab = e.target.closest("[data-auth-tab]");
  if (authTab) {
    if (authTab.dataset.authTab !== "signup") {
      // Clear signup data when switching away from signup
      state.signupData = {};
      state.signupOtp = { email: false, phone: false };
      state.signupOtpDev = { email: "", phone: "" };
    }
    state.authTab = authTab.dataset.authTab;
    return authScreen();
  }
  const loginRole = e.target.closest("[data-login-role]");
  if (loginRole) { state.loginRole = loginRole.dataset.loginRole; return authScreen(); }
  const view = e.target.closest("[data-view]");
  if (view) {
    const id = view.dataset.view;
    if (view.classList.contains("disabled") || (state.role === "user" && TX_VIEWS.has(id) && !isUserKycVerified())) {
      showToast(`KYC must be verified before transactions. Status: ${state.user?.kyc_status || "pending"}.`);
      return route(state.role === "user" ? "dashboard" : id);
    }
    return route(id);
  }
  const table = e.target.closest("[data-admin-table]");
  if (table) {
    state.adminTable = table.dataset.adminTable;
    state.adminSearch = "";
    ensureAdminFilter(state.adminTable);
    return route(state.role === "admin" ? "admin" : "users");
  }
  if (e.target.id === "closeAdminModal" || e.target.id === "cancelAdminModal") return closeAdminEditModal();
  if (e.target.classList.contains("admin-modal-overlay") && e.target.id === "adminModalOverlay") return closeAdminEditModal();
  const bankOption = e.target.closest(".bank-picker-option");
  if (bankOption) {
    const picker = bankOption.closest("[data-bank-picker]");
    if (picker) setBankPickerValue(picker, bankOption.dataset.bankName);
    return;
  }
  const bankTrigger = e.target.closest(".bank-picker-trigger");
  if (bankTrigger) {
    const picker = bankTrigger.closest("[data-bank-picker]");
    if (!picker) return;
    const willOpen = !picker.classList.contains("open");
    closeAllBankPickers(picker);
    picker.classList.toggle("open", willOpen);
    const menu = picker.querySelector(".bank-picker-menu");
    if (menu) menu.hidden = !willOpen;
    bankTrigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
    return;
  }
  if (!e.target.closest("[data-bank-picker]")) closeAllBankPickers();

  const pwdToggle = e.target.closest(".password-toggle");
  if (pwdToggle) {
    const input = document.getElementById(pwdToggle.dataset.target);
    if (!input) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    pwdToggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
    pwdToggle.classList.toggle("visible", show);
    return;
  }
  if (e.target.id === "logoutBtn") { await api("/api/auth/logout", { method: "POST" }); state = { ...state, role: "guest", user: null, admin: null }; return authScreen(); }
  if (e.target.id === "markReadBtn") { await api("/api/notifications/read", { method: "PATCH" }); showToast("Notifications marked as read."); return route("notifications"); }
  if (e.target.id === "closeCheckout") return closeCheckout();
  const pinKey = e.target.closest("[data-pin-key]");
  if (pinKey) {
    const box = pinKey.closest(".upi-pin-box");
    if (!box || box.dataset.busy === "1") return;
    box.dataset.pin = `${box.dataset.pin || ""}${pinKey.dataset.pinKey}`.slice(0, 4);
    updatePinDisplay(box);
    box.querySelector("#upiError").textContent = "";
    if (box.dataset.pin.length === 4) await submitCheckoutPin(box);
    return;
  }
  if (e.target.id === "confirmPinBtn") {
    const box = e.target.closest(".upi-pin-box");
    if (box) await submitCheckoutPin(box);
    return;
  }
  const pinBack = e.target.closest("[data-pin-back]");
  if (pinBack) {
    const box = pinBack.closest(".upi-pin-box");
    if (!box || box.dataset.busy === "1") return;
    box.dataset.pin = (box.dataset.pin || "").slice(0, -1);
    updatePinDisplay(box);
    return;
  }
  const amountButton = e.target.closest("[data-amount]");
  if (amountButton) {
    const form = amountButton.closest("form");
    const input = form?.querySelector('input[name="amount"]');
    if (input) input.value = amountButton.dataset.amount;
    form?.querySelectorAll(".amount-pill, .pack-option").forEach((btn) => {
      btn.classList.toggle("selected", btn === amountButton);
    });
    return;
  }
  if (e.target.id === "adminAddRowBtn") {
    openAdminCreateModal();
    return;
  }
  const edit = e.target.closest("[data-edit-id]");
  if (edit) {
    const row = (state.adminData[state.adminTable] || []).find((item) => String(item.id) === String(edit.dataset.editId));
    if (row) openAdminEditModal(row);
    return;
  }
  const del = e.target.closest("[data-delete-id]");
  if (del && confirm("Delete this row and all related records? This cannot be undone.")) {
    const rowId = del.dataset.deleteId;
    if (!rowId) {
      showToast("Could not find row id to delete.");
      return;
    }
    try {
      const result = await api(`/api/admin/${state.adminTable}/${rowId}`, { method: "DELETE" });
      const parts = result.summary ? Object.entries(result.summary).filter(([k, v]) => k !== "table" && v > 0).map(([k, v]) => `${v} ${k}`) : [];
      showToast(parts.length ? `Deleted: ${parts.join(", ")}.` : "Row deleted.");
      return route(state.role === "admin" ? "admin" : "users");
    } catch (error) {
      showToast(error.message);
    }
    return;
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "adminSearch") {
    state.adminSearch = e.target.value;
    refreshAdminTableUi();
  }
});

document.addEventListener("change", (e) => {
  if (e.target.id === "adminFilterField") {
    state.adminFilterBy[state.adminTable] = e.target.value;
    refreshAdminTableUi();
    return;
  }
  if (e.target.matches('input[type="radio"]')) {
    document.querySelectorAll(`input[name="${e.target.name}"]`).forEach((input) => input.closest(".choice-chip")?.classList.toggle("selected", input.checked));
  }
});

document.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    if (e.target.id === "loginForm") {
      const endpoint = state.loginRole === "admin" ? "/api/auth/admin/login" : "/api/auth/user/login";
      const data = await api(endpoint, { method: "POST", body: formData(e.target) });
      state.role = data.role || state.loginRole;
      state.user = data.user || null;
      state.admin = data.admin || null;
      state.view = state.role === "admin" ? "admin" : "dashboard";
      showToast("Logged in.");
      return route();
    }
    if (e.target.id === "forgotPasswordForm") {
      const fd = formData(e.target);
      await api("/api/auth/forgot-password/reset", {
        method: "POST",
        body: { email: fd.email, code: fd.code, newPassword: fd.newPassword }
      });
      closeForgotPasswordModal();
      showToast("Password updated. You can log in now.");
      state.authTab = "login";
      return authScreen();
    }
    if (e.target.id === "pinResetForm") {
      const fd = formData(e.target);
      if (fd.newPin !== fd.confirmPin) throw new Error("PIN and confirmation do not match.");
      await api("/api/me/pin/reset-after-forgot", { method: "PATCH", body: { newPin: fd.newPin, confirmPin: fd.confirmPin } });
      showToast("New transaction PIN set.");
      await loadWalletData();
      return route("profile");
    }
    if (e.target.id === "signupForm") {
      if (!state.signupOtp.email || !state.signupOtp.phone) {
        throw new Error("Verify both email and phone with OTP before creating your account.");
      }
      const data = await api("/api/auth/signup", { method: "POST", body: formData(e.target) });
      state.signupOtp = { email: false, phone: false };
      state.signupOtpDev = { email: "", phone: "" };
      state.signupData = {};
      state.role = "user"; state.user = data.user; state.view = "dashboard";
      showToast("Wallet created! Welcome to SwiftPay.");
      return route();
    }
    if (e.target.id === "moneyForm") {
      assertUserCanTransact();
      const data = formData(e.target);
      if (e.target.dataset.kind === "request-money") {
        const payload = { amount: data.amount, note: data.requestNote || "" };
        if (data.requestPayBy === "upi") {
          if (!data.payerUpiId?.trim()) throw new Error("Enter payer UPI ID.");
          payload.payerUpiId = data.payerUpiId.trim();
        } else if (data.requestPayBy === "phone") {
          if (!data.payerPhone?.trim()) throw new Error("Enter payer phone number.");
          payload.payerPhone = data.payerPhone.trim();
        } else {
          if (!data.payerWalletId?.trim()) throw new Error("Enter payer Wallet ID.");
          payload.payerWalletId = data.payerWalletId.trim();
        }
        const res = await api("/api/wallet/money-requests", { method: "POST", body: payload });
        if (res.user) state.user = res.user;
        showToast("Money request sent.");
        await loadWalletData();
        return route("transfer");
      }
      if (e.target.dataset.kind === "transfer") {
        const payload = { amount: data.amount, note: data.note };
        if (data.payBy === "upi") {
          if (!data.receiverUpiId?.trim()) throw new Error("Enter receiver UPI ID.");
          payload.receiverUpiId = data.receiverUpiId.trim();
        } else if (data.payBy === "phone") {
          if (!data.receiverPhone?.trim()) throw new Error("Enter receiver phone number.");
          payload.receiverPhone = data.receiverPhone.trim();
        } else {
          if (!data.receiverWalletId?.trim()) throw new Error("Enter receiver Wallet ID.");
          payload.receiverWalletId = data.receiverWalletId.trim();
        }
        return openCheckout({ title: "Confirm Transfer", endpoint: e.target.dataset.endpoint, payload });
      }
      const checkoutTitle = e.target.dataset.kind === "add-money" ? "Confirm Add Money" : e.target.dataset.kind === "recharge" ? "Confirm Recharge" : "Confirm Bill Payment";
      return openCheckout({ title: checkoutTitle, endpoint: e.target.dataset.endpoint, payload: data });
    }
    if (e.target.id === "qrPayForm") {
      assertUserCanTransact();
      const data = formData(e.target);
      let receiverWalletId = data.payload.trim();
      try { receiverWalletId = JSON.parse(receiverWalletId).wallet_id || receiverWalletId; } catch {}
      return openCheckout({ title: "Confirm QR Payment", endpoint: "/api/wallet/send", payload: { receiverWalletId, amount: data.amount, note: "QR scan payment" } });
    }
    if (e.target.id === "checkoutForm") {
      return;
    }
    if (e.target.id === "profileForm") {
      await api("/api/me", { method: "PATCH", body: formData(e.target) });
      showToast("Profile updated.");
      return route("profile");
    }
    if (e.target.id === "passwordForm") {
      await api("/api/me/password", { method: "PATCH", body: formData(e.target) });
      showToast("Password changed.");
      e.target.reset();
    }
    if (e.target.id === "pinForm") {
      await api("/api/me/pin", { method: "PATCH", body: formData(e.target) });
      showToast("PIN changed.");
      e.target.reset();
    }
    if (e.target.id === "adminCreateForm") {
      const table = state.adminTable;
      await api(`/api/admin/${table}`, { method: "POST", body: adminEditBodyFromForm(e.target) });
      closeAdminEditModal();
      showToast("Row added.");
      return route("admin");
    }
    if (e.target.id === "adminEditForm") {
      const table = state.adminTable;
      const id = e.target.dataset.rowId;
      await api(`/api/admin/${table}/${id}`, { method: "PATCH", body: adminEditBodyFromForm(e.target) });
      closeAdminEditModal();
      showToast("Row updated.");
      return route("admin");
    }
  } catch (error) {
    showToast(error.message);
  }
});

/**
 * Save current signup form field values into state.signupData
 * so they can be restored after OTP re-render.
 */
function saveSignupFormData(form) {
  if (!form) return;
  const fd = new FormData(form);
  const data = {};
  for (const [k, v] of fd.entries()) {
    if (k === 'password' || k === 'transactionPin' || k.endsWith('Otp') || k.endsWith('Verified')) continue;
    data[k] = v;
  }
  // Also capture bank picker hidden input
  const bankInput = form.querySelector('input[name="bankName"]');
  if (bankInput) data.bankName = bankInput.value;
  state.signupData = { ...state.signupData, ...data };
}

applyTheme(state.theme);

(async function init() {
  try {
    const session = await api("/api/session");
    state.role = session.role;
    state.user = session.user || null;
    state.admin = session.admin || null;
    state.view = state.role === "admin" ? "admin" : "dashboard";
    await route();
  } catch (error) {
    state.role = "guest";
    state.user = null;
    state.admin = null;
    authScreen();
    showToast("Session expired. Please log in again.");
  }
})();

document.addEventListener("keydown", async (e) => {
  const box = document.querySelector(".upi-pin-box");
  if (!box || box.dataset.busy === "1") return;
  if (/^\d$/.test(e.key)) {
    box.dataset.pin = `${box.dataset.pin || ""}${e.key}`.slice(0, 4);
    updatePinDisplay(box);
    box.querySelector("#upiError").textContent = "";
    if (box.dataset.pin.length === 4) await submitCheckoutPin(box);
  }
  if (e.key === "Enter") {
    await submitCheckoutPin(box);
  }
  if (e.key === "Backspace") {
    box.dataset.pin = (box.dataset.pin || "").slice(0, -1);
    updatePinDisplay(box);
  }
  if (e.key === "Escape") {
    closeCheckout();
    closeAdminEditModal();
  }
});
