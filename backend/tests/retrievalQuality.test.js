const test = require("node:test");
const assert = require("node:assert/strict");

const knowledgeService = require("../services/knowledgeService");

// Zero vectors intentionally disable semantic help. These regression tests
// prove that the new lexical/metadata path can recover real corpus facts that
// the old dense-only architecture could miss because programme/year clues were
// stored outside the chunk body.
const zeroEmbedding = async () => Array(384).fill(0);

test("real corpus: natural pharmacy/local/year wording retrieves the ZMW Pharmacy fee source without dense embeddings", async () => {
  const results = await knowledgeService.searchKnowledge(
    "how much should a local pharmacy student pay this year",
    { embedFn: zeroEmbedding, topK: 5, expandNeighbors: false }
  );

  assert.ok(results.length > 0);
  assert.equal(results[0].source_file, "BACHELOR-OF-PHARMACY-ZMW-UNILUS-20266.pdf");
  assert.equal(results[0].programme, "Bachelor Of Pharmacy");
  assert.equal(results[0].currency, "ZMW");
});

test("real corpus: programme metadata rescues a pharmacy payment chunk whose body does not name Pharmacy", async () => {
  const results = await knowledgeService.searchKnowledge(
    "what are the payment requirements for pharmacy fees",
    { embedFn: zeroEmbedding, topK: 5, expandNeighbors: false }
  );

  assert.ok(results.some((r) => /BACHELOR-OF-PHARMACY-ZMW/i.test(r.source_file || "")));
  assert.ok(results.some((r) => /payment/i.test(r.text)));
});

test("real corpus: a planner rewrite can recover deferment from conversational 'take a break' wording", async () => {
  const results = await knowledgeService.searchKnowledge(
    "can i take a break from university for a semester and come back later",
    {
      embedFn: zeroEmbedding,
      searchQueries: ["student deferment policy temporary break studies"],
      entities: { topic: "deferment" },
      topK: 5,
      expandNeighbors: false,
    }
  );

  assert.ok(results.some((r) => /deferment/i.test(`${r.source_file} ${r.title} ${r.text}`)));
});

test("real corpus: accommodation-fee scope keeps hostel pricing ahead of programme tuition", async () => {
  const results = await knowledgeService.searchKnowledge(
    "how much are the hostels this year",
    {
      embedFn: zeroEmbedding,
      searchQueries: ["UNILUS accommodation hostel residence fees 2026"],
      entities: {
        academic_year: 2026,
        topic: "fees",
        document_type: "fee_schedule",
        fee_scope: "accommodation",
      },
      topK: 5,
      expandNeighbors: false,
    }
  );

  assert.ok(results.length > 0);
  assert.match(`${results[0].source_file || ""} ${results[0].title || ""}`, /accommod|accomod/i);
  assert.equal(results[0].fee_scope, "accommodation");
});

test("real corpus: natural application-documents wording retrieves the online application guide", async () => {
  const results = await knowledgeService.searchKnowledge(
    "what papers do i need when applying to unilus",
    {
      embedFn: zeroEmbedding,
      searchQueries: ["online application documents required certified certificates NRC passport ZAQA"],
      entities: { topic: "application documents" },
      topK: 5,
      expandNeighbors: false,
    }
  );

  assert.ok(results.some((r) => /apply-online/i.test(`${r.source_file || ""} ${r.url || ""}`)));
  assert.ok(results.some((r) => /documents required|certified academic|passport|NRC/i.test(r.text)));
});

test("real corpus: programme-change wording retrieves either the handbook rule or official change form", async () => {
  const results = await knowledgeService.searchKnowledge(
    "i already registered but i want to switch my programme",
    {
      embedFn: zeroEmbedding,
      searchQueries: ["changes during course of study change programme Board of Studies Dean"],
      entities: { topic: "change programme" },
      topK: 5,
      expandNeighbors: false,
    }
  );

  assert.ok(results.some((r) => /changes during course of study|change of programme/i.test(`${r.text} ${r.section || ""}`)));
});

test("real corpus: failed-two-courses wording retrieves repeat-semester/progression rules", async () => {
  const results = await knowledgeService.searchKnowledge(
    "i failed two courses can i still go to the next semester",
    {
      embedFn: zeroEmbedding,
      searchQueries: ["repeat semester failed two courses progression Board of Examiners"],
      entities: { topic: "progression repeat semester" },
      topK: 5,
      expandNeighbors: false,
    }
  );

  assert.ok(results.some((r) => /repeat semester|failed two courses|proceeding to the next semester/i.test(r.text)));
});

test("real corpus: live-style programme-change planner output bridges switch wording to handbook terminology", async () => {
  const { parsePlannerResponse } = require("../services/queryUnderstandingService");
  const question = "I've already registered but I want to switch my programme. What do I do?";
  const plan = parsePlannerResponse(JSON.stringify({
    intent: "programme change",
    normalizedQuery: "switch programme after registration",
    searchQueries: ["change programme after registration UNILUS"],
    entities: {},
  }), question);

  const results = await knowledgeService.searchKnowledge(question, {
    embedFn: zeroEmbedding,
    searchQueries: plan.searchQueries,
    entities: plan.entities,
    topK: 5,
    expandNeighbors: false,
  });

  assert.ok(results.some((r) => /changes during course of study/i.test(`${r.text} ${r.section || ""}`)));
});
