const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parsePlannerResponse,
  planQuery,
} = require("../services/queryUnderstandingService");

test("planner JSON is converted into a safe multi-query retrieval plan", () => {
  const plan = parsePlannerResponse(JSON.stringify({
    intent: "fees",
    normalizedQuery: "Bachelor of Pharmacy 2026 fees local ZMW",
    searchQueries: [
      "pharmacy local SADC fee schedule 2026",
      "Bachelor of Pharmacy tuition ZMW",
      "a fourth query that should be trimmed",
    ],
    entities: {
      programme: "Bachelor of Pharmacy",
      academic_year: 2026,
      audience: "local",
      currency: "ZMW",
      ignored_key: "must not leak through",
    },
  }), "I'm doing pharmacy locally, what do I pay this year?");

  assert.equal(plan.usedPlanner, true);
  assert.equal(plan.entities.programme, "Bachelor of Pharmacy");
  assert.equal(plan.entities.academic_year, 2026);
  assert.equal(plan.entities.ignored_key, undefined);
  assert.ok(plan.searchQueries.length <= 3, "original + at most two planner rewrites");
  assert.equal(plan.searchQueries[0], "I'm doing pharmacy locally, what do I pay this year?");
});

test("malformed planner output fails open to the original query", () => {
  const plan = parsePlannerResponse("not json at all", "How do I defer?");
  assert.equal(plan.usedPlanner, false);
  assert.deepEqual(plan.searchQueries, ["How do I defer?"]);
});

test("planQuery can use an injected cheap-model completion without a real API call", async () => {
  const plan = await planQuery("I want to pause my studies for a semester", {
    force: true,
    completionFn: async () => JSON.stringify({
      intent: "deferment",
      normalizedQuery: "student deferment policy",
      searchQueries: ["pause studies deferment semester"],
      entities: { topic: "deferment", document_type: "regulation" },
    }),
  });

  assert.equal(plan.usedPlanner, true);
  assert.equal(plan.intent, "deferment");
  assert.ok(plan.searchQueries.some((q) => /deferment/i.test(q)));
});

test("planner safely derives ZMW + fee_schedule for a local fee query when currency is omitted", () => {
  const plan = parsePlannerResponse(JSON.stringify({
    intent: "fees for local pharmacy program 2026",
    normalizedQuery: "local pharmacy fees 2026",
    searchQueries: ["UNILUS pharmacy local fees 2026"],
    entities: {
      programme: "pharmacy",
      academic_year: 2026,
      audience: "local",
      topic: "fees",
    },
  }), "I'm doing pharmacy and I'm local, how much am I supposed to pay this year?");

  assert.equal(plan.entities.currency, "ZMW");
  assert.equal(plan.entities.document_type, "fee_schedule");
  assert.equal(plan.entities.topic, "fees");
});

test("planner safely derives USD for a foreign/international fee query", () => {
  const plan = parsePlannerResponse(JSON.stringify({
    intent: "international pharmacy fees",
    normalizedQuery: "international pharmacy fees 2026",
    searchQueries: [],
    entities: {
      programme: "pharmacy",
      academic_year: 2026,
      audience: "international",
      topic: "fees",
    },
  }), "What are the pharmacy fees for an international student?");

  assert.equal(plan.entities.currency, "USD");
  assert.equal(plan.entities.document_type, "fee_schedule");
});

test("planner does not infer a currency from local audience for a non-fee question", () => {
  const plan = parsePlannerResponse(JSON.stringify({
    intent: "local admissions requirements",
    normalizedQuery: "local admissions requirements",
    searchQueries: [],
    entities: {
      audience: "local",
      topic: "admissions",
    },
  }), "What do local students need for admission?");

  assert.equal(plan.entities.currency, undefined);
});

test("planner derives programme_tuition scope when a programme fee question is explicit", () => {
  const plan = parsePlannerResponse(JSON.stringify({
    intent: "pharmacy fees",
    normalizedQuery: "pharmacy fees 2026",
    searchQueries: [],
    entities: {
      programme: "pharmacy",
      academic_year: 2026,
      audience: "local",
      topic: "fees",
    },
  }), "How much do I pay for pharmacy this year?");

  assert.equal(plan.entities.fee_scope, "programme_tuition");
});

test("planner distinguishes accommodation fees from programme tuition", () => {
  const plan = parsePlannerResponse(JSON.stringify({
    intent: "hostel fees",
    normalizedQuery: "UNILUS hostel accommodation fees 2026",
    searchQueries: [],
    entities: { topic: "fees", academic_year: 2026 },
  }), "How much are the hostels this year?");

  assert.equal(plan.entities.fee_scope, "accommodation");
  assert.equal(plan.entities.document_type, "fee_schedule");
});

test("planner only derives application scope for an application-fee question", () => {
  const plan = parsePlannerResponse(JSON.stringify({
    intent: "application fee",
    normalizedQuery: "UNILUS application fee",
    searchQueries: [],
    entities: { topic: "fees" },
  }), "How much does it cost to apply?");

  assert.equal(plan.entities.fee_scope, "application");
});


test("planner bridges programme-switch wording to the handbook's canonical course-of-study terminology", () => {
  const plan = parsePlannerResponse(JSON.stringify({
    intent: "programme change",
    normalizedQuery: "switch programme after registration",
    searchQueries: ["change programme after registration UNILUS"],
    entities: {},
  }), "I've already registered but I want to switch my programme. What do I do?");

  assert.ok(plan.searchQueries.some((q) => /changes during course of study/i.test(q)));
  assert.ok(plan.searchQueries.some((q) => /Board of Studies/i.test(q)));
  assert.equal(plan.entities.topic, "changes during course of study");
});
