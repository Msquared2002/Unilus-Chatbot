/**
 * retrievalRouter.js
 * ====================
 *
 * Replaces retrievalService.js as the single retrieval entry point.
 *
 * Fixes K9: the old file had THREE different, disagreeing intent
 * detectors (chatService.detectIntent — dead code; retrievalService's
 * inline keyword arrays; and extractCourseName's hardcoded 10-course
 * whitelist). This file is the one place query classification and
 * routing happens, and every list used for classification is either
 * a general pattern (course-code regex, day names) or built from the
 * actual timetable data at load time (via
 * timetableService.isKnownLecturerNameToken) — never a hardcoded
 * sample of "the first few things we thought to test with".
 *
 * chatService.js should call ONLY `retrieveAnswer(query)` from here.
 */

const timetableService = require("./timetableService");
const knowledgeService = require("./knowledgeService");
const resourceService = require("./resourceService");
const queryUnderstandingService = require("./queryUnderstandingService");

// Mirrors the Python pipeline's DAYS list. Necessarily duplicated
// across the Python/Node boundary, but this is the one JS location —
// nothing else in the backend should define its own day-name list.
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const COURSE_CODE_RE = /\b[A-Z]{2,6}\d{3}\b/i;
const VENUE_CODE_RE = /\b(?:SVT|PNR|LH|MMS|MASS|BUS|ICT|LIB|AUD|HALL)[_-][A-Za-z0-9_-]+\b/i;
const TITLE_NAME_RE = /\b(?:Mr|Mrs|Ms|Dr|Prof)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/;

const TIMETABLE_KEYWORDS = [
  "timetable", "schedule", "class", "lecture", "where is", "when is",
  "who teaches", "venue", "room", "next class", "my classes",
];

const KNOWLEDGE_KEYWORDS = [
  "defer", "graduat", "requirement", "library", "document", "register",
  "registration", "fee", "vice chancellor", "handbook", "policy",
  "calendar", "admission", "apply", "exam", "regulation", "conduct",
  "how do i", "how can i", "what is the", "who is the",
];

function extractCourseCode(text) {
  const match = text.match(COURSE_CODE_RE);
  return match ? match[0].toUpperCase() : null;
}

function extractVenueCode(text) {
  const match = text.match(VENUE_CODE_RE);
  return match ? match[0].toUpperCase() : null;
}

function extractDay(text) {
  const lower = text.toLowerCase();
  return DAYS.find((day) => lower.includes(day.toLowerCase())) || null;
}

function extractStudyMode(text) {
  const lower = String(text || "").toLowerCase();
  if (/\b(?:part[- ]?time|pt)\b/.test(lower)) return "part_time";
  if (/\b(?:full[- ]?time|ft)\b/.test(lower)) return "full_time";
  return null;
}

function extractProgrammeStage(text) {
  const raw = String(text || "");
  const upper = raw.toUpperCase();

  // Direct cohort code, e.g. BIT32 / BBA41 / BIT32-PT.
  const compactCodeMatches = upper.match(/\b[A-Z][A-Z0-9_]*?[1-9][1-9](?:\s*-\s*(?:PT|FT))?\b/g) || [];
  for (const token of compactCodeMatches) {
    const compact = token.replace(/\s+/g, "");
    const match = compact.match(/^([A-Z][A-Z0-9_]*?)([1-9])([1-9])(?:-(PT|FT))?$/);
    if (!match) continue;
    const [, family, year, semester, modeToken] = match;
    if (!timetableService.isKnownProgrammeFamily(family)) continue;
    return {
      programmeFamily: family,
      year: Number(year),
      semester: Number(semester),
      studyMode: modeToken === "PT" ? "part_time" : modeToken === "FT" ? "full_time" : extractStudyMode(raw),
    };
  }

  // Programme family is data-driven: any short token that is actually the
  // prefix of generated programme codes (BIT, BBA, BCS, ...).
  const words = upper.match(/\b[A-Z][A-Z0-9_]{1,15}\b/g) || [];
  const programmeFamily = words.find((word) => timetableService.isKnownProgrammeFamily(word)) || null;

  let year = null;
  let semester = null;

  const yearMatch = raw.match(/\b([1-9])(?:st|nd|rd|th)?\s*(?:year|yr)\b/i)
    || raw.match(/\b(?:year|yr)\s*([1-9])\b/i);
  if (yearMatch) year = Number(yearMatch[1]);

  const semesterMatch = raw.match(/\b([1-9])(?:st|nd|rd|th)?\s*(?:semester|sem)\b/i)
    || raw.match(/\b(?:semester|sem)\s*([1-9])\b/i);
  if (semesterMatch) semester = Number(semesterMatch[1]);

  // Student shorthand such as "BIT 3,2" means year 3, semester 2.
  // Only interpret this compact pair when a known programme family is also
  // present, so ordinary numeric text is not reclassified accidentally.
  if (programmeFamily && (year == null || semester == null)) {
    const pair = raw.match(/\b([1-9])\s*[,/.]\s*([1-9])\b/);
    if (pair) {
      if (year == null) year = Number(pair[1]);
      if (semester == null) semester = Number(pair[2]);
    }
  }

  return {
    programmeFamily,
    year,
    semester,
    studyMode: extractStudyMode(raw),
  };
}

