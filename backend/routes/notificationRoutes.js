/**
 * notificationRoutes.js
 * ======================
 * Mounted at /api/notifications in server.js. Public: what a visitor may see
 * depends on their sign-in token and chat session, never on the query string.
 *
 *   GET /api/notifications?after=12&sessionId=...
 *       { items: [{ id, kind, title, body, ref, created_at }], latestId }
 *
 * `after` is the id of the newest notice the widget has already shown; the
 * widget stores it and sends it back on the next poll.
 */

const express = require("express");

const router = express.Router();
const notifications = require("../services/notificationService");

router.get("/", async (req, res) => {
    try {
        res.json(
            await notifications.listFor({
                after: req.query.after,
                signedIn: Boolean(req.user),
                username: req.user ? req.user.username : null,
                sessionId: typeof req.query.sessionId === "string" ? req.query.sessionId : null,
                limit: req.query.limit,
            })
        );
    } catch (error) {
        console.error("Notifications error:", error);
        res.status(500).json({ error: "Failed to load notifications" });
    }
});

module.exports = router;
