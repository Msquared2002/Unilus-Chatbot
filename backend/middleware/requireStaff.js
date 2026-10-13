/**
 * requireStaff.js
 * ================
 * Lets a request through only if it comes from staff:
 *   1. a sign-in token for a "staff" or "admin" account
 *      (Authorization: Bearer ..., set by attachUser), OR
 *   2. the shared ADMIN_API_KEY from .env, sent as  x-admin-key
 * Students and anonymous users get 401. Fails closed: with no key configured
 * and no staff token, nothing gets in. (503 only when neither the key nor the
 * sign-in secret is configured at all.)
 */

const crypto = require("crypto");
const auth = require("../services/authService");

function hasValidAdminKey(req) {
    const expected = process.env.ADMIN_API_KEY;
    if (!expected) return false;

    const provided = Buffer.from(req.get("x-admin-key") || "");
    const wanted = Buffer.from(expected);

    return provided.length === wanted.length && crypto.timingSafeEqual(provided, wanted);
}

function requireStaff(req, res, next) {
    if (req.user && (req.user.role === "staff" || req.user.role === "admin")) {
        return next();
    }

    if (hasValidAdminKey(req)) {
        return next();
    }

    // Only report "not configured" when there is genuinely no way to get in:
    // no admin key AND no sign-in secret. Otherwise the caller simply isn't
    // authorised (staff sign-in exists, they just haven't used it).
    const nothingConfigured = !process.env.ADMIN_API_KEY && !auth.isConfigured();
    const attempted = Boolean(req.get("authorization") || req.get("x-admin-key"));

    if (nothingConfigured && !attempted) {
        return res.status(503).json({
            error: "Admin access is not configured on this server."
        });
    }

    res.status(401).json({ error: "Unauthorized" });
}

module.exports = { requireStaff };
