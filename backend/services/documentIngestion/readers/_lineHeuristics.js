/**
 * readers/_lineHeuristics.js
 * ============================
 *
 * Small heuristics shared between textReader.js and pdfReader.js —
 * both deal with plain lines of text with no real markup, so the
 * "is this a list line" check is written once here instead of twice.
 */

function looksLikeListLine(line) {
  return /^\s*(?:[-*•]|\d+[.)])\s+/.test(line);
}

module.exports = { looksLikeListLine };
