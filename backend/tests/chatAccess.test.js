const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// The chat service is run for real; only the AI call, the session store and the knowledge search are stubbed,
// so this checks the role rules, not the model.
const stub = (rel, exports) => {
  const p = require.resolve(path.join(__dirname, "..", "services", rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
const aiCalls = [];
stub("aiService.js", { askAI: async (q, ctx) => { aiCalls.push(ctx); return "AI answer"; } });
stub("sessionService.js", { createSessionId: () => "sid", appendMessage: async () => {}, getRecentHistory: async () => [{ role: "user", content: "x" }] });
// The website page about timetables WOULD match if the search ran, which is exactly the leak this guards against.
stub("knowledgeService.js", {
  searchKnowledge: async () => [
    { text: "Class timetable: Monday BIT320 08:00", source_file: "https://web.unilus.ac.zm/calendars-and-time-tables/", url: "https://web.unilus.ac.zm/calendars-and-time-tables/", title: "Calendars and Time Tables", score: 0.9 },
    { text: "First year applications open in January for the BIT programme.", source_file: "handbook.txt", title: "Admissions", score: 0.9, evidence_role: "primary" },
  ],
});
// The local embedding model is not needed to test role rules.
stub("embeddingService.js", { createEmbedding: async () => [0], cosineSimilarity: () => 0 });
stub("queryUnderstandingService.js", {
  plannerEnabled: () => false,
  planQuery: async (q) => ({ searchQueries: [q], entities: {}, usedPlanner: false }),
  fallbackPlan: (q) => ({ searchQueries: [q], entities: {}, usedPlanner: false }),
});
const chat = require("../services/chatService");

test("a visitor asking for a timetable gets the sign-in reply and the model is never called", async () => {
  aiCalls.length = 0;
  for (const audience of ["public", "spoofed"]) {
    const r = await chat.answerQuestion("Show me the BIT320 timetable", "sid", audience, null);
    assert.equal(r.signInRequired, true, audience);
    assert.match(r.answer, /signed-in students/i);
    assert.deepEqual(r.sources, []);
    assert.deepEqual(r.resources, []);
  }
  assert.equal(aiCalls.length, 0);
});

test("a visitor asking an admissions question is still answered", async () => {
  aiCalls.length = 0;
  const r = await chat.answerQuestion("when can I apply for first year BIT", "sid", "public", null);
  assert.notEqual(r.signInRequired, true);
  assert.equal(aiCalls.length, 1);
  // ...but the timetable page is not part of what the model was given
  assert.doesNotMatch(aiCalls[0], /Class timetable: Monday BIT320/);
});
