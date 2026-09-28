/**
 * readers/htmlReader.js
 * =======================
 *
 * Converts HTML (a saved university web page, an FAQ page, etc.)
 * into the shared block format. Unlike textReader's heuristics, HTML
 * gives us REAL structural tags — <h1>-<h6>, <table>, <ul>/<ol>,
 * <p> — so headings and tables are detected exactly, not guessed.
 */

const cheerio = require("cheerio");

function readHtml(html, { filename = "page.html" } = {}) {
  const $ = cheerio.load(html);

  // Strip elements that are never real content.
  $("script, style, nav, footer, noscript").remove();

  const blocks = [];
  let firstHeading = null;

  const root = $("main").length ? $("main") : $("body").length ? $("body") : $.root();

  root.children().each(function walk() {
    visit($(this));
  });

  function visit(el) {
    const tag = (el.get(0) && el.get(0).tagName || "").toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      const text = el.text().trim();
      if (text) {
        const level = Number(tag[1]);
        blocks.push({ type: "heading", text, level, page: 1 });
        if (!firstHeading) firstHeading = text;
      }
      return;
    }

    if (tag === "table") {
      const rows = [];
      el.find("tr").each((_, tr) => {
        const cells = $(tr)
          .find("th,td")
          .map((_, cell) => $(cell).text().trim())
          .get();
        if (cells.length) rows.push(cells.join(" | "));
      });
      if (rows.length) blocks.push({ type: "table", text: rows.join("\n"), page: 1 });
      return;
    }

    if (tag === "ul" || tag === "ol") {
      const items = el
        .find("li")
        .map((_, li) => `- ${$(li).text().trim()}`)
        .get()
        .filter(Boolean);
      if (items.length) blocks.push({ type: "list", text: items.join("\n"), page: 1 });
      return;
    }

    if (tag === "p" || tag === "div" || tag === "section" || tag === "article") {
      // For container tags, only take direct text if this element has
      // no block-level children we'd otherwise visit (avoids duplicating
      // text from nested headings/tables/lists already handled above).
      const hasBlockChildren = el.children("h1,h2,h3,h4,h5,h6,table,ul,ol,p,div,section,article").length > 0;

      if (hasBlockChildren) {
        el.children().each((_, child) => visit($(child)));
        return;
      }

      const text = el.text().replace(/\s+/g, " ").trim();
      if (text) blocks.push({ type: "paragraph", text, page: 1 });
      return;
    }

    // Unknown/inline tag at this level: fall back to its own children.
    el.children().each((_, child) => visit($(child)));
  }

  return { blocks, pageCount: 1, firstHeading };
}

module.exports = { readHtml };
