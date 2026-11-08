/**
 * staffAnswerRoutes.js
 * =====================
 * Mounted at /api in server.js. Staff only (same requireStaff as the tickets).
 *
 *   GET    /api/admin/recurring       similar tickets grouped, most asked first
 *   GET    /api/admin/answers         saved answers
 *   POST   /api/admin/answers         { question, answer, visibility: "public"|"student",
 *                                       ticketRef?, resolveTicket? }
 *   PATCH  /api/admin/answers/:id     { question?, answer?, visibility?, active? }
 *   DELETE /api/admin/answers/:id
 */

const express = require("express");

const router = express.Router();
router.use((req,res,next)=>{if(req.user?.role==='staff')return res.status(403).json({error:'Administrator required for global knowledge management'});next();});
const faq = require("../services/faqService");
const support = require("../services/supportService");
const { requireStaff } = require("../middleware/requireStaff");


router.get("/admin/recurring", requireStaff, async (req, res) => {
    try {
        res.json(await faq.getRecurring());
    } catch (error) {
        console.error("Recurring questions error:");
        res.status(500).json({ error: "Failed to load recurring questions" });
    }
});


router.get("/admin/answers", requireStaff, async (req, res) => {
    try {
        res.json(await faq.listAnswers());
    } catch (error) {
        console.error("Saved answers list error:");
        res.status(500).json({ error: "Failed to load saved answers" });
    }
});


router.post("/admin/answers", requireStaff, async (req, res) => {
    try {
        const saved = await faq.createAnswer({
            question: req.body.question,
            answer: req.body.answer,
            visibility: req.body.visibility,
            sourceTicket: req.body.ticketRef || null
        });

        // Optionally close every open ticket that asks the same thing
        let resolved = [];
        if (req.body.resolveTicket) {
            const refs = new Set(await faq.openTicketRefsMatching(saved.question));
            if (req.body.ticketRef) refs.add(String(req.body.ticketRef).trim().toUpperCase());
            for (const ref of refs) {
                if (await support.updateTicketStatus(ref, "Resolved")) resolved.push(ref);
            }
        }

        res.json({ ...saved, resolvedTickets: resolved });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


router.patch("/admin/answers/:id", requireStaff, async (req, res) => {
    try {
        const updated = await faq.updateAnswer(Number(req.params.id), req.body || {});
        if (!updated) return res.status(404).json({ error: "Answer not found" });
        res.json(updated);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


router.delete("/admin/answers/:id", requireStaff, async (req, res) => {
    try {
        if (!await faq.deleteAnswer(Number(req.params.id))) {
            return res.status(404).json({ error: "Answer not found" });
        }
        res.json({ ok: true });
    } catch (error) {
        console.error("Answer delete error:");
        res.status(500).json({ error: "Failed to delete answer" });
    }
});


module.exports = router;
