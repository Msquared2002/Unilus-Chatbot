/**
 * ticketNotifier.js
 * ==================
 * Tells the person who opened a ticket that its status changed.
 *
 *   Signed-in portal student  ->  a notice tied to their account, shown by the widget
 *                                 on the portal (any device). No email.
 *   Visitor (not signed in)   ->  a notice for their chat session AND, when the ticket
 *                                 is Resolved and they gave an email, one email.
 *
 * Changes: New. Called by supportService.updateTicketStatus for every status change.
 * Affects: notificationService (notices), emailService (visitor email), tickets.resolved_notified_at.
 * Purpose: Staff add the answer to the knowledge base, mark the ticket Resolved, and the
 *          requester hears about it automatically.
 *
 * statusChanged() never throws; a failed email or notice must not undo the status change.
 */

const notifications = require("./notificationService");
const emailService = require("./emailService");

const { resolvedEmail } = require("./ticketEmail");

async function statusChanged(ticket) {
    try {
        await notifications.ticketStatusChanged({
            ref: ticket.ref,
            status: ticket.status,
            sessionId: ticket.session_id,
            username: ticket.student_username,
            question: ticket.question,
        });

        const isVisitor = !ticket.student_username;
        if (ticket.status === "Resolved" && isVisitor && ticket.student_email) {
            const support = require("./supportService");
            if (await support.claimResolutionEmail(ticket.ref)) {
                const result = await emailService.send({ to: ticket.student_email, ...resolvedEmail(ticket) });
                // A real failure releases the claim so a later "Resolved" can retry.
                // A dry run (no provider configured) keeps it, so it does not repeat.
                if (result.mode === "failed") await support.releaseResolutionEmail(ticket.ref);
            }
        }
    } catch (err) {
        console.log("[ticketNotifier] could not notify the student:", err.message);
    }
}

module.exports = { statusChanged, resolvedEmail };
