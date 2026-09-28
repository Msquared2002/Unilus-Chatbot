const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { JsonVectorStore } = require("../services/vectorStore");
const knowledgeService = require("../services/knowledgeService");

// Deterministic "embeddings" for testing: each fake vector just encodes
// which topic bucket a piece of text belongs to, so we can prove
// scoring/threshold/filtering behavior without downloading the real
// transformer model (which this sandbox has no network access to).
function fakeEmbed(text) {
  const lower = text.toLowerCase();
  return [
    lower.includes("defer") ? 1 : 0,
    lower.includes("fee") ? 1 : 0,
    lower.includes("library") ? 1 : 0,
  ];
}

function buildTempStore(records) {
  const tmpFile = path.join(os.tmpdir(), `knowledge_test_${Date.now()}_${Math.random()}.json`);
  const store = new JsonVectorStore(tmpFile);
  return { store, tmpFile, seed: async () => store.upsert(records) };
}

test("returns relevant chunk with full source attribution above the threshold", async () => {
  const { store, tmpFile, seed } = buildTempStore([
    {
      id: "chunk-1",
      text: "Students may defer their studies for up to one academic year.",
      embedding: fakeEmbed("deferment policy defer"),
      metadata: {
        source_file: "regulations.pdf",
        document_type: "regulation",
        title: "Deferment Policy",
        section: "Deferment",
        page_number: 12,
        url: null,
      },
    },
  ]);
  await seed();

  const results = await knowledgeService.searchKnowledge("how do I defer my studies", {
    embedFn: fakeEmbed,
    store,
    minScore: 0.5,
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].source_file, "regulations.pdf");
  assert.equal(results[0].page_number, 12);
  assert.equal(results[0].document_type, "regulation");

  fs.rmSync(tmpFile, { force: true });
});

test("returns an empty array instead of forcing a bad match through, when nothing clears minScore", async () => {
  const { store, tmpFile, seed } = buildTempStore([
    {
      id: "chunk-1",
      text: "The library is open from 8am to 8pm on weekdays.",
      embedding: fakeEmbed("library hours"),
      metadata: {
        source_file: "handbook.pdf",
        document_type: "handbook",
        title: "Library",
        section: "Facilities",
        page_number: 3,
        url: null,
      },
    },
  ]);
  await seed();

  // A totally unrelated query — the fake embedding has zero overlap.
  const results = await knowledgeService.searchKnowledge("how much are the fees", {
    embedFn: fakeEmbed,
    store,
    minScore: 0.5,
  });

  assert.deepEqual(results, []);

  fs.rmSync(tmpFile, { force: true });
});

test("documentType filter only returns chunks of that type", async () => {
  const { store, tmpFile, seed } = buildTempStore([
    {
      id: "chunk-fee",
      text: "BIT fees are 15,000 ZMW per year.",
      embedding: fakeEmbed("fee schedule fee"),
      metadata: { source_file: "fees.pdf", document_type: "fee_schedule", title: "Fees", section: null, page_number: 1, url: null },
    },
    {
      id: "chunk-defer",
      text: "Deferment must be requested in writing.",
      embedding: fakeEmbed("defer fee"), // shares the "fee" token on purpose
      metadata: { source_file: "regulations.pdf", document_type: "regulation", title: "Deferment", section: null, page_number: 5, url: null },
    },
  ]);
  await seed();

  const results = await knowledgeService.searchKnowledge("fee", {
    embedFn: fakeEmbed,
    store,
    minScore: 0.1,
    documentType: "fee_schedule",
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].source_file, "fees.pdf");

  fs.rmSync(tmpFile, { force: true });
});

test("vectorStore refuses to store an anonymous vector with no metadata", async () => {
  const { store, tmpFile } = buildTempStore([]);
  await assert.rejects(
    () => store.upsert([{ id: "x", text: "no metadata here", embedding: [1, 0, 0] }]),
    /refusing to store an anonymous vector/
  );
  fs.rmSync(tmpFile, { force: true });
});

test("oversized retrieved text is focused around matched lexical evidence before entering LLM context", async () => {
  const filler = "general university information ".repeat(180);
  const decisive = "SPECIAL_DEFERMENT_REQUIREMENT students must submit the deferment request in writing.";
  const { store, tmpFile, seed } = buildTempStore([
    {
      id: "long-chunk",
      text: `${filler}${decisive}${filler}`,
      embedding: [0, 0, 0],
      metadata: {
        source_file: "policy.pdf",
        document_type: "regulation",
        title: "Student Policy",
        section: "Deferment",
        page_number: 12,
        url: null,
      },
    },
  ]);
  await seed();

  const zeroEmbed = () => [0, 0, 0];
  const results = await knowledgeService.searchKnowledge("special deferment requirement", {
    embedFn: zeroEmbed,
    store,
    topK: 1,
    minScore: 1,
    expandNeighbors: false,
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].retrieval.excerpted, true);
  assert.ok(results[0].text.length <= 2402); // possible leading/trailing ellipsis
  assert.match(results[0].text, /SPECIAL_DEFERMENT_REQUIREMENT/);
  assert.ok(results[0].retrieval.originalTextLength > results[0].text.length);

  fs.rmSync(tmpFile, { force: true });
});

