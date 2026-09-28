const test = require("node:test");
const assert = require("node:assert/strict");
const { dedupeAcrossPages } = require("../services/documentIngestion/website/dedupe");

function block(text, type = "paragraph") {
  return { type, text };
}

test("removes a nav menu block repeated across 3+ pages", () => {
  const nav = block("Home | Programmes | Admissions | Contact", "list");

  const pagesBlocks = {
    "/a": [nav, block("This page is about admissions specifically.")],
    "/b": [nav, block("This page is about fees specifically.")],
    "/c": [nav, block("This page is about careers specifically.")],
  };

  const { cleaned, boilerplateCount } = dedupeAcrossPages(pagesBlocks);

  assert.equal(boilerplateCount, 1);
  for (const url of Object.keys(cleaned)) {
    assert.ok(!cleaned[url].some((b) => b.text === nav.text), `nav should be removed from ${url}`);
  }
  // Real content must survive.
  assert.ok(cleaned["/a"].some((b) => b.text.includes("admissions specifically")));
});

test("does not remove text that only appears on 1-2 pages", () => {
  const sharedButRare = block("This specific paragraph happens to appear on two pages.");

  const pagesBlocks = {
    "/a": [sharedButRare, block("Unique content A")],
    "/b": [sharedButRare, block("Unique content B")],
    "/c": [block("Completely different content C")],
  };

  const { cleaned, boilerplateCount } = dedupeAcrossPages(pagesBlocks);
  assert.equal(boilerplateCount, 0);
  assert.ok(cleaned["/a"].some((b) => b.text === sharedButRare.text));
});

test("counts each distinct page only once even if a block repeats within the same page", () => {
  const footer = block("Copyright UNILUS 2026");

  const pagesBlocks = {
    "/a": [footer, footer], // appears twice on the SAME page (e.g. top and bottom)
    "/b": [footer],
    "/c": [block("Unrelated")],
  };

  // Only 2 distinct pages contain it — below the default threshold of 3.
  const { boilerplateCount } = dedupeAcrossPages(pagesBlocks);
  assert.equal(boilerplateCount, 0);
});

test("respects a custom minPages threshold", () => {
  const footer = block("Copyright UNILUS 2026");
  const pagesBlocks = {
    "/a": [footer],
    "/b": [footer],
  };

  const { boilerplateCount: withDefault } = dedupeAcrossPages(pagesBlocks);
  assert.equal(withDefault, 0);

  const { boilerplateCount: withLowerThreshold } = dedupeAcrossPages(pagesBlocks, 2);
  assert.equal(withLowerThreshold, 1);
});

test("is case- and whitespace-insensitive when comparing blocks", () => {
  const pagesBlocks = {
    "/a": [block("Home  |  Programmes")],
    "/b": [block("home | programmes")],
    "/c": [block("HOME | PROGRAMMES")],
  };
  const { boilerplateCount } = dedupeAcrossPages(pagesBlocks);
  assert.equal(boilerplateCount, 1);
});
