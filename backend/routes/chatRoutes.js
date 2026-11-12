const express = require("express");
const crypto = require("crypto");

const router = express.Router();
const chatService = require("../services/chatService");
const uploadService = require("../services/uploadService");
const pdfService = require("../services/pdfService");
const timetableService = require("../services/timetableService");

const FRIENDLY_ERROR_ANSWER =
    "I'm having trouble reaching my AI service right now. Please try again in a minute, or contact the Academic Office on 0971263550 / info@unilus.ac.zm.";

router.post("/", async (req, res) => {

    const question =
        typeof req.body.question === "string"
            ? req.body.question.trim()
            : "";

    const sessionId =
        req.body.sessionId ||
        crypto.randomUUID();

    // The access level comes from the signed token (see attachUser), never
    // from the request body. A "student" value sent in the body is ignored,
    // so it can't be used to claim access. Anyone without a valid token,
    // including expired or tampered tokens, is treated as public.
    const audience = req.user ? "student" : "public";

    // Who is asking, taken from the signed token: used to personalise
    // ("my timetable") and to greet them by name.
    const profile = req.user
        ? { username: req.user.username, name: req.user.name, programme: req.user.programme, year: req.user.year, semester: req.user.semester }
        : null;

    // Tells the frontend whether the user is signed in, and whether a token
    // it sent was refused ("expired" | "invalid" | "disabled") so it can
    // ask the user to sign in again.
    const authInfo = {
        authenticated: Boolean(req.user),
        authProblem: req.authProblem || null
    };

    // A file the student attached earlier in this chat (see POST /upload below). It is only used when it belongs to
    // this session and has not expired.
    const documentId = typeof req.body.documentId === "string" ? req.body.documentId : null;
    const document = documentId ? uploadService.getDocument(documentId, sessionId) : null;
    if (documentId && !document && question) {
        return res.json({
            question,
            answer: "The file you attached has expired from this chat (files are kept for a limited time and are removed when the server restarts). Please attach it again and ask me once more.",
            documentExpired: true,
            queryType: null,
            sources: [],
            resources: [],
            recommendedResources: [],
            timetableMatches: 0,
            ticket: null,
            usedFallback: false,
            ...authInfo,
            sessionId
        });
    }

    // Empty or missing question: answer politely instead of crashing
    // somewhere deeper in the pipeline.
    if (!question) {
        return res.status(400).json({
            question,
            answer: "Please type a question and I'll do my best to help.",
            ...authInfo,
            sessionId
        });
    }

    try {

        const result =
            await chatService.answerQuestion(
                question,
                sessionId,
                audience,
                profile,
                { document }
            );


        res.json({

            question,

            answer: result.answer,

            queryType: result.queryType,

            sources: result.sources,

            resources: result.resources,

            recommendedResources: result.recommendedResources,

            timetableMatches: result.timetableMatches,

            navigation: result.navigation,
            routeIntent: result.routeIntent,

            // Present only when the question was escalated:
            // { ref, status, department, category, priority, ... }
            ticket: result.ticket || null,
            usedFallback: Boolean(result.usedFallback),
            signInRequired: Boolean(result.signInRequired),

            // Present only when the answer used an attached file: { filename, partial, unilusRecordsUsed }
            document: result.document || null,

            ...authInfo,

            sessionId

        });

    } catch (error) {

        console.error("Chat route error:", error);

        // Return a normal-looking reply (HTTP 200) with a friendly
        // message so the widget displays it instead of falling back to
        // its own canned error text. `error: true` lets the frontend
        // style it differently if it ever wants to.
        res.json({
            question,
            answer: FRIENDLY_ERROR_ANSWER,
            error: true,
            queryType: null,
            sources: [],
            resources: [],
            recommendedResources: [],
            timetableMatches: 0,
            ticket: null,
            usedFallback: false,
            ...authInfo,
            sessionId
        });

    }

});


/*
Changes: Adds file upload (PDF, Word, text) and "save as PDF" to the chat API.
Affects: POST /api/chat/upload, DELETE /api/chat/upload/:documentId, POST /api/chat/pdf, and the documentId field on POST /api/chat.
Purpose: Students can ask about their own file next to the UNILUS records and keep an answer as a PDF. The file stays in
         memory for this chat only (see services/uploadService.js); it is never added to the knowledge base.
*/

// Small in-memory limiter so one address cannot flood the upload or PDF endpoints.
const hits = new Map();
function tooMany(req, bucket, max, windowMs) {
    const key = `${bucket}:${req.ip}`;
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    return recent.length > max;
}

const rawBody = express.raw({ type: () => true, limit: uploadService.MAX_BYTES + 64 * 1024 });

