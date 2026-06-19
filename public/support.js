/* Help & Support UI — uses globals from app.js: state, api, esc, shell, showToast, route, money */

const DEFAULT_SUPPORT_CATEGORIES = [
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
const MAX_SUPPORT_FILES = 10;

let supportPendingFiles = [];

function getSupportCategories() {
  const fromApi = state.supportMeta?.categories;
  if (Array.isArray(fromApi) && fromApi.length) return fromApi;
  return DEFAULT_SUPPORT_CATEGORIES;
}

function renderCategoryOptions() {
  return getSupportCategories()
    .filter((c) => c && c !== "__custom__")
    .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)
    .join("");
}

async function apiForm(path, formData, method = "POST") {
  const res = await fetch(path, { method, credentials: "same-origin", body: formData });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {
    if (res.status === 404) {
      throw new Error("Support API not found. Stop any old server, then run npm start again.");
    }
    throw new Error(`Request failed (${res.status}). Restart the server and try again.`);
  }
  if (!res.ok) {
    if (res.status === 401) throw new Error(data.error || "Please log in as a user to submit complaints.");
    if (res.status === 403) throw new Error(data.error || "Only user accounts can submit complaints.");
    throw new Error(data.error || `Request failed (${res.status}).`);
  }
  return data;
}

function fmtDt(value) {
  if (!value) return "—";
  return String(value).slice(0, 19).replace("T", " ");
}

function statusClass(status) {
  return `support-status status-${String(status || "").toLowerCase()}`;
}

function priorityClass(priority) {
  return `support-priority priority-${String(priority || "medium").toLowerCase()}`;
}

function renderTimeline(timeline = []) {
  if (!timeline.length) return `<div class="subtle">No status updates yet.</div>`;
  return `<div class="support-timeline">${timeline.map((step, i) => `
    <div class="support-timeline-step ${i < timeline.length - 1 ? "done" : "current"}">
      <span class="dot"></span>
      <div><span class="timeline-label">${esc(step.label)}</span><small>${fmtDt(step.at)}</small></div>
    </div>`).join("")}</div>`;
}

function renderMessages(messages = [], role) {
  if (!messages.length) return `<div class="subtle">No messages yet.</div>`;
  return `<div class="support-chat">${messages.map((m) => {
    const isAdmin = m.sender_type === "admin";
    const mine = (role === "user" && !isAdmin) || (role === "admin" && isAdmin);
    const senderLabel = isAdmin ? "Support Team" : (role === "admin" ? "Customer" : "You");
    return `<div class="support-bubble ${mine ? "mine" : "theirs"} ${isAdmin ? "admin" : "user"}">
      <div class="bubble-meta"><span class="bubble-sender">${senderLabel}</span><span>${fmtDt(m.created_at)}</span></div>
      <div class="bubble-body">${esc(m.message)}</div>
      ${m.attachment_url ? `<a class="bubble-attach" href="${esc(m.attachment_url)}" target="_blank" rel="noopener">${esc(m.attachment_name || "Attachment")}</a>` : ""}
    </div>`;
  }).join("")}</div>`;
}

async function loadSupportMeta() {
  try {
    const data = await api("/api/support/meta/categories");
    state.supportMeta = {
      categories: data.categories?.length ? data.categories : DEFAULT_SUPPORT_CATEGORIES,
      statuses: data.statuses || [],
      priorities: data.priorities || []
    };
  } catch {
    state.supportMeta = {
      categories: DEFAULT_SUPPORT_CATEGORIES,
      statuses: [],
      priorities: []
    };
  }
  return state.supportMeta;
}

async function loadUserComplaints() {
  const data = await api("/api/support/complaints");
  state.supportComplaints = data.complaints || [];
  return state.supportComplaints;
}

