const { db, uid, notify, notifyAdmin, resolveReceiverWallet } = require("./db");

const MONEY_REQUEST_STATUSES = ["PENDING", "ACCEPTED", "REJECTED", "PAID", "CANCELLED"];

function shapeMoneyRequest(row) {
  if (!row) return null;
  const amountPaise = row.amount_paise ?? row.amount;
  return {
    request_id: row.request_id,
    requester_user_id: row.requester_user_id,
    requester_admin_id: row.requester_admin_id,
    requester_wallet_id: row.requester_wallet_id,
    requester_name: row.requester_name,
    payer_user_id: row.payer_user_id,
    payer_admin_id: row.payer_admin_id,
    payer_wallet_id: row.payer_wallet_id,
    payer_name: row.payer_name,
    amount: amountPaise / 100,
    amount_paise: amountPaise,
    note: row.note || "",
    status: row.status,
    payment_method: row.payment_method,
    created_at: row.created_at,
    updated_at: row.updated_at,
    responded_at: row.responded_at,
    paid_at: row.paid_at
  };
}

function moneyRequestSelectSql() {
  return `
    SELECT mr.*,
      COALESCE(ru.full_name, ra.name) AS requester_name,
      COALESCE(pu.full_name, pa.name) AS payer_name,
      mr.amount AS amount_paise
    FROM money_requests mr
    LEFT JOIN users ru ON ru.user_id = mr.requester_user_id
    LEFT JOIN admins ra ON ra.admin_id = mr.requester_admin_id
    LEFT JOIN users pu ON pu.user_id = mr.payer_user_id
    LEFT JOIN admins pa ON pa.admin_id = mr.payer_admin_id
  `;
}

function getMoneyRequestRow(requestId) {
  return db.prepare(`${moneyRequestSelectSql()} WHERE mr.request_id = ?`).get(requestId);
}

function getAuthActor(auth) {
  if (auth.role === "user") {
    const wallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(auth.userId);
    if (!wallet) throw new Error("Your wallet was not found.");
    return { role: "user", userId: auth.userId, adminId: null, wallet };
  }
  if (auth.role === "admin") {
    const wallet = db.prepare("SELECT * FROM wallets WHERE admin_id = ?").get(auth.adminId);
    if (!wallet) throw new Error("Admin wallet was not found.");
    return { role: "admin", userId: null, adminId: auth.adminId, wallet };
  }
  throw new Error("Unauthorized.");
}

function isRequester(actor, row) {
  if (actor.role === "user") return row.requester_user_id === actor.userId;
  return row.requester_admin_id === actor.adminId;
}

function isPayer(actor, row) {
  if (actor.role === "user") return row.payer_user_id === actor.userId;
  return row.payer_admin_id === actor.adminId;
}

function resolveCounterpartyFromBody(body) {
  const walletId = String(body.payerWalletId || body.payer_wallet_id || "").trim();
  const upiId = String(body.payerUpiId || body.payer_upi_id || "").trim();
  const phone = String(body.payerPhone || body.payer_phone || "").trim();

  if (walletId) {
    const adminWallet = db.prepare(`
      SELECT w.*, a.admin_id, a.name AS full_name
      FROM wallets w
      INNER JOIN admins a ON a.admin_id = w.admin_id
      WHERE w.wallet_id = ? AND w.wallet_status = 'active'
    `).get(walletId);
    if (adminWallet) {
      return { type: "admin", adminId: adminWallet.admin_id, userId: null, name: adminWallet.full_name, wallet: adminWallet };
    }
  }

  const userWallet = resolveReceiverWallet({
    receiverWalletId: walletId || undefined,
    receiverUpiId: upiId || undefined,
    receiverPhone: phone || undefined
  });
  const user = db.prepare("SELECT user_id, full_name FROM users WHERE user_id = ?").get(userWallet.user_id);
  return { type: "user", userId: user.user_id, adminId: null, name: user.full_name, wallet: userWallet };
}

function assertNotSelfRequest(actor, counterparty) {
  if (actor.role === "user" && counterparty.type === "user" && actor.userId === counterparty.userId) {
    throw new Error("You cannot request money from yourself.");
  }
  if (actor.role === "admin" && counterparty.type === "admin" && actor.adminId === counterparty.adminId) {
    throw new Error("You cannot request money from yourself.");
  }
}

