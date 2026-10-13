/**
 * authService.js
 * ===============
 * Sign-in for the UNILUS chatbot backend, built on Node's own crypto
 * (no new npm packages).
 *
 *   - Demo accounts live in data/demo_users.json. Passwords are stored as
 *     scrypt hashes, never in plain text.
 *   - A successful sign-in returns a signed token in standard JWT format
 *     (HS256) that carries the user's username, name, role and programme.
 *   - The backend decides access from that token. A request that sends no
 *     token, or a bad or expired one, is treated as a public visitor.
 *
 * Needs AUTH_JWT_SECRET in .env (at least 32 characters). Without it,
 * sign-in is switched off and every request is public (fails closed).
 *
 * Roles: "student", "staff", "admin".
 *   student, staff, admin -> signed-in tier in the chatbot's retrieval
 *   staff, admin          -> may use the ticket endpoints (see supportRoutes)
 *
 * This is a prototype of the design in the requirements document. It is
 * not connected to real UNILUS student records and has no two-factor step.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const MIN_SECRET_LENGTH = 32;
const DEFAULT_TTL_HOURS = 8;
const ROLES = ["student", "staff", "admin"];
const USERS_FILE = path.join(__dirname, "../data/demo_users.json");


/* ------------------------------ config ------------------------------ */

function getSecret() {
    const secret = process.env.AUTH_JWT_SECRET || "";
    return secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

function isConfigured() {
    return getSecret() !== null;
}

function ttlSeconds() {
    const hours = Number(process.env.AUTH_TOKEN_TTL_HOURS);
    return Math.round((hours > 0 ? hours : DEFAULT_TTL_HOURS) * 3600);
}


/* ------------------------------ users ------------------------------- */

let usersCache = null;

function loadUsers() {
    if (usersCache) return usersCache;

    try {
        const parsed = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
        usersCache = (parsed.users || []).filter(
            (u) => u && u.username && u.password_hash && ROLES.includes(u.role)
        );
    } catch (err) {
        console.log("[auth] could not load demo users:", err.message);
        usersCache = [];
    }

    return usersCache;
}

function publicUser(user) {
    return {
        username: user.username,
        name: user.name || user.username,
        role: user.role,
        programme: user.programme || null,
    };
}


/* ----------------------------- passwords ---------------------------- */

// Format: scrypt$<salt hex>$<hash hex>
function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(String(password), salt, 64);
    return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function verifyPassword(password, stored) {
    const parts = String(stored || "").split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt") return false;

    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    if (!salt.length || !expected.length) return false;

    const actual = crypto.scryptSync(String(password), salt, expected.length);
    return crypto.timingSafeEqual(actual, expected);
}

// Used when the username doesn't exist, so a wrong username takes as long
// to reject as a wrong password (no account-guessing by timing).
let dummyHash = null;
function getDummyHash() {
    if (!dummyHash) dummyHash = hashPassword("not-a-real-password");
    return dummyHash;
}

/** @returns the public user object, or null if the credentials are wrong. */
function authenticate(username, password) {
    const wanted = String(username || "").trim().toLowerCase();
    const user = loadUsers().find((u) => u.username.toLowerCase() === wanted);

    const passwordOk = verifyPassword(
        String(password || ""),
        user ? user.password_hash : getDummyHash()
    );

    return user && passwordOk ? publicUser(user) : null;
}


/* ------------------------------ tokens ------------------------------ */

const b64url = (value) => Buffer.from(value).toString("base64url");

/** @returns {{ token: string, expiresAt: string }} */
function signToken(user) {
    const secret = getSecret();
    if (!secret) throw new Error("AUTH_JWT_SECRET is not configured");

    const now = Math.floor(Date.now() / 1000);
    const payload = {
        sub: user.username,
        name: user.name,
        role: user.role,
        programme: user.programme || null,
        iat: now,
        exp: now + ttlSeconds(),
    };

    const data = `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(JSON.stringify(payload))}`;
    const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");

    return {
        token: `${data}.${signature}`,
        expiresAt: new Date(payload.exp * 1000).toISOString(),
    };
}

/**
 * @returns {{ valid: true, user: object } | { valid: false, reason: "disabled"|"invalid"|"expired" }}
 */
function verifyToken(token) {
    const secret = getSecret();
    if (!secret) return { valid: false, reason: "disabled" };

    const invalid = { valid: false, reason: "invalid" };
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return invalid;

    let header;
    let payload;
    let provided;
    try {
        header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
        payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
        provided = Buffer.from(parts[2], "base64url");
    } catch (err) {
        return invalid;
    }

    // Only HS256 is accepted ("alg: none" and anything else is rejected).
    if (!header || header.alg !== "HS256") return invalid;

    const expected = crypto.createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest();
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
        return invalid;
    }

    if (!payload || !payload.sub || typeof payload.exp !== "number" || !ROLES.includes(payload.role)) {
        return invalid;
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
        return { valid: false, reason: "expired" };
    }

    return {
        valid: true,
        user: {
            username: payload.sub,
            name: payload.name || payload.sub,
            role: payload.role,
            programme: payload.programme || null,
        },
    };
}


module.exports = {
    ROLES,
    isConfigured,
    hashPassword,
    verifyPassword,
    authenticate,
    signToken,
    verifyToken,
};
