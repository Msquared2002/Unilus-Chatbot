/**
 * locationSearchService.js
 * ==========================
 *
 * Turns free-text ("where's the library", "food near the hostel")
 * into ranked campus_places.json matches.
 *
 * Matching is a deterministic token-overlap scorer over each place's
 * `search_aliases` (plus its own name) — the same approach
 * resourceService.js uses for the official-resource registry, for
 * the same reason: "where is the library" must reliably resolve to
 * the library every time, not whatever a similarity model ranks
 * first. campus_search_index.json's flat `search_index` map is
 * consulted first as a fast exact-keyword shortcut; the alias scan is
 * the fallback that handles everything else.
 */

const campusRepository = require("./campusRepository");
const campusFacilities = require("../data/campus/campus_facilities.json").facilities;

function normalize(text) {
  return (text || "").toLowerCase();
}

function tokenize(text) {
  return normalize(text)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * An alias matches if every word in it appears somewhere in the
 * query tokens — order-independent and tolerant of extra words in
 * between ("where is the school of medicine cafeteria" still matches
 * the "cafeteria" alias).
 */
function aliasMatches(alias, queryTokens) {
  const aliasTokens = tokenize(alias);
  if (aliasTokens.length === 0) return false;
  return aliasTokens.every((t) => queryTokens.includes(t));
}

function aliasesFor(place) {
  return [...(place.search_aliases || []), place.name];
}

/**
 * Scores every campus place against the query and returns matches
 * with score > 0, best first. Ties break on shorter place name (the
 * more specific/likely-intended match).
 *
 * @param {string} query
 * @param {object} options
 * @param {number} options.limit
 * @returns {Array<{place: object, score: number, matchedAlias: string}>}
 */
function findAllMatches(query, { limit = 3 } = {}) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const searchIndex = campusRepository.getSearchIndex();

  const scored = campusRepository.getAllPlaces().map((place) => {
    let bestAlias = null;
    let bestScore = 0;

    for (const alias of aliasesFor(place)) {
      if (aliasMatches(alias, queryTokens)) {
        const score = tokenize(alias).length;
        if (score > bestScore) {
          bestScore = score;
          bestAlias = alias;
        }
      }
    }

    // Small bonus when the place is also the canonical entry for one
    // of the query's tokens in the flat search_index map — breaks
    // ties in favour of the "primary" keyword for that place.
    const isPrimaryKeyword = queryTokens.some((t) => searchIndex.search_index?.[t] === place.osm_ref);
    if (isPrimaryKeyword) bestScore += 0.5;

    return { place, score: bestScore, matchedAlias: bestAlias };
  });

  for (const facility of campusFacilities) {
    if (!facility.searchable) continue;
    const matchedAlias = facility.search_aliases.find((alias) => aliasMatches(alias, queryTokens));
    if (!matchedAlias) continue;
    const place = campusRepository.getPlaceById(facility.map_focus_place_id);
    if (place) scored.push({ place, score: tokenize(matchedAlias).length + 10, matchedAlias, facility });
  }

  return scored
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.place.name.length - b.place.name.length)
    .slice(0, limit);
}

function findBestMatch(query) {
  const [top] = findAllMatches(query, { limit: 1 });
  return top || null;
}

module.exports = { findAllMatches, findBestMatch, tokenize, aliasMatches };
