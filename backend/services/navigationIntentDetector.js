/**
 * navigationIntentDetector.js
 * =============================
 *
 * Pure classification function — no I/O, fully unit-testable — that
 * decides whether a question is a campus-navigation request, and if
 * so which kind. Mirrors retrievalService.classifyQuery's shape: a
 * side-effect-free classifier that the calling service (here,
 * navigationService.js) combines with actual data lookups.
 *
 * Two intent types are recognised:
 *
 *   "locate"    — "where is the library", "take me to the hostel",
 *                 "navigate to the gym", "directions to the hospital"
 *   "proximity" — "what's near the library", "is the cafeteria close
 *                 to the hospital", "what's next to the gym"
 *
 * A trigger phrase alone is NOT enough to treat a question as
 * navigation — navigationService still requires an actual place match
 * from locationSearchService before intercepting the question, so a
 * generic "how do I find my timetable" (no known place mentioned)
 * safely falls through to the existing timetable/knowledge pipeline.
 */

const LOCATE_TRIGGERS = [
  /\bwhere\s+(?:is|are|'s)\b/i,
  /\btake me to\b/i,
  /\bnavigate to\b/i,
  /\bshow me\b/i,
  /\blocate\b/i,
  /\bhow (?:do|can) i get to\b/i,
  /\bdirections? to\b/i,
  /\bgo to\b/i,
  /\broute me to\b/i,
  /\bfind (?:the|a|an)\b/i,
];

const PROXIMITY_TRIGGERS = [
  /\bnear(?:by)?\b/i,
  /\bclose to\b/i,
  /\bnext to\b/i,
  /\baround\b/i,
  /\bwhat'?s\s+(?:close|near)\b/i,
];

function matchesAny(patterns, text) {
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * @param {string} query
 * @returns {{hasLocateTrigger: boolean, hasProximityTrigger: boolean}}
 */
function classify(query) {
  const text = (query || "").trim();

  return {
    hasLocateTrigger: matchesAny(LOCATE_TRIGGERS, text),
    hasProximityTrigger: matchesAny(PROXIMITY_TRIGGERS, text),
  };
}

module.exports = { classify, LOCATE_TRIGGERS, PROXIMITY_TRIGGERS };