function createMoneyRequest({ actor, counterparty, amountPaise, note }) {
  const requestId = uid("REQ");
  const now = new Date().toISOString();
  const requesterUserId = actor.role === "user" ? actor.userId : null;
  const requesterAdminId = actor.role === "admin" ? actor.adminId : null;
  const payerUserId = counterparty.type === "user" ? counterparty.userId : null;
  const payerAdminId = counterparty.type === "admin" ? counterparty.adminId : null;

  db.prepare(`
    INSERT INTO money_requests (
      request_id, requester_user_id, requester_admin_id, requester_wallet_id,
      payer_user_id, payer_admin_id, payer_wallet_id,
      amount, note, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
  `).run(
    requestId,
    requesterUserId,
    requesterAdminId,
    actor.wallet.wallet_id,
    payerUserId,
    payerAdminId,
    counterparty.wallet.wallet_id,
    amountPaise,
    note || "",
    now,
    now
  );

  const amountLabel = (amountPaise / 100).toFixed(2);
  const requesterLabel = actor.role === "admin" ? "Admin" : "A user";

  if (payerUserId) {
    notify(
      payerUserId,
      "Money request received",
      `${requesterLabel} requested Rs ${amountLabel}. Open Transfer → Money requests to accept or decline.`,
      "transaction"
    );
  }
  if (payerAdminId) {
    notifyAdmin(
      payerAdminId,
      "Money request received",
      `${requesterLabel} requested Rs ${amountLabel}. Open Transfer → Money requests to accept or decline.`,
      "transaction"
    );
  }

  if (requesterUserId) {
    notify(requesterUserId, "Money request sent", `Your request for Rs ${amountLabel} was sent.`, "transaction");
  }
  if (requesterAdminId) {
    notifyAdmin(requesterAdminId, "Money request sent", `Your request for Rs ${amountLabel} was sent.`, "transaction");
  }

  return getMoneyRequestRow(requestId);
}

function listMoneyRequestsForAuth(auth) {
  const actor = getAuthActor(auth);
  if (auth.role === "admin") {
    const rows = db.prepare(`${moneyRequestSelectSql()} ORDER BY datetime(mr.updated_at) DESC LIMIT 200`).all();
    return rows.map((row) => {
      const shaped = shapeMoneyRequest(row);
      shaped.direction = isRequester(actor, row) ? "outgoing" : isPayer(actor, row) ? "incoming" : "other";
      return shaped;
    });
  }

  const rows = db.prepare(`
    ${moneyRequestSelectSql()}
    WHERE mr.requester_user_id = ? OR mr.payer_user_id = ?
    ORDER BY datetime(mr.updated_at) DESC
  `).all(actor.userId, actor.userId);

  return rows.map((row) => {
    const shaped = shapeMoneyRequest(row);
    shaped.direction = row.requester_user_id === actor.userId ? "outgoing" : "incoming";
    return shaped;
  });
}

function respondToMoneyRequest(requestId, auth, action) {
  const actor = getAuthActor(auth);
  const row = getMoneyRequestRow(requestId);
  if (!row) throw new Error("Money request not found.");
  if (!isPayer(actor, row)) throw new Error("Only the payer can respond to this request.");
  if (row.status !== "PENDING") throw new Error(`This request is already ${row.status.toLowerCase()}.`);

  const now = new Date().toISOString();
  if (action === "reject") {
    db.prepare(`
      UPDATE money_requests SET status = 'REJECTED', responded_at = ?, updated_at = ? WHERE request_id = ?
    `).run(now, now, requestId);
    notifyRequester(row, "Money request declined", `Your money request ${requestId} was declined.`);
    return shapeMoneyRequest(getMoneyRequestRow(requestId));
  }

  if (action !== "accept") throw new Error("Invalid action. Use accept or reject.");

  db.prepare(`
    UPDATE money_requests SET status = 'ACCEPTED', responded_at = ?, updated_at = ? WHERE request_id = ?
  `).run(now, now, requestId);
  notifyRequester(
    row,
    "Money request accepted",
    `Your request ${requestId} was accepted. The payer will complete payment shortly.`
  );
  return shapeMoneyRequest(getMoneyRequestRow(requestId));
}

