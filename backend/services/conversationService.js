// Bounded social-only handling. A salutation never consumes a substantive request.
const greeting = /^(?:hi|hello|hey|hiya|yo|good (?:morning|afternoon|evening))(?:\s+(?:love|there|friend|dear|uni))?\b[\s,!:.\-]*/i;
function stripGreeting(text) {
    const clean = String(text || '').trim();
    const rest = clean.replace(greeting, '').trim();
    return /[a-z0-9]/i.test(rest) ? rest : clean;
}
function reply(text, profile) {
    const value = String(text || '').trim();
    const normalized = value.toLowerCase().replace(/[’]/g, "'").replace(/[!?.,]+$/g, '').trim();
    const rest = normalized.replace(greeting, '').trim();
    if (greeting.test(normalized) && !rest) return require('./toneService').greetingFor(value, profile);
    if (/^(?:how are you(?: doing)?|how's it going|what'?s up|sup)$/.test(rest)) return "Hi! I'm here and ready to help. How can I help you today?";
    if (/^(?:thank you(?: very much| so much)?|thanks(?: a lot| so much)?|cheers)$/.test(rest)) return "You're welcome! Let me know if you need anything else about UNILUS.";
    if (/^(?:goodbye|good bye|bye(?: bye)?|see you(?: later| soon)?|take care)$/.test(rest)) return 'Goodbye! Take care, and come back whenever you need help.';
    if (/^(?:i need help|help(?: me)?|can you help(?: me)?|please help(?: me)?)$/.test(rest)) return 'What would you like help with: programmes, fees, a timetable, finding a campus place, or a support issue?';
    return null;
}
function personalResults(text) {
    const q = String(text || '');
    return universityAcademic(q) || /\bhow (?:did|have|am) i (?:perform|performed|doing|done)\b/i.test(q) ||
        /\b(?:my|mine)\b/i.test(q) && /\b(?:ca(?: (?:marks?|scores?|results?))?|final (?:marks?|results?|grades?)|(?:exam|examination|semester) (?:results?|marks?|grades?)|results?|marks?|grades?|transcript|gpa)\b/i.test(q) &&
        !/\b(?:grade ?12|ecz|school certificate|gce|qualify|eligibility)\b/i.test(q);
}
function universityAcademic(text) {
    const q=String(text||'');
    if(/grade ?12|ecz|gce|o[ -]?levels?|school certificate|admissions?|entry requirements?|choose.*programme/i.test(q))return false;
    return /\bmy\s+(?:academic\s+)?(?:performance|transcript|academic records|academic history)\b|\b(?:all|every|each)\s+(?:completed\s+)?semesters?\b|\b(?:academic|academically|semester|transcript)\b.*\b(?:trend|improv\w*|regress\w*|declin\w*|consistent|performance|strongest|lowest|marks?|grades?|results?)\b|\b(?:improv\w*|regress\w*|declin\w*|strongest|lowest)\b.*\b(?:academically|semester)\b|university (?:course )?(?:marks|grades|results)\b/i.test(q)||pastedUniversityMarks(q);
}
function pastedUniversityMarks(q){return !/grade ?12|ecz|gce|o[ -]?levels?|admissions?/i.test(q)&&(/\b[A-Z]{2,6}\s?\d{3}\s*[:=|,\-]?\s+(?:\d{1,3}(?:\.\d+)?|[A-D][+]?)\b/i.test(q)||/university (?:course )?(?:marks|grades|results)\s*(?:are|:)/i.test(q));}
module.exports = { reply, stripGreeting, personalResults, universityAcademic, pastedUniversityMarks };
