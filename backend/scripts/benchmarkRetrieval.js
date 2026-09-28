#!/usr/bin/env node
/**
 * Live retrieval benchmark using the configured query planner + hybrid search.
 * This checks whether naturally phrased student questions retrieve an expected
 * source/topic. It does NOT ask the final answer model, so failures point to
 * query understanding/retrieval rather than answer generation.
 */

require("dotenv").config();

const queryUnderstandingService = require("../services/queryUnderstandingService");
const knowledgeService = require("../services/knowledgeService");

const CASES = [
  {
    name: "Local Pharmacy fees",
    question: "I'm doing pharmacy and I'm local, how much am I supposed to pay this year?",
    expect: /BACHELOR-OF-PHARMACY-ZMW/i,
  },
  {
    name: "Accommodation fees",
    question: "How much are the hostels this year?",
    expect: /accommod|accomod/i,
  },
  {
    name: "Deferment",
    question: "I need to stop school for a semester but I don't want to withdraw completely. What can I do?",
    expect: /defer/i,
  },
  {
    name: "Application documents",
    question: "What papers do I need when applying to UNILUS?",
    expect: /apply-online|documents required|certified academic|passport|NRC/i,
  },
  {
    name: "Programme change",
    question: "I've already registered but I want to switch my programme. What do I do?",
    expect: /changes during course of study|change of programme/i,
  },
  {
    name: "Failed courses / progression",
    question: "I failed two courses. Can I still go to the next semester?",
    expect: /repeat semester|failed two courses|proceeding to the next semester/i,
  },
];

function searchable(result) {
  return [
    result.source_file,
    result.url,
    result.title,
    result.retrieval_title,
    result.section,
    result.text,
  ].filter(Boolean).join(" ");
}

async function main() {
  let passed = 0;

  for (const scenario of CASES) {
    const plan = await queryUnderstandingService.planQuery(scenario.question);
    const results = await knowledgeService.searchKnowledge(scenario.question, {
      searchQueries: plan.searchQueries,
      entities: plan.entities,
      topK: 5,
    });

    const hitIndex = results.findIndex((result) => scenario.expect.test(searchable(result)));
    const ok = hitIndex !== -1;
    if (ok) passed += 1;

    console.log(`\n${ok ? "PASS" : "FAIL"} — ${scenario.name}`);
    console.log(`Q: ${scenario.question}`);
    console.log(`Planner: ${plan.usedPlanner ? "used" : "fallback"} | intent: ${plan.intent || "n/a"}`);
    console.log(`Entities: ${JSON.stringify(plan.entities)}`);
    if (results[0]) {
      console.log(`Top result: ${results[0].retrieval_title || results[0].title || results[0].source_file || results[0].url}`);
      console.log(`Top source: ${results[0].source_file || results[0].url || "unknown"}`);
    } else {
      console.log("Top result: none");
    }
    if (ok) console.log(`Expected evidence found at rank ${hitIndex + 1}.`);
  }

  console.log(`\nRetrieval benchmark: ${passed}/${CASES.length} passed.`);
  if (passed !== CASES.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
