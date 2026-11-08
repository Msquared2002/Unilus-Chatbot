// Short-lived consent, keyed by the existing owned session. This is not a session store.
const ownership = require('./sessionOwnershipService');
const session = require('./sessionService');
const support = require('./supportService');
const conversation = require('./conversationService');
const pending = new Map();
const TTL = 10 * 60 * 1000;
const LIMIT = 500;
const requestPattern = /\b(?:create|open|raise|submit|log|file)\s+(?:(?:a|an|the|my|support|new|formal)\s+)*ticket\b/i;
const confirmation = /^(?:yes[,\s]+)?(?:submit|create|open)\s+(?:it|(?:this|the|my)\s+(?:support\s+)?ticket)[.!\s]*$/i;
const cancel = /^(?:cancel(?: it| the ticket| this ticket)?|no(?: thanks)?|not now|never ?mind|don't submit it)[.!\s]*$/i;
function response(answer, status, ticket = null) {
    return { answer, queryType: { isSupport: true }, support: { status }, ticket,
        sources: [], resources: [], recommendedResources: [], suggestedActions: [], timetableMatches: 0, usedFallback: false };
}
function prune() {
    for (const [id, entry] of pending) if (Date.now() - entry.at >= TTL && !entry.submitting) pending.delete(id);
}
function issueFromRequest(question) {
    const after = question.slice((question.match(requestPattern)?.index || 0) + (question.match(requestPattern)?.[0].length || 0));
    return after.replace(/^\s*(?:for me\b|please\b)\s*/i, '').replace(/^\s*(?:for|about|regarding|because|:)\s*/i, '').replace(/[?.!]+$/g, '').trim();
}
async function tryHandle(question, sessionId, user = null) {
    prune();
    const key = String(sessionId || '');
    let entry = pending.get(key);
    const owner = user ? 'user:' + user.username : 'guest';
    const requested = requestPattern.test(question);
    const confirmed = confirmation.test(question);
    if (!requested && !confirmed && !entry) return null;
    if (!await ownership.owns(sessionId, user)) return response('This support request is unavailable. Start a new conversation before requesting support.', 'unavailable');
    if (entry && entry.owner !== owner) return response('This support request is unavailable.', 'unavailable');
    if (requested && /\b(?:do not|don't|never|no need to|don't want to)\s+(?:create|open|raise|submit|log|file)\b/i.test(question)) {
        if (!entry?.submitting) pending.delete(key);
        return response('No new support ticket will be submitted.', 'cancelled');
    }
    if (confirmed) {
        if (!entry || entry.state === 'describing') return response('There is no support request ready to submit. Describe the issue and ask me to create a ticket first.', 'none');
        if (entry.state === 'submitted') return response(`Your demonstration support ticket ${entry.ticket.ref} is already saved. No additional ticket was created.`, 'submitted', entry.ticket);
        // Recheck the exact entry after the asynchronous ownership check. Only one write may run.
        if (pending.get(key) !== entry) return response('The pending request changed. Review the issue and confirm it again.', 'unavailable');
        if (!entry.submitting) entry.submitting = support.createTicket({ sessionId, question: entry.issue, history: [] });
        try {
            const result = await entry.submitting;
            entry.state = 'submitted'; entry.ticket = result.ticket; entry.at = Date.now(); entry.submitting = null;
            return response(`Your demonstration support ticket ${result.ticket.ref} ${result.created ? 'has been saved' : 'is already open'}. Only the issue you confirmed was included. It has not been verified as delivered to a university office. Ask for the status of ${result.ticket.ref} to check it.`, 'submitted', result.ticket);
        } catch {
            entry.submitting = null;
            return response('The support ticket could not be saved. Your request is still pending; you can retry with "Yes, submit it" or cancel.', 'pending');
        }
    }
    if (entry && cancel.test(question)) {
        if (entry.submitting || entry.state === 'submitted') return response('Submission is already in progress or completed. No existing ticket has been deleted or closed.', 'submitted', entry.ticket || null);
        pending.delete(key);
        return response('Cancelled. No support ticket was submitted.', 'cancelled');
    }
    if (entry && /^yes[.!\s]*$/i.test(question)) {
        if (entry.state === 'submitted') return response(`Your demonstration support ticket ${entry.ticket.ref} is already saved.`, 'submitted', entry.ticket);
        if (entry.submitting) return response('Your confirmed submission is in progress. No additional ticket will be submitted.', 'pending');
        return response('To confirm the quoted issue, say "Yes, submit it". You can also say "Cancel". Nothing has been submitted.', 'pending');
    }
    if (!requested && conversation.reply(question)) { pending.delete(key); return null; }
    let issue;
    if (requested) {
        issue = issueFromRequest(question);
        if (!issue) {
            const history = await session.getRecentHistory(sessionId, 8);
            const prior = history.filter(t => t.role === 'user' && t.content !== question && !requestPattern.test(t.content) && !confirmation.test(t.content) && !conversation.reply(t.content));
            issue = prior.at(-1)?.content;
        }
    } else if (entry?.state === 'describing') issue = question;
    else { pending.delete(key); return null; } // A topic change cancels pending consent.
    if (issue && conversation.reply(issue)) issue = null;
    if (pending.size >= LIMIT && !pending.has(key)) return response('Support confirmation is busy. Please try again shortly. Nothing has been submitted.', 'unavailable');
    if (issue && issue.length > 2000) {
        pending.set(key, { owner, state: 'describing', at: Date.now() });
        return response('Please describe the support issue in at most 2,000 characters. Nothing has been submitted.', 'describing');
    }
    entry = { owner, issue, state: issue ? 'pending' : 'describing', at: Date.now() };
    pending.set(key, entry);
    return issue
        ? response(`Please confirm this support issue:\n\n${issue}\n\nOnly this quoted issue will be saved in the demonstration support queue; your chat history will not be attached. Say "Yes, submit it" to submit, or "Cancel". Nothing has been submitted yet.`, 'pending')
        : response('What issue should the support ticket describe? I will show it to you for confirmation before submitting anything.', 'describing');
}
module.exports = { tryHandle, response, reset: sessionId => pending.delete(sessionId) };