function extractLecturerQuery(text) {
  const withTitle = text.match(TITLE_NAME_RE);
  if (withTitle) return withTitle[0];

  const words = text
    .replace(/[?.,]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const ignoredWords = new Set([
    "studies",
    "study",
    "defer",
    "deferment",
    "registration",
    "requirements",
    "requirement",
    "library",
    "handbook",
    "policy",
    "student",
    "students",
    "course",
    "class",
    "lecture",
    "where",
    "when",
    "what",
    "tell",
    "about",
    "does",
    "how"
  ]);

  const known = words.filter(
    (w) =>
      !ignoredWords.has(w) &&
      timetableService.isKnownLecturerNameToken(w)
  );

  return known.length ? known.join(" ") : null;
}

/**
 * Pure classification function — no I/O, fully unit-testable.
 */
function classifyQuery(query) {
  const lower = query.toLowerCase();

  const courseCode = extractCourseCode(query);
  const venueCode = extractVenueCode(query);
  const day = extractDay(query);
  const lecturer = extractLecturerQuery(query);
  const programmeStage = extractProgrammeStage(query);

  const hasTimetableKeyword = TIMETABLE_KEYWORDS.some((k) => lower.includes(k));
  const hasKnowledgeKeyword = KNOWLEDGE_KEYWORDS.some((k) => lower.includes(k));

  const hasProgrammeStageSignal = Boolean(
    programmeStage.programmeFamily && (programmeStage.year || programmeStage.semester)
  );
  const isTimetable = Boolean(
    courseCode || venueCode || lecturer || hasTimetableKeyword || hasProgrammeStageSignal || (day && !hasKnowledgeKeyword)
  );
  const isKnowledge = hasKnowledgeKeyword || (!isTimetable); // every question is at least a knowledge candidate by default

  return {
    isTimetable,
    isKnowledge,
    isMixed: isTimetable && isKnowledge,
    entities: {
      courseCode, venueCode, day, lecturer,
      programmeFamily: programmeStage.programmeFamily,
      year: programmeStage.year,
      semester: programmeStage.semester,
      studyMode: programmeStage.studyMode,
    },
  };
}

function searchTimetableByEntities(query, entities) {
  if (entities.courseCode) {
    const byCourse = timetableService.getByCourse(entities.courseCode);
    if (byCourse.length) return byCourse;
  }
  if (entities.venueCode) {
    const byVenue = timetableService.getByVenue(entities.venueCode);
    if (byVenue.length) return byVenue;
  }
  if (entities.lecturer) {
    const byLecturer = timetableService.getByLecturer(entities.lecturer);
    if (byLecturer.length) return byLecturer;
  }
  if (entities.programmeFamily && entities.year && entities.semester) {
    let byProgrammeStage = timetableService.getByProgrammeStage({
      family: entities.programmeFamily,
      year: entities.year,
      semester: entities.semester,
      mode: entities.studyMode,
    });
    if (entities.day) {
      byProgrammeStage = byProgrammeStage.filter((record) =>
        String(record.day || "").toLowerCase() === String(entities.day).toLowerCase()
      );
    }
    if (byProgrammeStage.length) return byProgrammeStage;

    // A fully specified programme/year/semester query is high-confidence.
    // Do NOT fall through to fuzzy word search, because common words such as
    // "for" can otherwise return unrelated programmes and create a false
    // timetable. Empty is safer and lets the answer layer say the cohort was
    // not found.
    return [];
  }
  if (entities.day) {
    const byDay = timetableService.getByDay(entities.day);
    if (byDay.length) return byDay;
  }

  // If the user named a programme family but omitted the stage, avoid a fuzzy
  // cross-programme search. The answer layer can request year/semester.
  if (entities.programmeFamily) return [];

  // No exact entity matched anything — fall back to fuzzy token search.
  return timetableService.search(query);
}

/**
 * The one retrieval entry point the rest of the backend should call.
 *
 * @param {string} query
 * @returns {Promise<{queryType: object, timetable: Array, knowledge: Array, resources: Array}>}
 */
async function retrieveAnswer(query) {
  const queryType = classifyQuery(query);

  const result = {
    queryType,
    timetable: [],
    knowledge: [],
    resources: [],
    queryPlan: queryUnderstandingService.fallbackPlan(query, "not needed"),
  };

  if (queryType.isTimetable) {
    result.timetable = searchTimetableByEntities(query, queryType.entities);
  }

  if (queryType.isKnowledge) {
    // The planner never answers the student. It only rewrites ambiguous
    // natural language into retrieval-friendly alternatives and entities.
    // It fails open to the original query if disabled/unavailable.
    result.queryPlan = await queryUnderstandingService.planQuery(query);
    result.knowledge = await knowledgeService.searchKnowledge(query, {
      searchQueries: result.queryPlan.searchQueries,
      entities: result.queryPlan.entities,
    });
  }

  // If we guessed "timetable" but found nothing, check knowledge only when
  // the timetable classification was weak/generic. A recognized course,
  // venue, lecturer, or programme family is a high-confidence structured
  // timetable request; sending that into RAG creates misleading handbook/PDF
  // answers when what we really need is a timetable clarification/no-match.
  const hasStructuredTimetableEntity = Boolean(
    queryType.entities.courseCode || queryType.entities.venueCode || queryType.entities.lecturer ||
    queryType.entities.programmeFamily
  );
  if (
    queryType.isTimetable && result.timetable.length === 0 && !queryType.isKnowledge &&
    !hasStructuredTimetableEntity
  ) {
    result.queryPlan = await queryUnderstandingService.planQuery(query);
    result.knowledge = await knowledgeService.searchKnowledge(query, {
      searchQueries: result.queryPlan.searchQueries,
      entities: result.queryPlan.entities,
    });
  }

  // Resource-registry lookup runs for every question EXCEPT a
  // specific class lookup (a course code, venue code, or a named
  // lecturer was recognized). "Show me the BIT320 timetable" should
  // never come back with a suggestion to visit the timetable portal
  // website — the chatbot already has, and is using, the actual
  // answer. A generic timetable question with no specific entity
  // ("where can I see my timetable online") still legitimately wants
  // the timetable_portal resource, so only entity-bearing timetable
  // queries are suppressed, not every isTimetable=true query.
  const hasSpecificTimetableEntity = Boolean(
    queryType.entities.courseCode || queryType.entities.venueCode || queryType.entities.lecturer ||
    (queryType.entities.programmeFamily && queryType.entities.year && queryType.entities.semester)
  );

  result.resources = hasSpecificTimetableEntity ? [] : resourceService.findResources(query);

  return result;
}

module.exports = {
  retrieveAnswer,
  classifyQuery,
  extractCourseCode,
  extractVenueCode,
  extractDay,
  extractLecturerQuery,
  extractProgrammeStage,
  extractStudyMode,
  searchTimetableByEntities,
};
