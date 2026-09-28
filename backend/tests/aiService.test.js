const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildSystemPrompt,
  sanitizeAnswerLinks,
  normalizeUrl,
} = require("../services/aiService");

test("answer prompt requires exact proper nouns and no invented URLs", () => {
  const prompt = buildSystemPrompt();
  assert.match(prompt, /Preserve exact factual tokens/i);
  assert.match(prompt, /Only output a clickable URL that appears verbatim/i);
  assert.match(prompt, /Answer the exact question first/i);
  assert.match(prompt, /sources conflict/i);
});

test("unsupported markdown URLs are removed while label is preserved", () => {
  const answer = "Use the [Student Portal](https://made-up.example/login) to continue.";
  const cleaned = sanitizeAnswerLinks(answer, ["https://portal.unilus.ac.zm/"]);
  assert.equal(cleaned, "Use the Student Portal to continue.");
});

test("an exact supplied markdown URL remains clickable", () => {
  const url = "https://web.unilus.ac.zm/apply-online/";
  const answer = `Use the [online application guide](${url}).`;
  assert.equal(sanitizeAnswerLinks(answer, [url]), answer);
});

test("unsupported plain protocol URLs are removed", () => {
  const cleaned = sanitizeAnswerLinks(
    "Go to https://invented.example/path for help.",
    ["https://web.unilus.ac.zm/apply-online/"]
  );
  assert.equal(cleaned, "Go to for help.");
});

test("URL normalization treats www form as https and ignores trailing slash", () => {
  assert.equal(normalizeUrl("www.unilus.ac.zm/"), normalizeUrl("https://www.unilus.ac.zm"));
});

test("numeric grounding detects a conflicting fee copied from supporting evidence", () => {
  const { findUnsupportedNumericTokens } = require("../services/aiService");
  const primary = "REVISED ACCOMMODATION FEES 2026 Ordinary Six 6,300.00";
  assert.deepEqual(findUnsupportedNumericTokens("Ordinary six: K7,300.00", primary), ["7300"]);
  assert.deepEqual(findUnsupportedNumericTokens("Ordinary six: K6,300.00", primary), []);
});

test("question focus hints suppress unrelated payment and withdrawal sections", () => {
  const { buildQuestionFocusHints } = require("../services/aiService");
  const hints = buildQuestionFocusHints("I've registered but I want to switch my programme. What do I do?");
  assert.ok(hints.some((h) => /bank or payment-method/i.test(h)));
  assert.ok(hints.some((h) => /withdrawal or re-admission/i.test(h)));
});

test("numeric extraction ignores ordered-list numbering but keeps fees, years and percentages", () => {
  const { extractNumericTokens } = require("../services/aiService");
  const tokens = extractNumericTokens("1. Pay K6,300.00 in 2026. A 50% deposit may apply.");
  assert.deepEqual(tokens.sort(), ["2026", "50%", "6300"].sort());
});
