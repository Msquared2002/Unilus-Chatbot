const test = require("node:test");
const assert = require("node:assert/strict");
const { findResources, getByTopic } = require("../services/resourceService");

test("finds the password reset resource from natural phrasing", () => {
  const results = findResources("I forgot my password, how do I reset it?");
  assert.ok(results.length > 0);
  assert.equal(results[0].topic, "password_reset");
  assert.equal(results[0].url, "https://portal.unilus.ac.zm/password/recover");
});

test("finds the plagiarism checker resource", () => {
  const results = findResources("how do I submit my assignment through the plagiarism checker");
  assert.ok(results.some((r) => r.topic === "plagiarism_checker"));
});

test("finds the apply online resource for an application intent", () => {
  const results = findResources("I want to apply online for a programme");
  assert.ok(results.some((r) => r.topic === "apply_online" || r.topic === "application_guide"));
});

test("returns an empty array for a query with no resource match", () => {
  const results = findResources("what is the capital of Zambia");
  assert.deepEqual(results, []);
});

test("returns an empty array for an empty query instead of throwing", () => {
  assert.deepEqual(findResources(""), []);
  assert.deepEqual(findResources(null), []);
});

test("getByTopic returns a single resource by exact topic key", () => {
  const resource = getByTopic("accommodation");
  assert.ok(resource);
  assert.equal(resource.url, "https://web.unilus.ac.zm/accomodation/");
});

test("getByTopic returns null for an unknown topic", () => {
  assert.equal(getByTopic("not_a_real_topic"), null);
});

test("results are ranked by number of matched keywords", () => {
  // "boarding house" query should score the dedicated boarding_houses
  // resource above anything with only an incidental single-word hit.
  const results = findResources("where can I find information about boarding houses");
  assert.equal(results[0].topic, "boarding_houses");
});
