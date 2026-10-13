/**
 * supportRoutes.js
 * =================
 * Mounted at /api in server.js.
 *
 *   Public:
 *     GET   /api/tickets/:ref        ticket status only (no question text, no history)
 *     POST  /api/feedback            { sessionId, rating: "up"|"down", comment? }
 *
 *   Staff (signed in as role "staff" or "admin", OR header x-admin-key):
 *     GET   /api/admin/tickets       ?status=Open&limit=50
 *     GET   /api/admin/tickets/:ref  full ticket including conversation history
 *     PATCH /api/admin/tickets/:ref  { status: "In Progress" | "Resolved" | ... }
 *     GET   /api/admin/stats         escalation and feedback statistics
 *
 * Staff access works two ways:
 *   1. a sign-in token (Authorization: Bearer ...) for a staff or admin
 *      account, from POST /api/auth/login
 *   2. the shared ADMIN_API_KEY from .env, sent as x-admin-key
 * Both fail closed. Students and anonymous users get 401.
 */

const express = require("express");

const router = express.Router();
const support = require("../services/supportService");
const { requireStaff } = require("../middleware/requireStaff");


/* ----------------------------- Public ----------------------------- */

router.get("/tickets/:ref", (req, res) => {
    try {
        const ticket = support.getTicketByRef(req.params.ref);

        if (!ticket) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        res.json(ticket);
    } catch (error) {
        console.error("Ticket lookup error:", error);
        res.status(500).json({ error: "Failed to look up ticket" });
    }
});


router.post("/feedback", (req, res) => {
    try {
        support.recordFeedback({
            sessionId: req.body.sessionId || null,
            rating: req.body.rating,
            comment: typeof req.body.comment === "string" ? req.body.comment : null
        });

        res.json({ ok: true });
    } catch (error) {
        if (/rating must be/.test(error.message)) {
            return res.status(400).json({ error: error.message });
        }
        console.error("Feedback error:", error);
        res.status(500).json({ error: "Failed to save feedback" });
    }
});


/* ------------------------------ Staff ----------------------------- */

router.get("/admin/tickets", requireStaff, (req, res) => {
    try {
        res.json(
            support.listTickets({
                status: req.query.status || null,
                limit: req.query.limit
            })
        );
    } catch (error) {
        console.error("Admin ticket list error:", error);
        res.status(500).json({ error: "Failed to list tickets" });
    }
});


router.get("/admin/tickets/:ref", requireStaff, (req, res) => {
    try {
        const ticket = support.getTicketForAdmin(req.params.ref);

        if (!ticket) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        res.json(ticket);
    } catch (error) {
        console.error("Admin ticket read error:", error);
        res.status(500).json({ error: "Failed to read ticket" });
    }
});


router.patch("/admin/tickets/:ref", requireStaff, (req, res) => {
    try {
        if (!support.normalizeStatus(req.body.status)) {
            return res.status(400).json({
                error: `status must be one of: ${support.STATUSES.join(", ")}`
            });
        }

        const updated = support.updateTicketStatus(req.params.ref, req.body.status);

        if (!updated) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        res.json(updated);
    } catch (error) {
        console.error("Admin ticket update error:", error);
        res.status(500).json({ error: "Failed to update ticket" });
    }
});


router.get("/admin/stats", requireStaff, (req, res) => {
    try {
        res.json(support.getStats());
    } catch (error) {
        console.error("Admin stats error:", error);
        res.status(500).json({ error: "Failed to compute stats" });
    }
});


module.exports = router;
