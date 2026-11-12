/**
 * supportRoutes.js
 * =================
 * Mounted at /api in server.js.
 *
 *   Public:
 *     GET   /api/tickets/:ref        ticket status only (no question text, no history)
 *     POST  /api/tickets/:ref/contact  { sessionId, email?, phone? }  (own ticket only)
 *     POST  /api/feedback            { sessionId, rating: "up"|"down", reason?, comment?, question?, answer? } -> { id }
 *     PATCH /api/feedback/:id        { sessionId, rating?, reason?, comment? }   (same chat session only)
 *     GET   /api/admin/feedback      ?rating=down|up&reviewed=0|1&limit=       (staff)
 *     PATCH /api/admin/feedback/:id  { reviewed }                              (staff)
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

router.get("/tickets/:ref", async (req, res) => {
    try {
        const ticket = await support.getTicketByRef(req.params.ref);

        if (!ticket) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        res.json(ticket);
    } catch (error) {
        console.error("Ticket lookup error:", error);
        res.status(500).json({ error: "Failed to look up ticket" });
    }
});


// Changes: Lets the widget attach the student's email / phone to their own ticket.
// Affects: tickets.student_email / student_phone (staff see them in /api/admin/tickets).
// Purpose: Same data the chat reply path saves; this is for a form or button in the UI.
//          The sessionId must match the one that opened the ticket, so one student
//          cannot write to another student's ticket.
router.post("/tickets/:ref/contact", async (req, res) => {
    try {
        const sessionId = typeof req.body.sessionId === "string" ? req.body.sessionId : "";
        if (!(await support.ticketBelongsToSession(req.params.ref, sessionId))) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        const found = support.extractContactDetails(
            [req.body.email, req.body.phone].filter((v) => typeof v === "string").join(" ")
        );
        if (!found.email && !found.phone) {
            return res.status(400).json({ error: "Please give a valid email address or phone number." });
        }

        await support.saveTicketContact(req.params.ref, found);
        res.json({ ok: true });
    } catch (error) {
        console.error("Ticket contact error:", error);
        res.status(500).json({ error: "Failed to save contact details" });
    }
});


// Changes: Feedback is optional and richer: the widget sends the thumbs straight away, then (only if
//          the student wants) a reason and comment to the same row via PATCH.
// Affects: feedback table, GET /api/admin/stats and the staff Feedback page.
// Purpose: Staff can see which answers failed and why, for future improvements.
//          Only "signed in or visitor" is stored, never a name or username.
router.post("/feedback", async (req, res) => {
    try {
        const id = await support.recordFeedback({
            sessionId: typeof req.body.sessionId === "string" ? req.body.sessionId : null,
            rating: req.body.rating,
            comment: typeof req.body.comment === "string" ? req.body.comment : null,
            reason: typeof req.body.reason === "string" ? req.body.reason : null,
            question: typeof req.body.question === "string" ? req.body.question : null,
            answer: typeof req.body.answer === "string" ? req.body.answer : null,
            audience: req.user ? "student" : "visitor"
        });

        res.json({ ok: true, id });
    } catch (error) {
        if (/rating must be/.test(error.message)) {
            return res.status(400).json({ error: error.message });
        }
        if (/too many feedback/.test(error.message)) {
            return res.status(429).json({ error: error.message });
        }
        console.error("Feedback error:", error);
        res.status(500).json({ error: "Failed to save feedback" });
    }
});

// Adds a reason / comment (or changes the thumb) on feedback from the SAME chat session.
router.patch("/feedback/:id", async (req, res) => {
    try {
        const ok = await support.updateFeedback(
            req.params.id,
            typeof req.body.sessionId === "string" ? req.body.sessionId : "",
            {
                rating: typeof req.body.rating === "string" ? req.body.rating : null,
                reason: typeof req.body.reason === "string" ? req.body.reason : null,
                comment: typeof req.body.comment === "string" ? req.body.comment : null
            }
        );
        if (!ok) return res.status(404).json({ error: "Feedback not found" });
        res.json({ ok: true });
    } catch (error) {
        if (/rating must be/.test(error.message)) {
            return res.status(400).json({ error: error.message });
        }
        console.error("Feedback update error:", error);
        res.status(500).json({ error: "Failed to update feedback" });
    }
});


/* ------------------------------ Staff ----------------------------- */

router.get("/admin/feedback", requireStaff, async (req, res) => {
    try {
        res.json(
            await support.listFeedback({
                rating: req.query.rating || null,
                reviewed: req.query.reviewed === "1" ? true : req.query.reviewed === "0" ? false : null,
                limit: req.query.limit
            })
        );
    } catch (error) {
        console.error("Admin feedback list error:", error);
        res.status(500).json({ error: "Failed to list feedback" });
    }
});

router.patch("/admin/feedback/:id", requireStaff, async (req, res) => {
    try {
        const found = await support.markFeedbackReviewed(req.params.id, req.body.reviewed !== false);
        if (!found) return res.status(404).json({ error: "Feedback not found" });
        res.json({ ok: true });
    } catch (error) {
        console.error("Admin feedback review error:", error);
        res.status(500).json({ error: "Failed to update feedback" });
    }
});

router.get("/admin/tickets", requireStaff, async (req, res) => {
    try {
        res.json(
            await support.listTickets({
                status: req.query.status || null,
                limit: req.query.limit
            })
        );
    } catch (error) {
        console.error("Admin ticket list error:", error);
        res.status(500).json({ error: "Failed to list tickets" });
    }
});


router.get("/admin/tickets/:ref", requireStaff, async (req, res) => {
    try {
        const ticket = await support.getTicketForAdmin(req.params.ref);

        if (!ticket) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        res.json(ticket);
    } catch (error) {
        console.error("Admin ticket read error:", error);
        res.status(500).json({ error: "Failed to read ticket" });
    }
});


router.patch("/admin/tickets/:ref", requireStaff, async (req, res) => {
    try {
        if (!support.normalizeStatus(req.body.status)) {
            return res.status(400).json({
                error: `status must be one of: ${support.STATUSES.join(", ")}`
            });
        }

        const updated = await support.updateTicketStatus(req.params.ref, req.body.status);

        if (!updated) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        res.json(updated);
    } catch (error) {
        console.error("Admin ticket update error:", error);
        res.status(500).json({ error: "Failed to update ticket" });
    }
});


router.get("/admin/stats", requireStaff, async (req, res) => {
    try {
        res.json(await support.getStats());
    } catch (error) {
        console.error("Admin stats error:", error);
        res.status(500).json({ error: "Failed to compute stats" });
    }
});


module.exports = router;