test("planner entity conflicts push a different programme below the requested programme", async () => {
  const records = [
    {
      id: "pharmacy",
      text: "Local pharmacy student fees are payable per semester.",
      embedding: [0, 0, 0],
      metadata: {
        source_file: "pharmacy.pdf",
        document_type: "fee_schedule",
        title: "Pharmacy Fees",
        programme: "Bachelor of Pharmacy",
        academic_year: 2026,
        currency: "ZMW",
        audience: ["local"],
      },
    },
    {
      id: "nursing",
      text: "Local nursing student fees are payable per semester.",
      embedding: [0, 0, 0],
      metadata: {
        source_file: "nursing.pdf",
        document_type: "fee_schedule",
        title: "Nursing Fees",
        programme: "Diploma in Nursing",
        academic_year: 2026,
        currency: "ZMW",
        audience: ["local"],
      },
    },
  ];
  const { store, tmpFile, seed } = buildTempStore(records);
  await seed();

  const results = await knowledgeService.searchKnowledge("local fees 2026 ZMW", {
    embedFn: () => [0, 0, 0],
    store,
    entities: {
      programme: "Bachelor of Pharmacy",
      academic_year: 2026,
      audience: "local",
      currency: "ZMW",
    },
    topK: 2,
    minScore: 1,
    expandNeighbors: false,
  });

  assert.equal(results[0].id, "pharmacy");
  assert.ok(results[1].retrieval.conflictingEntities.includes("programme"));
  fs.rmSync(tmpFile, { force: true });
});

test("when enough clean entity matches exist, contradictory audience/currency candidates are removed from final context", async () => {
  const records = [
    ...[1, 2, 3].map((n) => ({
      id: `local-${n}`,
      text: `Bachelor of Pharmacy local fee information section ${n}.`,
      embedding: [0, 0, 0],
      metadata: {
        source_file: `pharmacy-local-${n}.pdf`,
        document_type: "fee_schedule",
        title: "Pharmacy Local Fees",
        programme: "Bachelor of Pharmacy",
        academic_year: 2026,
        currency: "ZMW",
        audience: ["local", "SADC"],
      },
    })),
    {
      id: "foreign-1",
      text: "Bachelor of Pharmacy foreign fee information in USD.",
      embedding: [0, 0, 0],
      metadata: {
        source_file: "pharmacy-foreign.pdf",
        document_type: "fee_schedule",
        title: "Pharmacy Foreign Fees",
        programme: "Bachelor of Pharmacy",
        academic_year: 2026,
        currency: "USD",
        audience: ["foreign"],
      },
    },
  ];

  const { store, tmpFile, seed } = buildTempStore(records);
  await seed();

  const results = await knowledgeService.searchKnowledge("pharmacy local fees 2026", {
    embedFn: () => [0, 0, 0],
    store,
    entities: {
      programme: "pharmacy",
      academic_year: 2026,
      audience: "local",
      currency: "ZMW",
      topic: "fees",
    },
    topK: 8,
    minScore: 1,
    expandNeighbors: false,
  });

  assert.equal(results.length, 3);
  assert.ok(results.every((result) => result.currency === "ZMW"));
  assert.ok(results.every((result) => !result.retrieval.conflictingEntities.length));
  fs.rmSync(tmpFile, { force: true });
});

test("fee scope suppresses accommodation when enough programme-tuition evidence exists", async () => {
  const records = [
    ...[1, 2, 3].map((n) => ({
      id: `tuition-${n}`,
      text: `Bachelor of Pharmacy local tuition fee section ${n}.`,
      embedding: [0, 0, 0],
      metadata: {
        source_file: `BACHELOR-OF-PHARMACY-ZMW-FEES-${n}.pdf`,
        document_type: "fee_schedule",
        title: "Pharmacy Fees",
        programme: "Bachelor of Pharmacy",
        academic_year: 2026,
        currency: "ZMW",
        audience: ["local", "SADC"],
        fee_scope: "programme_tuition",
      },
    })),
    {
      id: "accommodation",
      text: "Accommodation fees are charged per room per semester.",
      embedding: [0, 0, 0],
      metadata: {
        source_file: "ACCOMMODATION-FEES-REVISED-2026.pdf",
        document_type: "fee_schedule",
        title: "Accommodation Fees",
        academic_year: 2026,
        currency: "ZMW",
        audience: ["local", "foreign"],
        fee_scope: "accommodation",
      },
    },
  ];

  const { store, tmpFile, seed } = buildTempStore(records);
  await seed();

  const results = await knowledgeService.searchKnowledge("pharmacy local fees 2026", {
    embedFn: () => [0, 0, 0],
    store,
    entities: {
      programme: "pharmacy",
      academic_year: 2026,
      audience: "local",
      currency: "ZMW",
      topic: "fees",
      fee_scope: "programme_tuition",
    },
    topK: 8,
    minScore: 1,
    expandNeighbors: false,
  });

  assert.equal(results.length, 3);
  assert.ok(results.every((result) => result.fee_scope === "programme_tuition"));
  assert.ok(results.every((result) => result.id !== "accommodation"));
  fs.rmSync(tmpFile, { force: true });
});

test("evidence sufficiency trims weaker generic candidates once several candidates match all strong entities", () => {
  const candidates = [
    ...[1, 2, 3, 4].map((n) => ({
      id: `aligned-${n}`,
      matchedEntities: ["programme", "academic_year", "audience", "currency", "fee_scope"],
      conflictingEntities: [],
    })),
    {
      id: "generic-prospectus",
      matchedEntities: ["academic_year", "audience"],
      conflictingEntities: [],
    },
  ];

  const selected = knowledgeService.selectSufficientEvidence(candidates, {
    programme: "pharmacy",
    academic_year: 2026,
    audience: "local",
    currency: "ZMW",
    fee_scope: "programme_tuition",
  });

  assert.deepEqual(selected.map((item) => item.id), ["aligned-1", "aligned-2", "aligned-3", "aligned-4"]);
});
