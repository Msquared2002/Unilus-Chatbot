/**
 * ticketEmail.js
 * ===============
 * The wording of the "your ticket has been resolved" email. Pure text, no database,
 * so it can be used by ticketNotifier and by scripts/send-test-email.js alike.
 *
 * Optional .env:  EMAIL_SUPPORT_LINE="the Registry on 0971 ... or registry@unilus.ac.zm"
 */

const SUPPORT_LINE = process.env.EMAIL_SUPPORT_LINE || "the Academic Office on 0971263550 or info@unilus.ac.zm";

function resolvedEmail(ticket) {
    const question = String(ticket.question || "").trim();
    const shortQuestion = question.length > 160 ? `${question.slice(0, 159)}…` : question;
    return {
        subject: `Your UNILUS ticket ${ticket.ref} has been resolved`,
        text: [
            "Hello,",
            "",
            `Your request to the ${ticket.department} has been marked as resolved.`,
            "",
            `Ticket: ${ticket.ref}`,
            shortQuestion ? `Your question: "${shortQuestion}"` : null,
            "",
            "You can ask the UNILUS chatbot again to get the latest answer.",
            `If it still isn't sorted, please contact ${SUPPORT_LINE} and quote the ticket number above.`,
            "",
            "University of Lusaka Student Support",
        ].filter((line) => line !== null).join("\n"),
    };
}

module.exports = { resolvedEmail };
