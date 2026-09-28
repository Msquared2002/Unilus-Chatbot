/**
 * resourceService.js
 * ====================
 *
 * The structured resource registry. Each entry in
 * data/resources/resources.json now carries richer metadata than the
 * original {topic, keywords, title, url, page_type}:
 *
 *   { topic, title, description, category, keywords[], audience[],
 *     routing_only, crawlable, priority, url }
 *
 * `routing_only` (boolean) replaces the old 3-way `page_type` string
 * for describing WHETHER a page is link-first (login/payment/apply
 * pages) vs. content-first. `crawlable` is a separate, new concern —
 * some routing_only pages (password reset, apply online) are still
 * worth crawling for a short description; some resources aren't
 * UNILUS-hosted content at all (Play Store listing, Eduroam's
 * third-party tool) and must never be crawled regardless of
 * routing_only. sourcesConfig.js derives the crawler's URL list
 * directly from this registry using both fields, so there is exactly
 * ONE hand-maintained list of official resources, not two.
 *
 * `priority` (lower = more important, 1-4) is used as a tie-breaker
 * when multiple resources match a query with an equal keyword score.
 *
 * This is a deliberately simple, deterministic keyword matcher — not
 * a semantic search — because "give me the password reset link" must
 * reliably return the password reset link every time, not whatever a
 * similarity score happens to rank first. Semantic search still runs
 * separately over crawled website CONTENT via knowledgeService; this
 * registry is specifically for "does this question map to a known
 * official destination".
 */

const fs = require("fs");
const path = require("path");

const REGISTRY_PATH = path.join(__dirname, "../data/resources/resources.json");

let registry = null;
function loadRegistry() {
  if (registry) return registry;
  if (!fs.existsSync(REGISTRY_PATH)) {
    console.warn(`resourceService: ${REGISTRY_PATH} not found. No resources will be linked.`);
    registry = [];
    return registry;
  }
  registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
  return registry;
}

function normalize(text) {
  return (text || "").toLowerCase();
}

/**
 * Returns matching resources, best match first. A resource matches
 * when any of its keywords appears as a substring of the query
 * (keywords are written as short natural phrases specifically so
 * this stays a meaningful match, not single-word noise).
 *
 * @param {string} query
 * @param {number} limit
 */
function tokenize(text) {
  return normalize(text)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * A keyword phrase matches if every word in it appears somewhere in
 * the query — order-independent and tolerant of words in between
 * ("I forgot my password" still matches the "forgot password"
 * keyword phrase). This is still fully deterministic, just not
 * limited to exact contiguous substrings.
 */
function keywordMatches(keyword, queryTokens) {
  const keywordTokens = tokenize(keyword);
  if (keywordTokens.length === 0) return false;
  return keywordTokens.every((t) => queryTokens.includes(t));
}

function findResources(query, { limit = 3 } = {}) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored = loadRegistry()
    .map((resource) => {
      const matchedKeywords = (resource.keywords || []).filter((kw) => keywordMatches(kw, queryTokens));
      // Score by total matched words across all matched keyword
      // phrases, so a resource matching a longer/more specific phrase
      // ranks above one matching only on an incidental short phrase.
      const score = matchedKeywords.reduce((sum, kw) => sum + tokenize(kw).length, 0);
      return { resource, score, matchedKeywords };
    })
    .filter((r) => r.score > 0)
    // Higher keyword score first; priority (lower number = more
    // important) breaks ties between equally-good keyword matches.
    .sort((a, b) => b.score - a.score || (a.resource.priority || 9) - (b.resource.priority || 9))
    .slice(0, limit);

  return scored.map(({ resource, matchedKeywords }) => ({
    topic: resource.topic,
    title: resource.title,
    description: resource.description || null,
    category: resource.category || null,
    audience: resource.audience || [],
    priority: resource.priority ?? null,
    url: resource.url,
    routing_only: Boolean(resource.routing_only),
    // Kept for backward compatibility with anything still reading the
    // original 3-way string field.
    page_type: resource.routing_only ? "routing_only" : "content",
    matchedKeywords,
  }));
}

function getByTopic(topic) {
  return loadRegistry().find((r) => r.topic === topic) || null;
}

function allResources() {
  return loadRegistry();
}

module.exports = { findResources, getByTopic, allResources };
