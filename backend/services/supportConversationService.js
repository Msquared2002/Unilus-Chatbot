// Short-lived consent, keyed by the existing owned session. This is not a session store.
const ownership = require('./sessionOwnershipService');
const session = require('./sessionService');
const support = require('./supportService');
const conversation = require('./conversationService');
const pending = new Map();
const TTL = 10 * 60 * 1000;
const LIMIT = 500;
const requestPattern = /\b(?:create|open|raise|submit|log|file)\s+(?:(?:a|an|the|my|support|new|formal)\s+)*(?:ticket|support request)\b/i;
const assistancePattern = /\b(?:I need|I want|please give me)\s+(?:some\s+)?help\s+with\s+my\s+(?:fees?|payments?|account|portal|registration|results?)\b/i;
const paymentProblem = q => /\b(?:payment|paid|tuition)\b/i.test(q) && /hasn.t reflected|not reflected|missing|not credited/i.test(q);
const reportProblem=q=>/\bI (?:need|want) to report (?:a )?problem\b/i.test(q);
const isExplicitRequest = question => requestPattern.test(question) || assistancePattern.test(question) || paymentProblem(question)||reportProblem(question);
const confirmation = /^(?:(?:yes[,\s]+)?(?:submit|create|open)\s+(?:it|(?:this|the|my)\s+(?:support\s+)?ticket)|confirmed|yes[,\s]+I confirm|go ahead and submit|please submit the ticket|proceed with submission)[.!\s]*$/i;
const cancel = /^(?:cancel(?: it| the ticket| this ticket)?|no(?: thanks)?|not now|never ?mind|don't submit(?: it)?|no[,\s]+do not submit it)[.!\s]*$/i;
function response(answer, status, ticket = null, draftId = null) {
    return { answer, queryType: { isSupport: true }, support: { status, contactOptional:true, ...(draftId?{draftId}:{}) }, ticket,
        sources: [], resources: [], recommendedResources: [], suggestedActions: [], timetableMatches: 0, usedFallback: false };
}
function prune() {
    for (const [id, entry] of pending) if (Date.now() - entry.at >= TTL && !entry.submitting) pending.delete(id);
}
function issueFromRequest(question) {
    const after = question.slice((question.match(requestPattern)?.index || 0) + (question.match(requestPattern)?.[0].length || 0));
    return after.replace(/^\s*(?:for me\b|please\b)\s*/i, '').replace(/^\s*(?:for|about|regarding|because|:)\s*/i, '').replace(/^[\s.!:]*Issue:\s*/i,'').replace(/(?:[.!]\s*|,?\s*but\s+)(?:ask (?:me )?for confirmation before submitting(?: the ticket)?|please help me report this issue,? but do not submit it until I confirm|do not submit it until I confirm)[.!\s]*$/i,'').replace(/[?.!]+$/g, '').trim();
}
async function tryHandle(question, sessionId, user = null, expectedDraftId = null) {
    prune();
    const key = String(sessionId || '');
    let entry = pending.get(key);
    const owner = user ? 'user:' + user.username : 'guest';
    if(expectedDraftId&&(!entry||entry.state!=='pending'||entry.draftId!==expectedDraftId))return response('This ticket review is no longer active. Review a new issue before submitting.','unavailable');
    const requested = requestPattern.test(question);
    const confirmed = confirmation.test(question);
    if (!requested && !confirmed && !entry) {
        if(!assistancePattern.test(question)&&!paymentProblem(question)&&!reportProblem(question))return null;
        if(!await ownership.owns(sessionId,user))return response('Start your own conversation before requesting support.','unavailable');
        pending.set(key,{draftId:require('node:crypto').randomUUID(),owner,state:'offered',issue:require('./supportContactService').redact(question),at:Date.now(),studentContact:{omit:true}});
        return response(paymentProblem(question)?'For a payment that has not reflected, keep your receipt and date available for a staff review. Do not share bank or card credentials here. Would you like help preparing a Finance Office support ticket? Nothing has been submitted.':'Would you like help preparing a support ticket for this issue? Nothing has been submitted.','offered');
    }
    if (!await ownership.owns(sessionId, user)) return response('This support request is unavailable. Start a new conversation before requesting support.', 'unavailable');
    if (entry && entry.owner !== owner) return response('This support request is unavailable.', 'unavailable');
    if(entry?.state==='offered'&&!requested){
        if(cancel.test(question)){pending.delete(key);return response('No support ticket will be submitted.','cancelled');}
        if(confirmed||/^(?:yes(?:[, ]+please)?|please|help me (?:report|prepare)(?: it)?)[.!\s]*$/i.test(question)){
            entry.state='pending';entry.at=Date.now();
            return response('Please review this quoted support issue:\n\n'+entry.issue+'\n\nSay "Yes, submit it" to confirm, or "Cancel". Nothing has been submitted.','pending',null,entry.draftId);
        }
        pending.delete(key);return null;
    }
    if (requested && /\b(?:do not|don't|never|no need to|don't want to)\s+(?:create|open|raise|submit|log|file)\b/i.test(question) && !/\b(?:until I confirm|before (?:I confirm|confirmation))\b/i.test(question)) {
        if (!entry?.submitting) pending.delete(key);
        return response('No new support ticket will be submitted.', 'cancelled');
    }
    if (confirmed) {
        if (!entry || entry.state === 'describing') return response('There is no support request ready to submit. Describe the issue and ask me to create a ticket first.', 'none');
        if (entry.state === 'submitted') return response(`Your demonstration support ticket ${entry.ticket.ref} is already saved. No additional ticket was created.`, 'submitted', entry.ticket);
        // Recheck the exact entry after the asynchronous ownership check. Only one write may run.
        if (pending.get(key) !== entry) return response('The pending request changed. Review the issue and confirm it again.', 'unavailable');
        if (!entry.submitting) entry.submitting = require('./ticketSubmissionService').submit({sessionId,user,question:entry.issue,consent:true,studentContact:entry.studentContact});
        try {
            const result = await entry.submitting;
            entry.state = 'submitted'; entry.ticket = result.ticket; entry.at = Date.now(); entry.submitting = null;
            return response(`Your demonstration support ticket ${result.ticket.ref} ${result.created ? 'has been saved' : 'is already open'}. Only the issue you confirmed was included. It has not been verified as delivered to a university office. Ask for the status of ${result.ticket.ref} to check it.`, 'submitted', result.ticket);
        } catch {
            entry.submitting = null;
            return response('The support ticket could not be saved. Your request is still pending; you can retry with "Yes, submit it" or cancel.', 'pending',null,entry.draftId);
        }
    }
    if (entry && cancel.test(question)) {
        if (entry.submitting || entry.state === 'submitted') return response('Submission is already in progress or completed. No existing ticket has been deleted or closed.', 'submitted', entry.ticket || null);
        pending.delete(key);
        return response('Cancelled. No support ticket was submitted.', 'cancelled');
    }
    if (entry && /^yes[.!\s]*$/i.test(question)) {
        if (entry.state === 'submitted') return response(`Your demonstration support ticket ${entry.ticket.ref} is already saved.`, 'submitted', entry.ticket);
        if (entry.submitting) return response('Your confirmed submission is in progress. No additional ticket will be submitted.', 'pending',null,entry.draftId);
        return response('To confirm the quoted issue, say "Yes, submit it". You can also say "Cancel". Nothing has been submitted.', 'pending',null,entry.draftId);
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
    issue = issue ? require('./supportContactService').redact(issue) : issue;
    entry = { draftId:require('node:crypto').randomUUID(), owner, issue, studentContact:{omit:true}, state: issue ? 'pending' : 'describing', at: Date.now() };
    pending.set(key, entry);
    return issue
        ? response(`Please confirm this support issue:\n\n${issue}\n\nOnly this quoted issue will be saved in the demonstration support queue; your chat history will not be attached. Say "Yes, submit it" to submit, or "Cancel". Nothing has been submitted yet.`, 'pending',null,entry.draftId)
        : response('What issue should the support ticket describe? I will show it to you for confirmation before submitting anything.', 'describing');
}
async function setContact(sessionId,user,input,draftId){if(!await ownership.owns(sessionId,user))throw Object.assign(Error('Support draft unavailable'),{status:403});const entry=pending.get(sessionId);if(!entry||entry.state!=='pending'||entry.submitting||(draftId&&entry.draftId!==draftId))throw Object.assign(Error('Review a pending issue first'),{status:409});entry.studentContact={...require('./supportContactService').forTicket(input),consent:input?.consent===true};return {ok:true,status:entry.studentContact.status};}
module.exports = { isExplicitRequest,setContact,tryHandle, response, reset: sessionId => pending.delete(sessionId) };
