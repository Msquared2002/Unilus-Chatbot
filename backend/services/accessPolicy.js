/*
Changes: One place that decides what a Visitor (not signed in, or only claiming to be a student) may and may not get, and
         what only a signed-in Student may get. Replaces the single hard-coded file name that used to be the only rule.
Affects: services/retrievalRouter.js (filters evidence and refuses student-only requests before any search),
         services/chatService.js (the sign-in reply), data/resources/resources.json (two new optional fields, see below).
Purpose: Follow the project document: class and exam timetables are a Student capability (FR2). A Visitor can ask about
         admissions and programmes, get official links, use the map, escalate and track a ticket. Before this change the
         sign-in prompt only appeared when the search found nothing else, so the public website's "Calendars and Time Tables"
         page and the timetable-portal link let timetable answers through to visitors.

How a source becomes student-only (no code change needed):
  - Uploaded documents: sidecar file  <name>.meta.json  with  "access": "restricted"   (already supported)
  - Website pages / links: in data/resources/resources.json add to the entry
        "access": "student"          hide the link AND the crawled page text from visitors
        "content_access": "student"  hide only the crawled page text; the link itself stays public
*/

const resourceService = require("./resourceService");

const SIGN_IN_TEXT = "Class and exam timetables are available to signed-in students. Sign in to the student portal and ask me again, and I can show you yours.";

function isStudent(audience) {
    return audience === "student";
}

// ---------- is this a request for a class or exam timetable? ----------

// Plain phrases that mean "a timetable" however the question is worded.
const TIMETABLE_PHRASES = [
    /\btime\s?-?tables?\b/i,
    /\b(?:my|next|today'?s|tomorrow'?s)\s+(?:classes|class|lectures?|exams?)\b/i,
    /\bwho\s+teaches\b/i,
    /\b(?:class|lecture|exam(?:ination)?)\s+(?:schedule|times?|dates?|venues?|rooms?)\b/i,
    /\bschedules?\s+(?:for|of)\s+(?:classes|lectures|exams)\b/i,
];

// A course code, lecturer or programme year on its own is not a timetable request ("what is BIT320 about?"),
// so these only count together with a timetable-style word.
const WORDS_WITH_COURSE_OR_LECTURER = /\b(?:when|what\s+time|which\s+day|schedule|class(?:es)?|lectures?|exams?|examinations?|venue|room|teach\w*)\b/i;
const WORDS_WITH_PROGRAMME_YEAR = /\b(?:schedule|class(?:es)?|lectures?|exams?|examinations?|venue|room|teach\w*)\b/i;

// Campus facility timetables (gym, pool, hospital...) are public information, not student timetables.
const FACILITY = /\b(?:gym|swimming|pool|tennis|basketball|volleyball|netball|football|hospital|clinic|cafeteria|library|bus|shuttle)\b/i;

/**
 * @param {string} text      the question (and, when known, the history-resolved version of it)
 * @param {object} entities  queryType.entities from retrievalRouter.classifyQuery
 */
function isRestrictedTimetableRequest(text = "", entities = {}) {
    const hasCourseOrLecturer = Boolean(entities.courseCode || entities.lecturer);
    if (FACILITY.test(text) && !hasCourseOrLecturer) return false;

    if (TIMETABLE_PHRASES.some((re) => re.test(text))) return true;

    if (hasCourseOrLecturer && WORDS_WITH_COURSE_OR_LECTURER.test(text)) return true;

    const hasProgrammeYear = Boolean(entities.programmeFamily && (entities.year || entities.semester));
    return hasProgrammeYear && WORDS_WITH_PROGRAMME_YEAR.test(text);
}

// ---------- student-only sources ----------

function normaliseUrl(value) {
    return String(value || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[#?].*$/, "").replace(/\/+$/, "");
}

function registry() {
    try {
        return resourceService.allResources();
    } catch {
        return [];
    }
}

/** Website addresses whose page text must not be shown to visitors (read from the resource registry). */
function studentOnlyUrls() {
    return new Set(
        registry()
            .filter((r) => r.access === "student" || r.content_access === "student")
            .map((r) => normaliseUrl(r.url))
            .filter(Boolean)
    );
}

function studentOnlyTopics() {
    return new Set(registry().filter((r) => r.access === "student").map((r) => r.topic));
}

/**
 * Removes evidence a visitor must not see before it reaches the model.
 * @param {Array} knowledge  retrieved chunks
 * @param {string} audience  "student" or anything else (treated as a visitor)
 * @param {Set<string>} restrictedFiles  uploaded documents marked restricted
 */
function filterKnowledge(knowledge = [], audience, restrictedFiles = new Set()) {
    if (isStudent(audience)) return knowledge;
    const urls = studentOnlyUrls();
    return knowledge.filter((chunk) => {
        if (restrictedFiles.has(chunk.source_file)) return false;
        if (urls.has(normaliseUrl(chunk.url)) || urls.has(normaliseUrl(chunk.source_file))) return false;
        return true;
    });
}

/** Removes official links a visitor must not be offered. */
function filterResources(resources = [], audience) {
    if (isStudent(audience)) return resources;
    const topics = studentOnlyTopics();
    return resources.filter((resource) => !topics.has(resource.topic));
}

module.exports = {
    SIGN_IN_TEXT,
    isStudent,
    isRestrictedTimetableRequest,
    filterKnowledge,
    filterResources,
    // exposed for tests
    normaliseUrl,
    studentOnlyUrls,
};
