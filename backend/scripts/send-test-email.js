/**
 * send-test-email.js
 * ===================
 * Sends ONE sample "ticket resolved" email through whatever is set in backend/.env,
 * so you can check the email setup without resolving a real ticket.
 *
 *   cd backend
 *   node scripts/send-test-email.js you@example.com
 *
 * With no provider configured it prints the email instead of sending it ("dry run").
 * On failure it prints what went wrong and the usual fix.
 */

try { require("dotenv").config({ path: require("path").join(__dirname, "../.env") }); } catch { /* dotenv missing: use real environment */ }

const emailService = require("../services/emailService");
const { resolvedEmail } = require("../services/ticketEmail");

const to = process.argv[2];
if (!to) {
    console.log("Usage: node scripts/send-test-email.js you@example.com");
    process.exit(1);
}

// What people usually get wrong, matched against the error text.
const HINTS = [
    [/nodemailer package is not installed/i, "Run: npm install nodemailer   (then try again)"],
    [/535|invalid login|username and password not accepted|authentication/i, "The login was refused. For Gmail you need an App Password (turn on 2-Step Verification, then create an App Password), not your normal password. For a university mailbox, check the username and password with IT."],
    [/only send testing emails to your own|domain is not verified|403/i, "Resend only lets you email your own address until you verify a sending domain in the Resend dashboard, and EMAIL_FROM must use that domain."],
    [/Resend answered 401|api key/i, "The Resend API key was refused. Check RESEND_API_KEY."],
    [/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|ESOCKET/i, "Could not reach the mail server. Check SMTP_HOST and SMTP_PORT, your internet connection, and that a firewall is not blocking the port."],
    [/self.signed|certificate/i, "The mail server's certificate was rejected. Check the host name, or ask IT about the server's certificate."],
    [/invalid recipient/i, "That does not look like a valid email address."],
];

(async () => {
    const mode = emailService.provider();
    console.log(`Provider: ${mode}${mode === "dry-run" ? "  (nothing is configured in backend/.env, so nothing will be sent)" : ""}`);
    if (mode !== "dry-run") console.log(`From:     ${process.env.EMAIL_FROM || (mode === "smtp" ? process.env.SMTP_USER || "(not set: add EMAIL_FROM to .env)" : "UNILUS Support <onboarding@resend.dev>")}`);
    console.log(`To:       ${to}\n`);

    const sample = resolvedEmail({
        ref: "UNI-2026-TEST",
        department: "Registry",
        question: "This is a test email from the UNILUS chatbot",
    });
    const result = await emailService.send({ to, ...sample });

    if (result.sent) {
        console.log(`Sent via ${result.mode}. Check the inbox (and the spam folder) of ${to}.`);
        return;
    }
    if (result.mode === "dry-run") {
        console.log("Dry run only. Add RESEND_API_KEY or SMTP_HOST to backend/.env, then run this again.");
        return;
    }
    console.log(`Could not send: ${result.error}`);
    const hint = HINTS.find(([pattern]) => pattern.test(result.error || ""));
    if (hint) console.log(`\nLikely fix: ${hint[1]}`);
    process.exitCode = 1;
})();