async function loadSupportDetail(complaintId) {
  const prefix = state.role === "admin" ? "/api/admin/support" : "/api/support";
  const data = await api(`${prefix}/complaints/${encodeURIComponent(complaintId)}`);
  state.supportDetail = data.complaint;
  return state.supportDetail;
}

function userSupportHome() {
  const rows = state.supportComplaints || [];
  const openCount = rows.filter((c) => !["RESOLVED", "CLOSED", "REJECTED"].includes(c.status)).length;
  return shell("Help & Support", `
    <div class="support-wrap">
      <div class="support-hero">
        <div class="support-hero-copy">
          <span class="support-eyebrow">SwiftPay Support</span>
          <h2>How can we help you?</h2>
          <p>Raise a ticket, track progress, and chat with our team — usually within 24 hours.</p>
        </div>
        <button type="button" class="gradient-button support-cta" data-view="support-new">
          <span class="support-cta-icon">+</span> New complaint
        </button>
      </div>
      <div class="support-quick-stats">
        <div class="support-stat-pill"><span>Total</span><strong>${rows.length}</strong></div>
        <div class="support-stat-pill accent"><span>Open</span><strong>${openCount}</strong></div>
        <div class="support-stat-pill"><span>Resolved</span><strong>${rows.length - openCount}</strong></div>
      </div>
      <div class="support-panel">
        <div class="support-panel-head">
          <div>
            <h3>Your complaints</h3>
            <p class="subtle">Click a row to view details and messages</p>
          </div>
          <button type="button" class="secondary support-cta-sm" data-view="support-new">Raise complaint</button>
        </div>
        ${rows.length ? `
        <div class="support-table-scroll">
          <table class="support-table">
            <thead><tr><th>Complaint ID</th><th>Subject</th><th>Category</th><th>Created</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${rows.map((c) => `<tr data-support-id="${esc(c.complaint_id)}" tabindex="0" role="button">
                <td class="col-mono">${esc(c.complaint_id)}</td>
                <td class="support-subject-cell">${esc(c.subject)}</td>
                <td><span class="support-cat-tag">${esc(c.category)}</span></td>
                <td>${fmtDt(c.created_at)}</td>
                <td><span class="${statusClass(c.status)}">${esc(c.status.replace(/_/g, " "))}</span></td>
                <td><button type="button" class="table-action" data-support-id="${esc(c.complaint_id)}">Open</button></td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>` : `
        <div class="support-empty">
          <div class="support-empty-icon" aria-hidden="true">?</div>
          <h4>No complaints yet</h4>
          <p>Having an issue with a transfer, wallet, or login? Submit a ticket and we will assist you.</p>
          <button type="button" class="gradient-button" data-view="support-new">Raise your first complaint</button>
        </div>`}
      </div>
    </div>
  `);
}

function userSupportNew() {
  return shell("Raise Complaint", `
    <div class="support-wrap support-wrap-form">
      <nav class="support-breadcrumb">
        <button type="button" class="link-button" data-view="support">Help & Support</button>
        <span>/</span>
        <span>New complaint</span>
      </nav>
      <div class="support-form-header">
        <h2>Tell us what went wrong</h2>
        <p class="subtle">Fields marked with <span class="support-required">*</span> are required. Attach screenshots to speed up resolution.</p>
      </div>
      <form class="support-form" id="supportCreateForm" enctype="multipart/form-data">
        <div class="support-form-section">
          <h3>Issue details</h3>
          <div class="support-form-grid">
            <label class="support-field span-2">
              <span>Subject <span class="support-required">*</span></span>
              <input name="subject" required maxlength="200" placeholder="e.g. Payment failed but amount debited">
            </label>
            <label class="support-field span-2">
              <span>Category <span class="support-required">*</span></span>
              <select name="category" id="supportCategorySelect" required>
                <option value="">— Select a category —</option>
                ${renderCategoryOptions()}
              </select>
            </label>
            <label class="support-field span-2">
              <span>Description <span class="support-required">*</span></span>
              <textarea name="description" required rows="5" placeholder="Include date, amount, and what you expected to happen…"></textarea>
            </label>
          </div>
        </div>
        <div class="support-form-section">
          <h3>Reference (optional)</h3>
          <div class="support-form-grid two-col">
            <label class="support-field">
              <span>Wallet ID</span>
              <input name="walletId" placeholder="${esc(state.user?.wallet_id || "SWP…")}" value="${esc(state.user?.wallet_id || "")}">
            </label>
            <label class="support-field">
              <span>Transaction ID</span>
              <input name="transactionId" placeholder="TRX_…">
            </label>
          </div>
        </div>
        <div class="support-form-section">
          <h3>Attachments <span class="subtle">(optional)</span></h3>
          <p class="subtle support-file-hint">Add multiple screenshots or documents — you can browse more than once.</p>
          <input type="file" id="supportFileInput" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" multiple hidden>
          <div class="support-file-actions">
            <button type="button" class="secondary" id="supportAddFilesBtn">+ Add images / files</button>
            <span class="subtle" id="supportFileCount">0 / ${MAX_SUPPORT_FILES} files</span>
          </div>
          <div class="support-file-previews" id="supportFilePreviews"></div>
        </div>
        <div class="support-form-actions">
          <button type="button" class="secondary" data-view="support">Cancel</button>
          <button type="submit" class="gradient-button">Submit complaint</button>
        </div>
      </form>
    </div>
  `);
}

function supportDetailView() {
  const c = state.supportDetail;
  if (!c) return userSupportHome();
  const isAdmin = state.role === "admin";
  return shell(isAdmin ? `Complaint ${c.complaint_id}` : "Complaint Details", `
    <div class="support-wrap support-detail-page">
      <nav class="support-breadcrumb">
        <button type="button" class="link-button" data-view="${isAdmin ? "admin-support" : "support"}">${isAdmin ? "Support Admin" : "Help & Support"}</button>
        <span>/</span>
        <span>${esc(c.complaint_id)}</span>
      </nav>
      <div class="support-detail-grid">
        <div class="support-panel support-detail-main">
          <div class="support-detail-head">
            <div>
              <p class="support-detail-eyebrow">Complaint</p>
              <h2 class="support-detail-title">${esc(c.subject)}</h2>
              <p class="support-detail-id">ID <code class="col-mono">${esc(c.complaint_id)}</code></p>
            </div>
            <span class="${statusClass(c.status)}">${esc(String(c.status).replace(/_/g, " "))}</span>
          </div>
          <div class="support-meta-grid">
            <div><span>Category</span><p class="meta-value">${esc(c.category)}</p></div>
            <div><span>Priority</span><p class="meta-value ${priorityClass(c.priority)}">${esc(c.priority)}</p></div>
            <div><span>User ID</span><p class="meta-value col-mono">${esc(c.user_id)}</p></div>
            <div><span>Wallet ID</span><p class="meta-value col-mono">${esc(c.wallet_id || "—")}</p></div>
            <div><span>Transaction</span><p class="meta-value col-mono">${esc(c.transaction_id || "—")}</p></div>
            <div><span>Created</span><p class="meta-value">${fmtDt(c.created_at)}</p></div>
            <div><span>Updated</span><p class="meta-value">${fmtDt(c.updated_at)}</p></div>
            ${isAdmin ? `<div class="span-2"><span>User</span><p class="meta-value">${esc(c.user_name)}</p><small class="support-detail-email">${esc(c.user_email)}</small></div>` : ""}
          </div>
          <h3 class="support-section-title">Description</h3>
          <p class="support-description">${esc(c.description)}</p>
          ${c.attachments?.length ? `<h3>Attachments</h3><div class="support-attachments">${c.attachments.map((a) =>
            a.mime_type?.startsWith("image/")
              ? `<a href="${esc(a.file_url)}" target="_blank" rel="noopener"><img class="support-thumb" src="${esc(a.file_url)}" alt="${esc(a.file_name)}"></a>`
              : `<a href="${esc(a.file_url)}" target="_blank" rel="noopener">${esc(a.file_name)}</a>`
          ).join("")}</div>` : ""}
          ${isAdmin ? `
          <h3>Admin actions</h3>
          <div class="support-admin-actions">
            <label>Status <select id="adminStatusSelect">${(state.supportMeta?.statuses || []).map((s) => `<option value="${s}" ${s === c.status ? "selected" : ""}>${s}</option>`).join("")}</select></label>
            <label>Priority <select id="adminPrioritySelect">${(state.supportMeta?.priorities || []).map((p) => `<option value="${p}" ${p === c.priority ? "selected" : ""}>${p}</option>`).join("")}</select></label>
            <button type="button" class="secondary" data-support-action="UNDER_REVIEW">Mark Under Review</button>
            <button type="button" class="gradient-button" data-support-action="ACCEPTED">Accept</button>
            <button type="button" class="danger" data-support-action="REJECTED">Reject</button>
            <button type="button" class="gradient-button" data-support-action="RESOLVED">Resolve</button>
            <button type="button" class="secondary" data-support-action="CLOSED">Close</button>
          </div>` : ""}
        </div>
        <div class="support-panel">
          <h3>Status tracker</h3>
          ${renderTimeline(c.timeline)}
        </div>
      </div>
      <div class="support-panel">
        <h3>Conversation</h3>
        ${renderMessages(c.messages, state.role)}
        <form class="support-reply-form" id="supportMessageForm">
          <label class="support-field span-2"><span>Your message</span><textarea name="message" rows="3" placeholder="Type your message…"></textarea></label>
          <label class="support-field"><span>Attachment (optional)</span><input type="file" name="attachment" accept=".jpg,.jpeg,.png,.webp,.pdf,image/*,application/pdf"></label>
          <button type="submit" class="gradient-button">Send message</button>
        </form>
      </div>
      ${isAdmin && c.history?.length ? `
      <div class="support-panel">
        <h3>Audit trail</h3>
        <div class="support-table-scroll">
          <table class="admin-clean-table"><thead><tr><th>From</th><th>To</th><th>By</th><th>When</th></tr></thead><tbody>
          ${c.history.map((h) => `<tr><td>${esc(h.old_status || "—")}</td><td>${esc(h.new_status)}</td><td>${esc(h.changed_by_type)} ${esc(h.changed_by_id || "")}</td><td>${fmtDt(h.changed_at)}</td></tr>`).join("")}
          </tbody></table>
        </div>
      </div>` : ""}
    </div>
  `);
}

function adminSupportDashboard() {
  const s = state.adminSupportStats || {};
  const rows = state.adminSupportComplaints || [];
  const f = state.adminSupportFilters || {};
  return shell("Help & Support Admin", `
    <div class="support-wrap admin-support">
      <div class="admin-stats support-stats">
        <div class="admin-stat"><span>Total</span><strong>${s.total || 0}</strong></div>
        <div class="admin-stat"><span>Open</span><strong>${s.open || 0}</strong></div>
        <div class="admin-stat"><span>Under Review</span><strong>${s.under_review || 0}</strong></div>
        <div class="admin-stat"><span>Accepted</span><strong>${s.accepted || 0}</strong></div>
        <div class="admin-stat"><span>Rejected</span><strong>${s.rejected || 0}</strong></div>
        <div class="admin-stat"><span>Resolved</span><strong>${s.resolved || 0}</strong></div>
        <div class="admin-stat"><span>Closed</span><strong>${s.closed || 0}</strong></div>
      </div>
      <div class="support-panel">
        <div class="admin-filter-row support-filters">
          <label>Search <input id="adminSupportSearch" value="${esc(f.q || "")}" placeholder="ID, subject, user..."></label>
          <label>Status <select id="adminSupportStatus"><option value="">All</option>${(state.supportMeta?.statuses || []).map((st) => `<option value="${st}" ${f.status === st ? "selected" : ""}>${st}</option>`).join("")}</select></label>
          <label>Category <select id="adminSupportCategory"><option value="">All</option>${(state.supportMeta?.categories || []).map((cat) => `<option value="${esc(cat)}" ${f.category === cat ? "selected" : ""}>${esc(cat)}</option>`).join("")}</select></label>
          <label>User ID <input id="adminSupportUserId" value="${esc(f.userId || "")}"></label>
          <button type="button" class="gradient-button" id="adminSupportFilterBtn">Apply filters</button>
        </div>
        <div class="support-table-scroll">
          <table class="admin-clean-table">
            <thead><tr><th>ID</th><th>User</th><th>Wallet</th><th>Category</th><th>Subject</th><th>Status</th><th>Priority</th><th>Created</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              ${rows.length ? rows.map((c) => `<tr>
                <td class="col-mono">${esc(c.complaint_id)}</td>
                <td>${esc(c.user_name)}<br><small class="col-mono">${esc(c.user_id)}</small></td>
                <td class="col-mono">${esc(c.wallet_id || "—")}</td>
                <td>${esc(c.category)}</td>
                <td>${esc(c.subject)}</td>
                <td><span class="${statusClass(c.status)}">${esc(c.status)}</span></td>
                <td><span class="${priorityClass(c.priority)}">${esc(c.priority)}</span></td>
                <td>${fmtDt(c.created_at)}</td>
                <td>${fmtDt(c.updated_at)}</td>
                <td><button type="button" class="table-action" data-support-id="${esc(c.complaint_id)}">Open</button></td>
              </tr>`).join("") : `<tr><td colspan="10" class="subtle">No complaints match filters.</td></tr>`}
            </tbody>
          </table>
        </div>
        <p class="subtle">Showing ${rows.length} of ${state.adminSupportTotal || 0}</p>
      </div>
    </div>
  `);
}

function showSupportSuccessModal(complaintId) {
  const overlay = document.createElement("div");
  overlay.className = "admin-modal-overlay support-success-overlay";
  overlay.id = "supportSuccessModal";
  overlay.innerHTML = `
    <div class="support-success-modal" role="dialog" aria-labelledby="supportSuccessTitle">
      <button type="button" class="admin-modal-close support-success-close" id="closeSupportSuccess" aria-label="Close">×</button>
      <div class="support-success-icon" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h2 id="supportSuccessTitle">Complaint submitted</h2>
      <p class="support-success-lead">We have received your ticket. Our team typically responds within 24 hours.</p>
      <div class="support-success-id-card">
        <span>Complaint ID</span>
        <code class="col-mono">${esc(complaintId)}</code>
      </div>
      <div class="support-success-actions">
        <button type="button" class="secondary" id="closeSupportSuccessSecondary">Back to support</button>
        <button type="button" class="gradient-button" id="supportSuccessOk">View complaint</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.classList.add("modal-open");
  overlay.dataset.complaintId = complaintId;
}

async function routeSupport(view) {
  await loadSupportMeta();
  if (view === "support") {
    await loadUserComplaints();
    return userSupportHome();
  }
  if (view === "support-new") {
    if (state.role !== "user") {
      showToast("Complaints can only be submitted from a user account.");
      state.view = "support";
      await loadUserComplaints();
      return userSupportHome();
    }
    supportPendingFiles = [];
    userSupportNew();
    bindSupportCreateForm();
    return;
  }
  if (view === "support-detail" && state.supportComplaintId) {
    await loadSupportDetail(state.supportComplaintId);
    return supportDetailView();
  }
  if (view === "admin-support") {
    const stats = await api("/api/admin/support/overview");
    state.adminSupportStats = stats.stats;
    const q = new URLSearchParams();
    const f = state.adminSupportFilters || {};
    if (f.status) q.set("status", f.status);
    if (f.category) q.set("category", f.category);
    if (f.userId) q.set("userId", f.userId);
    if (f.q) q.set("q", f.q);
    q.set("limit", "100");
    const list = await api(`/api/admin/support/complaints?${q}`);
    state.adminSupportComplaints = list.rows || [];
    state.adminSupportTotal = list.total || 0;
    return adminSupportDashboard();
  }
  return userSupportHome();
}

function renderSupportFilePreviews() {
  const wrap = document.getElementById("supportFilePreviews");
  const countEl = document.getElementById("supportFileCount");
  if (!wrap) return;
  wrap.querySelectorAll("img[src^='blob:']").forEach((img) => URL.revokeObjectURL(img.src));
  if (countEl) countEl.textContent = `${supportPendingFiles.length} / ${MAX_SUPPORT_FILES} files`;
  if (!supportPendingFiles.length) {
    wrap.innerHTML = `<div class="support-file-empty">No files added yet. Use “Add images / files” to attach up to ${MAX_SUPPORT_FILES} images.</div>`;
    return;
  }
  wrap.innerHTML = supportPendingFiles.map((file, index) => {
    const isImage = file.type.startsWith("image/");
    const kb = Math.max(1, Math.round(file.size / 1024));
    const preview = isImage
      ? `<img src="${URL.createObjectURL(file)}" alt="" class="support-file-thumb">`
      : `<span class="support-file-doc">PDF</span>`;
    return `<div class="support-file-card">
      ${preview}
      <div class="support-file-card-meta">
        <strong title="${esc(file.name)}">${esc(file.name.length > 22 ? `${file.name.slice(0, 19)}…` : file.name)}</strong>
        <small>${kb} KB</small>
      </div>
      <button type="button" class="support-file-remove" data-file-index="${index}" title="Remove">×</button>
    </div>`;
  }).join("");
}

function bindSupportCreateForm() {
  const form = document.getElementById("supportCreateForm");
  const fileInput = document.getElementById("supportFileInput");
  const addBtn = document.getElementById("supportAddFilesBtn");

  if (fileInput && addBtn) {
    addBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const picked = [...(fileInput.files || [])];
      fileInput.value = "";
      for (const file of picked) {
        if (supportPendingFiles.length >= MAX_SUPPORT_FILES) {
          showToast(`Maximum ${MAX_SUPPORT_FILES} files allowed.`);
          break;
        }
        const dup = supportPendingFiles.some((f) => f.name === file.name && f.size === file.size);
        if (!dup) supportPendingFiles.push(file);
      }
      renderSupportFilePreviews();
    });
  }

  const previews = document.getElementById("supportFilePreviews");
  previews?.addEventListener("click", (e) => {
    const btn = e.target.closest(".support-file-remove");
    if (!btn) return;
    const idx = Number(btn.dataset.fileIndex);
    if (!Number.isNaN(idx)) {
      supportPendingFiles.splice(idx, 1);
      renderSupportFilePreviews();
    }
  });

  if (!form) return;
  renderSupportFilePreviews();
}