// Plain-pattern report about a file, used for the card the widget shows after an upload. Nothing here calls an AI model.
function buildUploadReport(doc, signedIn) {
    const { courseCodes, dates, amounts, emails } = doc.facts;
    const steps = [];
    steps.push({ label: doc.pages ? `Read ${doc.pages} page${doc.pages === 1 ? "" : "s"}` : "Read the file" });

    const found = [];
    if (courseCodes.length) found.push(`${courseCodes.length} course code${courseCodes.length === 1 ? "" : "s"}`);
    if (dates.length) found.push(`${dates.length} date${dates.length === 1 ? "" : "s"}`);
    if (amounts.length) found.push(`${amounts.length} amount${amounts.length === 1 ? "" : "s"}`);
    if (emails.length) found.push(`${emails.length} email address${emails.length === 1 ? "" : "es"}`);
    steps.push({ label: found.length ? `Found ${found.join(", ")}` : "No course codes, dates or amounts spotted" });

    // The timetable is student-only data, so course codes are only checked for signed-in students.
    let courses = [];
    if (courseCodes.length && signedIn) {
        try {
            courses = courseCodes.slice(0, 12).map((code) => {
                const entries = timetableService.getByCourse(code) || [];
                return { code, inTimetable: entries.length > 0, name: entries.length ? entries[0].course_name : null };
            });
            const matched = courses.filter((c) => c.inTimetable).length;
            steps.push({ label: `Checked ${courses.length} course code${courses.length === 1 ? "" : "s"} against the UNILUS timetable (${matched} found)` });
        } catch (error) {
            console.log("[upload] timetable check skipped:", error.message);
            courses = [];
        }
    } else if (courseCodes.length) {
        steps.push({ label: "Sign in to the portal to check course codes against the timetable", pending: true });
    }

    const suggestions = ["Summarise this file", "Does anything here differ from the UNILUS records?"];
    if (dates.length) suggestions.push("List the dates and deadlines in this file");
    if (amounts.length) suggestions.push("Do the amounts match UNILUS fees?");
    if (courseCodes.length) suggestions.push("Explain the course codes in this file");

    return {
        ...uploadService.publicSummary(doc),
        facts: { courseCodes: courses.length ? courses : courseCodes.map((code) => ({ code })), dates: dates.slice(0, 6), amounts: amounts.slice(0, 6), emails: emails.length },
        steps,
        suggestions: suggestions.slice(0, 4),
    };
}

router.post("/upload", rawBody, async (req, res) => {
    if (tooMany(req, "upload", 10, 10 * 60 * 1000)) {
        return res.status(429).json({ error: "You've attached a lot of files in a short time. Please wait a few minutes and try again." });
    }
    const sessionId = (typeof req.query.sessionId === "string" && req.query.sessionId) || crypto.randomUUID();
    try {
        const doc = await uploadService.saveDocument({ sessionId, filename: req.query.filename, buffer: req.body });
        res.status(201).json({ ...buildUploadReport(doc, Boolean(req.user)), sessionId });
    } catch (error) {
        if (error instanceof uploadService.UploadError) {
            return res.status(error.status).json({ error: error.message });
        }
        console.error("Upload error:", error);
        res.status(500).json({ error: "Something went wrong while reading that file. Please try again." });
    }
});

router.delete("/upload/:documentId", (req, res) => {
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : "";
    const doc = uploadService.getDocument(req.params.documentId, sessionId);
    if (doc) uploadService.removeDocument(doc.id);
    res.json({ removed: Boolean(doc) });
});

router.post("/pdf", async (req, res) => {
    if (tooMany(req, "pdf", 30, 10 * 60 * 1000)) {
        return res.status(429).json({ error: "Too many PDFs in a short time. Please wait a few minutes and try again." });
    }
    const markdown = typeof req.body.markdown === "string" ? req.body.markdown : "";
    if (!markdown.trim()) return res.status(400).json({ error: "There is nothing to put in the PDF." });

    const title = typeof req.body.title === "string" && req.body.title.trim() ? req.body.title.trim().slice(0, 120) : "UNILUS answer";
    const sources = (Array.isArray(req.body.sources) ? req.body.sources : [])
        .filter((item) => typeof item === "string").map((item) => item.slice(0, 200)).slice(0, 12);
    const note = typeof req.body.note === "string" ? req.body.note.slice(0, 120) : "";

    try {
        const pdf = await pdfService.renderAnswerPdf({ title, markdown, sources, note });
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "answer";
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="unilus-${slug}.pdf"`);
        res.setHeader("Cache-Control", "no-store");
        res.send(pdf);
    } catch (error) {
        console.error("PDF error:", error);
        res.status(500).json({ error: "I couldn't create the PDF. Please try again." });
    }
});

// Turns a file that is over the size limit into a readable message instead of a stack trace.
router.use((error, req, res, next) => {
    if (error && error.type === "entity.too.large") {
        return res.status(413).json({ error: `That file is too large. The limit is ${Math.round(uploadService.MAX_BYTES / 1024 / 1024)} MB.` });
    }
    next(error);
});


module.exports = router;
