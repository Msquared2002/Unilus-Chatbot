const test = require("node:test");
const assert = require("node:assert/strict");

const { searchRecords, tokenize } = require("../services/lexicalSearchService");

test("tokenizer keeps course codes and normalizes simple plurals", () => {
  const tokens = tokenize("What are the BIT402 fees and requirements?");
  assert.ok(tokens.includes("bit402"));
  assert.ok(tokens.includes("fee"));
  assert.ok(tokens.includes("requirement"));
});

test("lexical search can match programme metadata even when the chunk body omits the programme", () => {
  const records = [
    {
      id: "pharmacy-payment",
      text: "Part payment will only be accepted upon 50% down payment on tuition fees.",
      metadata: {
        source_file: "BACHELOR-OF-PHARMACY-ZMW-UNILUS-2026.pdf",
        document_type: "fee_schedule",
        title: "UNIVERSITY OF LUSAKA",
      },
    },
    {
      id: "library",
      text: "The library provides study spaces.",
      metadata: { source_file: "handbook.pdf", document_type: "handbook", title: "Library" },
    },
  ];

  const results = searchRecords("pharmacy payment fees", records, { topK: 5 });
  assert.equal(results[0].id, "pharmacy-payment");
  assert.ok(results[0].matchedTerms.includes("pharmacy"));
});
