const test = require("node:test");
const assert = require("node:assert/strict");
const { crawlAndBuildChunks, truncateBlocksForRoutingOnlyPage } = require("../scripts/ingestWebsite");

const NAV_HTML_WRAPPER = (bodyHtml) => `
  <html><body>
    <nav><ul><li>Home</li><li>Programmes</li><li>Admissions</li><li>Contact</li></ul></nav>
    ${bodyHtml}
  </body></html>`;

test("crawlAndBuildChunks extracts and chunks content pages via a fake fetch function", async () => {
  const sources = [
    {
      url: "https://web.unilus.ac.zm/accomodation/",
      topic: "accommodation",
      page_type: "content",
    },
  ];

  const fakeFetch = async () =>
    NAV_HTML_WRAPPER(`
      <h1>Accommodation</h1>
      <p>UNILUS offers on-campus and off-campus accommodation options for students.</p>
    `);

  const { chunks, failedUrls } = await crawlAndBuildChunks(sources, fakeFetch);

  assert.equal(failedUrls.length, 0);
  assert.ok(chunks.length > 0);
  assert.equal(chunks[0].metadata.url, "https://web.unilus.ac.zm/accomodation/");
  assert.equal(chunks[0].metadata.document_type, "website");
  assert.equal(chunks[0].metadata.topic, "accommodation");
  assert.match(chunks[0].text, /on-campus and off-campus accommodation/);
});

test("crawlAndBuildChunks removes nav boilerplate shared across 3+ pages", async () => {
  const sources = [
    { url: "https://web.unilus.ac.zm/a/", topic: "a", page_type: "content" },
    { url: "https://web.unilus.ac.zm/b/", topic: "b", page_type: "content" },
    { url: "https://web.unilus.ac.zm/c/", topic: "c", page_type: "content" },
  ];

  const fakeFetch = async (url) =>
    NAV_HTML_WRAPPER(`<h1>Page ${url}</h1><p>Unique real content specific to ${url} that is long enough to be kept as a chunk on its own.</p>`);

  const { chunks } = await crawlAndBuildChunks(sources, fakeFetch);

  const navText = chunks.map((c) => c.text).join(" ");
  assert.ok(!navText.includes("Home"), "nav items must not appear in any chunk");
  assert.ok(chunks.some((c) => c.text.includes("Unique real content")));
});

test("routing_only pages are truncated before chunking, not fully embedded", async () => {
  const longLoginPageText = "Login instructions. ".repeat(200); // > ROUTING_ONLY_MAX_CHARS

  const sources = [
    { url: "https://portal.unilus.ac.zm/password/recover", topic: "password_reset", page_type: "routing_only" },
    { url: "https://web.unilus.ac.zm/other1/", topic: "x", page_type: "content" },
    { url: "https://web.unilus.ac.zm/other2/", topic: "y", page_type: "content" },
  ];

  const fakeFetch = async (url) => {
    if (url.includes("password")) {
      return `<html><body><p>${longLoginPageText}</p></body></html>`;
    }
    return `<html><body><h1>Distinct ${url}</h1><p>Distinct content for ${url}.</p></body></html>`;
  };

  const { chunks } = await crawlAndBuildChunks(sources, fakeFetch);
  const passwordChunks = chunks.filter((c) => c.metadata.topic === "password_reset");

  const totalPasswordChars = passwordChunks.reduce((sum, c) => sum + c.text.length, 0);
  assert.ok(totalPasswordChars <= 400, `expected routing_only content capped near 400 chars, got ${totalPasswordChars}`);
});

test("a page that fails to fetch is reported in failedUrls and doesn't crash the batch", async () => {
  const sources = [
    { url: "https://web.unilus.ac.zm/broken/", topic: "broken", page_type: "content" },
    { url: "https://web.unilus.ac.zm/ok/", topic: "ok", page_type: "content" },
  ];

  const fakeFetch = async (url) => {
    if (url.includes("broken")) throw new Error("timeout");
    return `<html><body><h1>OK Page</h1><p>This page loaded fine and has real content.</p></body></html>`;
  };

  const { chunks, failedUrls } = await crawlAndBuildChunks(sources, fakeFetch);
  assert.deepEqual(failedUrls, ["https://web.unilus.ac.zm/broken/"]);
  assert.ok(chunks.some((c) => c.text.includes("loaded fine")));
});

test("truncateBlocksForRoutingOnlyPage caps combined text length", () => {
  const blocks = [
    { type: "paragraph", text: "a".repeat(300) },
    { type: "paragraph", text: "b".repeat(300) },
  ];
  const result = truncateBlocksForRoutingOnlyPage(blocks, 400);
  assert.equal(result.length, 1);
  assert.ok(result[0].text.length <= 400);
});

test("truncateBlocksForRoutingOnlyPage returns empty array for no content", () => {
  assert.deepEqual(truncateBlocksForRoutingOnlyPage([], 400), []);
});
