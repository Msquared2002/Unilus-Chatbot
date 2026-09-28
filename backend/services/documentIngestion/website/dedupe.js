/**
 * website/dedupe.js
 * ===================
 *
 * "Remove duplicate navigation text. Avoid embedding repeated menu
 * items dozens of times."
 *
 * The approach: a block of text that appears, verbatim, on many
 * DIFFERENT pages is almost certainly site chrome (nav menu, footer,
 * cookie notice) rather than real page content — genuine content is
 * specific to its page. This needs no HTML-structure guessing (no
 * "assume the <nav> tag is always nav", which breaks the moment a
 * page's markup doesn't cooperate); it just looks at repetition
 * across the actual crawled set.
 *
 * A block is dropped from EVERY page it appears on once it's been
 * seen, verbatim, on at least `minPages` distinct pages (default 3 —
 * one or two pages legitimately sharing a sentence is normal, three
 * or more identical blocks is chrome).
 */

const DEFAULT_MIN_PAGES = 3;

function normalizeForComparison(text) {
  return (text || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * @param {Record<string, Array<{type: string, text: string}>>} pagesBlocks
 *        url -> blocks, as produced by htmlReader.readHtml for each page.
 * @param {number} minPages
 * @returns {Record<string, Array>} the same shape, with boilerplate blocks removed.
 */
function dedupeAcrossPages(pagesBlocks, minPages = DEFAULT_MIN_PAGES) {
  const urls = Object.keys(pagesBlocks);

  // Count how many DISTINCT pages each normalized block text appears on.
  const pageCountByText = new Map();
  for (const url of urls) {
    const seenOnThisPage = new Set();
    for (const block of pagesBlocks[url]) {
      const key = normalizeForComparison(block.text);
      if (!key || seenOnThisPage.has(key)) continue; // count each page once per distinct text
      seenOnThisPage.add(key);
      pageCountByText.set(key, (pageCountByText.get(key) || 0) + 1);
    }
  }

  const boilerplateKeys = new Set(
    [...pageCountByText.entries()].filter(([, count]) => count >= minPages).map(([key]) => key)
  );

  const cleaned = {};
  for (const url of urls) {
    cleaned[url] = pagesBlocks[url].filter((block) => !boilerplateKeys.has(normalizeForComparison(block.text)));
  }

  return { cleaned, boilerplateCount: boilerplateKeys.size };
}

module.exports = { dedupeAcrossPages, normalizeForComparison, DEFAULT_MIN_PAGES };
