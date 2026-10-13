/**
 * attachUser.js
 * ==============
 * Runs on every request. Reads "Authorization: Bearer <token>" and sets:
 *   req.user         the signed-in user ({ username, name, role, programme }),
 *                    or null for a public visitor
 *   req.authProblem  null, or why a token that WAS sent was rejected:
 *                    "expired" | "invalid" | "disabled"
 *
 * It never blocks a request. Routes decide what each tier may do, so a
 * bad or expired token simply means "public" and the chat keeps working.
 */

const auth = require("../services/authService");

function attachUser(req, res, next) {
    req.user = null;
    req.authProblem = null;

    const match = (req.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
    if (!match) return next();

    const result = auth.verifyToken(match[1].trim());
    if (result.valid) {
        req.user = result.user;
    } else {
        req.authProblem = result.reason;
    }

    next();
}

module.exports = { attachUser };
