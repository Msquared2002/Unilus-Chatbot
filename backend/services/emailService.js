/**
 * emailService.js
 * ================
 * Sends plain-text email. Used to tell a VISITOR (someone not signed in to the
 * portal) that the ticket they opened has been resolved.
 *
 * Changes: New. Nothing else in the project sends email.
 * Affects: services/ticketNotifier.js.
 * Purpose: Visitors have no portal notice to see, so email is the only way to reach them.
 *
 * Pick ONE provider in .env. With none set, nothing is sent and the message is
 * printed to the server console ("dry run"), so the rest of the system works
 * and you can see exactly what would have been sent.
 *
 *   Resend (no extra package; uses fetch):
 *       RESEND_API_KEY=re_xxxxxxxx
 *       EMAIL_FROM="UNILUS Support <support@your-verified-domain>"
 *   SMTP (e.g. a university or Gmail account; needs `npm install nodemailer`):
 *       SMTP_HOST=smtp.example.com  SMTP_PORT=587  SMTP_USER=...  SMTP_PASS=...
 *       EMAIL_FROM="UNILUS Support <support@unilus.ac.zm>"
 *   Optional:  EMAIL_REPLY_TO=info@unilus.ac.zm
 *
 * send() never throws. It returns { sent: boolean, mode: "resend"|"smtp"|"dry-run"|"failed", error? }.
 */

const EMAIL_PATTERN = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[A-Za-z]{2,}$/;

function provider() {
    if (process.env.SMTP_HOST) return "smtp";
    if (process.env.RESEND_API_KEY) return "resend";
    return "dry-run";
}

async function sendViaResend({ to, subject, text }) {
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from: process.env.EMAIL_FROM || "UNILUS Support <onboarding@resend.dev>",
            to: [to],
            subject,
            text,
            ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
        }),
    });
    if (!response.ok) {
        throw new Error(`Resend answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
    }
}

async function sendViaSmtp({ to, subject, text }) {
    let nodemailer;
    try {
        nodemailer = require("nodemailer");
    } catch {
        throw new Error("SMTP_HOST is set but the nodemailer package is not installed (run: npm install nodemailer)");
    }
    const port = Number(process.env.SMTP_PORT) || 587;
    const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await transport.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to,
        subject,
        text,
        replyTo: process.env.EMAIL_REPLY_TO || undefined,
    });
}

async function send({ to, subject, text }) {
    if (!EMAIL_PATTERN.test(String(to || ""))) return { sent: false, mode: "failed", error: "invalid recipient address" };
    // Subjects come from our own templates, but strip line breaks anyway (header injection).
    const cleanSubject = String(subject || "").replace(/[\r\n]+/g, " ").slice(0, 200);
    const mode = provider();

    try {
        if (mode === "resend") await sendViaResend({ to, subject: cleanSubject, text });
        else if (mode === "smtp") await sendViaSmtp({ to, subject: cleanSubject, text });
        else {
            console.log(`[email:dry-run] To: ${to}\nSubject: ${cleanSubject}\n\n${text}\n`);
            return { sent: false, mode };
        }
        return { sent: true, mode };
    } catch (err) {
        console.log("[email] could not send:", err.message);
        return { sent: false, mode: "failed", error: err.message };
    }
}

module.exports = { send, provider };