function cancelMoneyRequest(requestId, auth) {
  const actor = getAuthActor(auth);
  const row = getMoneyRequestRow(requestId);
  if (!row) throw new Error("Money request not found.");
  if (!isRequester(actor, row)) throw new Error("Only the requester can cancel this request.");
  if (row.status !== "PENDING") throw new Error(`Cannot cancel a request that is ${row.status.toLowerCase()}.`);

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE money_requests SET status = 'CANCELLED', updated_at = ? WHERE request_id = ?
  `).run(now, requestId);

  notifyPayer(row, "Money request cancelled", `Request ${requestId} was cancelled by the requester.`);
  return shapeMoneyRequest(getMoneyRequestRow(requestId));
}

function notifyRequester(row, title, message) {
  if (row.requester_user_id) notify(row.requester_user_id, title, message, "transaction");
  if (row.requester_admin_id) notifyAdmin(row.requester_admin_id, title, message, "transaction");
}

function notifyPayer(row, title, message) {
  if (row.payer_user_id) notify(row.payer_user_id, title, message, "transaction");
  if (row.payer_admin_id) notifyAdmin(row.payer_admin_id, title, message, "transaction");
}

function payMoneyRequest(requestId, auth, { paymentMethod = "upi" } = {}) {
  const actor = getAuthActor(auth);
  const row = getMoneyRequestRow(requestId);
  if (!row) throw new Error("Money request not found.");
  if (!isPayer(actor, row)) throw new Error("Only the payer can complete this payment.");
  if (row.status === "REJECTED") throw new Error("This request was declined.");
  if (row.status === "CANCELLED") throw new Error("This request was cancelled.");
  if (row.status === "PAID") throw new Error("This request was already paid.");
  if (row.status !== "ACCEPTED") throw new Error("Accept the request before completing payment.");

  const amount = row.amount_paise;
  const payerWallet = db.prepare("SELECT * FROM wallets WHERE wallet_id = ?").get(row.payer_wallet_id);
  const requesterWallet = db.prepare("SELECT * FROM wallets WHERE wallet_id = ?").get(row.requester_wallet_id);
  if (!payerWallet || !requesterWallet) throw new Error("Wallet not found.");

  const method = String(paymentMethod || "upi").toLowerCase();
  if (method === "wallet" && payerWallet.balance < amount) {
    throw new Error("Insufficient wallet balance.");
  }

  const now = new Date().toISOString();
  db.transaction(() => {
    if (method === "wallet") {
      db.prepare("UPDATE wallets SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE wallet_id = ?")
        .run(amount, payerWallet.wallet_id);
      db.prepare("UPDATE wallets SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE wallet_id = ?")
        .run(amount, requesterWallet.wallet_id);
    } else {
      db.prepare("UPDATE wallets SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE wallet_id = ?")
        .run(amount, requesterWallet.wallet_id);
    }
    db.prepare(`
      UPDATE money_requests SET status = 'PAID', payment_method = ?, paid_at = ?, updated_at = ? WHERE request_id = ?
    `).run(method, now, now, requestId);
  })();

  notifyRequester(
    row,
    "Money request paid",
    `You received Rs ${(amount / 100).toFixed(2)} for request ${requestId}.`
  );
  notifyPayer(
    row,
    "Payment completed",
    `You paid Rs ${(amount / 100).toFixed(2)} for money request ${requestId}.`
  );

  return shapeMoneyRequest(getMoneyRequestRow(requestId));
}

function createMoneyRequestFromAuth(auth, body, amountPaise) {
  const actor = getAuthActor(auth);
  const counterparty = resolveCounterpartyFromBody(body);
  assertNotSelfRequest(actor, counterparty);
  return createMoneyRequest({
    actor,
    counterparty,
    amountPaise,
    note: String(body.note || body.requestNote || "").trim()
  });
}

module.exports = {
  MONEY_REQUEST_STATUSES,
  createMoneyRequestFromAuth,
  listMoneyRequestsForAuth,
  respondToMoneyRequest,
  payMoneyRequest,
  cancelMoneyRequest,
  getMoneyRequestRow,
  getAuthActor,
  shapeMoneyRequest
};
