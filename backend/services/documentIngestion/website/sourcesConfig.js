/**
 * website/sourcesConfig.js
 * ==========================
 *
 * The crawler's URL list, DERIVED from data/resources/resources.json
 * rather than hand-maintained separately.
 *
 * Previously this file held its own copy of every URL alongside
 * resources.json's copy of the same URLs — two hand-maintained lists
 * that could (and did start to) drift apart. Now resources.json is
 * the single source of truth: adding a new official resource there
 * automatically makes it crawlable too, with no second edit needed.
 *
 * Mapping from the registry's fields to the crawler's `page_type`:
 *   - resource.crawlable === false        -> excluded entirely (page_type: "external_no_crawl")
 *   - resource.routing_only === true      -> page_type: "routing_only" (crawled, but capped short)
 *   - otherwise                            -> page_type: "content" (crawled and chunked normally)
 *
 * `ingestWebsite.js` and its tests are unchanged by this refactor —
 * they only ever consumed the exported `WEBSITE_SOURCES` array shape
 * ({ url, topic, page_type }), which is preserved exactly.
 */

const fs = require("fs");
const path = require("path");

const ROUTING_ONLY_MAX_CHARS = 400;

const RESOURCES_PATH = path.join(__dirname, "../../../data/resources/resources.json");

function loadResources() {
  if (!fs.existsSync(RESOURCES_PATH)) {
    console.warn(`sourcesConfig: ${RESOURCES_PATH} not found. No website sources to crawl.`);
    return [];
  }
  return JSON.parse(fs.readFileSync(RESOURCES_PATH, "utf8"));
}

function toSource(resource) {
  const page_type = resource.crawlable === false
    ? "external_no_crawl"
    : resource.routing_only
      ? "routing_only"
      : "content";

  return { url: resource.url, topic: resource.topic, page_type };
}

// De-duplicate by URL: resources.json can legitimately have two
// registry entries pointing at the same URL for different query
// intents (e.g. "application_guide" and "apply_online" both point at
// /apply-online/) — that's fine for link recommendation, but the
// crawler should only fetch each physical URL once.
function buildWebsiteSources() {
  const seenUrls = new Set();
  const sources = [];

  for (const resource of loadResources()) {
    if (seenUrls.has(resource.url)) continue;
    seenUrls.add(resource.url);
    sources.push(toSource(resource));
  }

  return sources;
}

const WEBSITE_SOURCES = buildWebsiteSources();

module.exports = { WEBSITE_SOURCES, ROUTING_ONLY_MAX_CHARS, buildWebsiteSources };
