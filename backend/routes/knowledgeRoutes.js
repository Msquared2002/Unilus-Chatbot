/**
 * knowledgeRoutes.js
 * ===================
 * Mounted at /api in server.js. All routes are staff-only (staff or admin
 * sign-in token, or the admin key), see middleware/requireStaff.js.
 *
 *   POST   /api/admin/documents?filename=...&access=public|restricted&title=...
 *          Body: the raw file bytes (Content-Type: application/octet-stream).
 *          Adds the document to the live knowledge base. access defaults to
 *          "restricted" (signed-in users only). Same name = replaces the old
 *          version. Identical or duplicate files are refused (409).
 *   DELETE /api/admin/documents/:filename     remove an uploaded document
 *   GET    /api/admin/knowledge               what is indexed + recent changes
 *   POST   /api/admin/knowledge/refresh-website   re-crawl the website now
 *
 * Example (cmd), signed in as staff:
 *   curl.exe -X POST "http://localhost:5000/api/admin/documents?filename=policy.pdf&access=public" ^
 *     -H "Authorization: Bearer TOKEN" -H "Content-Type: application/octet-stream" ^
 *     --data-binary "@C:\path\to\policy.pdf"
 */

const express = require("express");

const router = express.Router();
const { requireStaff } = require("../middleware/requireStaff");
const updater = require("../services/knowledgeUpdater");

const MAX_UPLOAD = process.env.KNOWLEDGE_MAX_UPLOAD || "25mb";
const rawBody = express.raw({ type: () => true, limit: MAX_UPLOAD });

function uploader(req) {
    return req.user ? req.user.username : "admin-key";
}

function sendError(res, error, fallbackMessage) {
    if (error instanceof updater.KnowledgeError) {
        return res.status(error.status).json({ error: error.message });
    }
    console.error(fallbackMessage, error);
    res.status(500).json({ error: fallbackMessage });
}


router.post("/admin/documents", requireStaff, rawBody, async (req, res) => {
    try {
        const result = await updater.uploadDocument({
            filename: req.query.filename,
            buffer: req.body,
            access: req.query.access,
            title: req.query.title,
            uploadedBy: uploader(req),
        });
        res.status(201).json(result);
    } catch (error) {
        sendError(res, error, "Failed to add the document");
    }
});


router.delete("/admin/documents/:filename", requireStaff, async (req, res) => {
    try {
        res.json(await updater.deleteDocument({ filename: req.params.filename, deletedBy: uploader(req) }));
    } catch (error) {
        sendError(res, error, "Failed to delete the document");
    }
});


router.get("/admin/knowledge", requireStaff, async (req, res) => {
    try {
        res.json(await updater.getKnowledgeStatus());
    } catch (error) {
        sendError(res, error, "Failed to read the knowledge base status");
    }
});


router.post("/admin/knowledge/refresh-website", requireStaff, async (req, res) => {
    try {
        res.json(await updater.refreshWebsite({ trigger: "manual" }));
    } catch (error) {
        sendError(res, error, "Website refresh failed");
    }
});


// Turns body-parser errors (for example a file over the size limit) into JSON.
router.use((error, req, res, next) => {
    if (error && error.status && error.status < 500) {
        const message = error.type === "entity.too.large"
            ? `The file is too large (limit ${MAX_UPLOAD}).`
            : error.message;
        return res.status(error.status).json({ error: message });
    }
    next(error);
});


module.exports = router;