function buildSupportComplaintFormData(form) {
  const fd = new FormData();
  const category = form.category?.value || "";
  if (!category) throw new Error("Please select a complaint category.");
  fd.append("category", category);
  fd.append("subject", form.subject.value.trim());
  fd.append("description", form.description.value.trim());
  if (form.walletId?.value?.trim()) fd.append("walletId", form.walletId.value.trim());
  if (form.transactionId?.value?.trim()) fd.append("transactionId", form.transactionId.value.trim());
  supportPendingFiles.forEach((file) => fd.append("attachments", file, file.name));
  return fd;
}

function initSupportHandlers() {
  document.addEventListener("click", async (e) => {
    const row = e.target.closest("tr[data-support-id]");
    if (row && !e.target.closest("button")) {
      state.supportComplaintId = row.dataset.supportId;
      state.view = "support-detail";
      return route();
    }
    const openId = e.target.closest("[data-support-id]");
    if (openId && openId.dataset.supportId) {
      state.supportComplaintId = openId.dataset.supportId;
      state.view = "support-detail";
      return route();
    }
    if (e.target.id === "closeSupportSuccess" || e.target.id === "closeSupportSuccessSecondary" || (e.target.classList.contains("admin-modal-overlay") && e.target.id === "supportSuccessModal")) {
      document.querySelector("#supportSuccessModal")?.remove();
      document.body.classList.remove("modal-open");
      if (e.target.id === "closeSupportSuccessSecondary") {
        state.view = "support";
        return route();
      }
    }
    if (e.target.id === "supportSuccessOk") {
      const overlay = document.getElementById("supportSuccessModal");
      const id = overlay?.dataset.complaintId;
      overlay?.remove();
      document.body.classList.remove("modal-open");
      if (id) { state.supportComplaintId = id; state.view = "support-detail"; return route(); }
    }
    const action = e.target.closest("[data-support-action]");
    if (action && state.role === "admin" && state.supportComplaintId) {
      const status = action.dataset.supportAction;
      if (!confirm(`Change complaint status to ${status}?`)) return;
      try {
        await api(`/api/admin/support/complaints/${encodeURIComponent(state.supportComplaintId)}/status`, {
          method: "PATCH",
          body: { status }
        });
        showToast("Status updated.");
        return route("support-detail");
      } catch (err) { showToast(err.message); }
    }
    if (e.target.id === "adminSupportFilterBtn") {
      state.adminSupportFilters = {
        q: document.getElementById("adminSupportSearch")?.value || "",
        status: document.getElementById("adminSupportStatus")?.value || "",
        category: document.getElementById("adminSupportCategory")?.value || "",
        userId: document.getElementById("adminSupportUserId")?.value || ""
      };
      return route("admin-support");
    }
  });

  document.addEventListener("change", async (e) => {
    if (e.target.id === "adminStatusSelect" && state.supportComplaintId) {
      const status = e.target.value;
      if (!confirm(`Update status to ${status}?`)) return;
      try {
        await api(`/api/admin/support/complaints/${encodeURIComponent(state.supportComplaintId)}/status`, { method: "PATCH", body: { status } });
        showToast("Status updated.");
        route("support-detail");
      } catch (err) { showToast(err.message); }
    }
    if (e.target.id === "adminPrioritySelect" && state.supportComplaintId) {
      const priority = e.target.value;
      try {
        await api(`/api/admin/support/complaints/${encodeURIComponent(state.supportComplaintId)}/priority`, { method: "PATCH", body: { priority } });
        showToast("Priority updated.");
        route("support-detail");
      } catch (err) { showToast(err.message); }
    }
  });

  document.addEventListener("submit", async (e) => {
    if (e.target.id === "supportCreateForm") {
      e.preventDefault();
      try {
        const fd = buildSupportComplaintFormData(e.target);
        const data = await apiForm("/api/support/complaints", fd);
        supportPendingFiles = [];
        showSupportSuccessModal(data.complaint_id);
        showToast("Complaint submitted successfully.");
        await loadUserComplaints();
      } catch (err) { showToast(err.message); }
      return;
    }
    if (e.target.id === "supportMessageForm") {
      e.preventDefault();
      try {
        const fd = new FormData(e.target);
        const prefix = state.role === "admin" ? "/api/admin/support" : "/api/support";
        await apiForm(`${prefix}/complaints/${encodeURIComponent(state.supportComplaintId)}/messages`, fd);
        showToast("Message sent.");
        e.target.reset();
        return route("support-detail");
      } catch (err) { showToast(err.message); }
    }
  });
}

initSupportHandlers();
