#!/usr/bin/env node
/**
 * Inspect retrieval without asking the final answer model.
 *
 * Usage:
 *   npm run retrieval:inspect -- "I'm a local pharmacy student; what do I pay this year?"
 */

require("dotenv").config();

const queryUnderstandingService = require("../services/queryUnderstandingService");
const knowledgeService = require("../services/knowledgeService");

async function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.error('Usage: npm run retrieval:inspect -- "your natural-language question"');
    process.exit(1);
  }

  const plan = await queryUnderstandingService.planQuery(query);
  const results = await knowledgeService.searchKnowledge(query, {
    searchQueries: plan.searchQueries,
    entities: plan.entities,
    topK: 8,
  });

  console.log("\n=== QUERY PLAN ===");
  console.log(JSON.stringify(plan, null, 2));

  console.log("\n=== RETRIEVAL RESULTS ===");
  if (!results.length) {
    console.log("No sufficiently supported candidates were found.");
    return;
  }

  results.forEach((result, index) => {
    console.log(`\n#${index + 1} ${result.retrieval_title || result.title || result.source_file}`);
    console.log(`source: ${result.source_file || result.url || "unknown"}`);
    if (result.page_number) console.log(`page: ${result.page_number}`);
    if (result.programme) console.log(`programme: ${result.programme}`);
    if (result.academic_year) console.log(`year: ${result.academic_year}`);
    if (result.currency) console.log(`currency: ${result.currency}`);
    if (result.audience?.length) console.log(`audience: ${result.audience.join(", ")}`);
    if (result.fee_scope) console.log(`fee scope: ${result.fee_scope}`);
    console.log(`hybrid score: ${result.score.toFixed(4)}`);
    console.log(`dense score: ${result.retrieval.denseScore == null ? "n/a" : result.retrieval.denseScore.toFixed(4)}`);
    console.log(`lexical score: ${result.retrieval.lexicalScore.toFixed(4)}`);
    console.log(`matched terms: ${result.retrieval.matchedTerms.join(", ") || "none"}`);
    console.log(`matched entities: ${result.retrieval.matchedEntities.join(", ") || "none"}`);
    console.log(`conflicting entities: ${result.retrieval.conflictingEntities.join(", ") || "none"}`);
    console.log(`snippet: ${result.text.replace(/\s+/g, " ").slice(0, 320)}${result.text.length > 320 ? "…" : ""}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
