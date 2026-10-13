/**
 * authRoutes.js  (mounted at /api/auth)
 *
 *   POST /api/auth/login   { username, password }
 *        -> { token, tokenType, expiresAt, user }
 *   GET  /api/auth/me      header: Authorization: Bearer <token>
 *        -> { user }   (401 if not signed in)
 *
 * There is no logout endpoint: tokens are stateless, so the frontend
 * signs out by discarding its token.
 */

const express = require("express");

const router = express.Router();
const auth = require("../services/authService");

/* Basic brute-force protection: 5 failed attempts per username + IP
   within 15 minutes locks that combination out until the window ends. */
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map();

function limiterKey(req, username) {
    return `${req.ip}|${String(username || "").trim().toLowerCase()}`;
}

function currentLock(key) {
    const entry = failures.get(key);
    if (!entry) return 0;

    if (Date.now() - entry.first > WINDOW_MS) {
        failures.delete(key);
        return 0;
    }
    return entry.count >= MAX_FAILURES
        ? Math.ceil((entry.first + WINDOW_MS - Date.now()) / 1000)
        : 0;
}

function recordFailure(key) {
    const entry = failures.get(key);
    if (!entry || Date.now() - entry.first > WINDOW_MS) {
        failures.set(key, { count: 1, first: Date.now() });
    } else {
        entry.count++;
    }
}


router.post("/login", (req, res) => {
    try {
        if (!auth.isConfigured()) {
            return res.status(503).json({ error: "Sign-in is not configured on this server." });
        }

        const username = typeof req.body.username === "string" ? req.body.username : "";
        const password = typeof req.body.password === "string" ? req.body.password : "";

        if (!username.trim() || !password) {
            return res.status(400).json({ error: "Enter your username and password." });
        }

        const key = limiterKey(req, username);
        const retryAfter = currentLock(key);
        if (retryAfter > 0) {
            res.set("Retry-After", String(retryAfter));
            return res.status(429).json({
                error: "Too many failed attempts. Please wait a few minutes and try again."
            });
        }

        const user = auth.authenticate(username, password);
        if (!user) {
            recordFailure(key);
            return res.status(401).json({ error: "Invalid username or password." });
        }

        failures.delete(key);
        const { token, expiresAt } = auth.signToken(user);

        res.json({ token, tokenType: "Bearer", expiresAt, user });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Sign-in failed. Please try again." });
    }
});


router.get("/me", (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            error: "Not signed in.",
            authProblem: req.authProblem || null
        });
    }
    res.json({ user: req.user });
});


module.exports = router;
