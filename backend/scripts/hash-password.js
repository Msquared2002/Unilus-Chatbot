#!/usr/bin/env node
/**
 * hash-password.js
 * =================
 * Prints a password hash to paste into data/demo_users.json.
 *
 *   node scripts/hash-password.js "the-password"
 */
const { hashPassword } = require("../services/authService");

const password = process.argv[2];
if (!password) {
    console.error('Usage: node scripts/hash-password.js "the-password"');
    process.exit(1);
}
console.log(hashPassword(password));
