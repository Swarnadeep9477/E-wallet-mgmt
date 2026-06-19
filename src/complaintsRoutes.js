const path = require("path");
const fs = require("fs");
const multer = require("multer");
const {
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUSES,
  COMPLAINT_PRIORITIES,
  ensureUploadDir,
  createComplaint,
  createForgotPinComplaint,
  listUserComplaints,
  listAdminComplaints,
  getComplaintDetail,
  getAdminStats,
  assertUserOwnsComplaint,
  addMessage,
  setComplaintStatus,
  updatePriority,
  getComplaintRow,
  UPLOAD_DIR,
  MAX_COMPLAINT_ATTACHMENTS
} = require("./complaintsService");

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf"
]);

ensureUploadDir();

const storage = multer.diskStorage({
  destination(req, file, cb) {
    ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename(req, file, cb) {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `tmp_${Date.now()}_${safe}`);
  }
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new Error("Only JPG, PNG, WEBP and PDF files are allowed."));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: MAX_COMPLAINT_ATTACHMENTS }
});

function handleMulterError(err, req, res, next) {
  if (!err) return next();
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File too large. Maximum size is 5MB per file." });
  }
  if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({ error: err.message || "Too many files attached." });
  }
  return res.status(400).json({ error: err.message || "Upload failed." });
}

function registerComplaintRoutes(app, { auth }) {
  app.get("/api/support/meta/categories", (req, res) => {
    res.json({ categories: COMPLAINT_CATEGORIES, statuses: COMPLAINT_STATUSES, priorities: COMPLAINT_PRIORITIES });
  });

  app.get("/api/support/complaints", auth("user"), (req, res) => {
    try {
      const complaints = listUserComplaints(req.auth.userId);
      res.json({ complaints });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/support/forgot-pin", auth("user"), (req, res) => {
    try {
      const result = createForgotPinComplaint(req.auth.userId);
      res.status(result.already_open ? 200 : 201).json({
        ok: true,
        complaint_id: result.complaint_id,
        status: result.status,
        already_open: result.already_open,
        message: result.already_open
          ? "You already have an open forgot-PIN request. Track it under Help & Support."
          : "Forgot PIN complaint created. An admin will review it."
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post(
    "/api/support/complaints",
    auth("user"),
    upload.array("attachments", MAX_COMPLAINT_ATTACHMENTS),
    handleMulterError,
    (req, res) => {
      try {
        const result = createComplaint({
          userId: req.auth.userId,
          body: req.body,
          files: req.files || []
        });
        res.status(201).json({
          ok: true,
          complaint_id: result.complaint_id,
          attachments: result.attachments
        });
      } catch (error) {
        (req.files || []).forEach((f) => { try { fs.unlinkSync(f.path); } catch {} });
        res.status(400).json({ error: error.message });
      }
    }
  );

  app.get("/api/support/complaints/:complaintId", auth("user"), (req, res) => {
    try {
      assertUserOwnsComplaint(req.params.complaintId, req.auth.userId);
      const complaint = getComplaintDetail(req.params.complaintId);
      if (!complaint) return res.status(404).json({ error: "Complaint not found." });
      res.json({ complaint });
    } catch (error) {
      res.status(error.message === "Complaint not found." ? 404 : 400).json({ error: error.message });
    }
  });

  app.post("/api/support/complaints/:complaintId/messages", auth("user"), upload.single("attachment"), (req, res) => {
    try {
      assertUserOwnsComplaint(req.params.complaintId, req.auth.userId);
      const result = addMessage(
        req.params.complaintId,
        { type: "user", id: req.auth.userId },
        req.body.message,
        req.file || null
      );
      res.status(201).json({ ok: true, ...result });
    } catch (error) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/admin/support/overview", auth("admin"), (req, res) => {
    res.json({ stats: getAdminStats() });
  });

  app.get("/api/admin/support/complaints", auth("admin"), (req, res) => {
    try {
      const result = listAdminComplaints({
        status: req.query.status,
        category: req.query.category,
        userId: req.query.userId,
        priority: req.query.priority,
        q: req.query.q,
        from: req.query.from,
        to: req.query.to,
        limit: req.query.limit,
        offset: req.query.offset
      });
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/admin/support/complaints/:complaintId", auth("admin"), (req, res) => {
    const complaint = getComplaintDetail(req.params.complaintId);
    if (!complaint) return res.status(404).json({ error: "Complaint not found." });
    res.json({ complaint });
  });

  app.patch("/api/admin/support/complaints/:complaintId/status", auth("admin"), (req, res) => {
    try {
      const status = String(req.body.status || "").toUpperCase();
      const complaint = getComplaintRow(req.params.complaintId);
      if (!complaint) return res.status(404).json({ error: "Complaint not found." });
      setComplaintStatus(complaint, status, { type: "admin", id: req.auth.adminId });
      res.json({ ok: true, complaint: getComplaintDetail(req.params.complaintId) });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/admin/support/complaints/:complaintId/priority", auth("admin"), (req, res) => {
    try {
      const priority = String(req.body.priority || "").toUpperCase();
      const complaint = updatePriority(req.params.complaintId, priority);
      res.json({ ok: true, complaint });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/admin/support/complaints/:complaintId/messages", auth("admin"), upload.single("attachment"), (req, res) => {
    try {
      const result = addMessage(
        req.params.complaintId,
        { type: "admin", id: req.auth.adminId },
        req.body.message,
        req.file || null
      );
      res.status(201).json({ ok: true, ...result });
    } catch (error) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
      res.status(400).json({ error: error.message });
    }
  });
}

module.exports = { registerComplaintRoutes, upload };
