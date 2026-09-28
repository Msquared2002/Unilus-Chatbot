const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const widgetDir = path.resolve(__dirname, "../../dummy environment/chatbot-widget");
const presentation = JSON.parse(fs.readFileSync(path.join(widgetDir, "campus-data/presentation.json"), "utf8"));
const places = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../data/campus/campus_places.json"), "utf8")).places;

test("presentation data is keyed by all canonical IDs and contains no duplicate geography", () => {
  const canonical = places.map((place) => place.id).sort();
  assert.deepEqual(Object.keys(presentation.silverest.places).sort(), canonical);
  assert.equal(presentation.silverest.boundary, undefined);
  for (const value of Object.values(presentation.silverest.places)) {
    assert.equal(value.coordinates, undefined);
    assert.equal(value.name, undefined);
    assert.equal(value.geometry, undefined);
  }
});

test("frontend GPS bounds helper accepts campus center and rejects distant point", () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(widgetDir, "campus-location.js"), "utf8"), context);
  const ring = [[-15.353432, 28.4668484], [-15.3529952, 28.4711082],
    [-15.3565752, 28.4714092], [-15.357015, 28.467119], [-15.353432, 28.4668484]];
  assert.equal(context.window.CampusLocation.insideBoundary({ lat: -15.3550065, lng: 28.4691214 }, ring), true);
  assert.equal(context.window.CampusLocation.insideBoundary({ lat: -15.3, lng: 28.4 }, ring), false);
});

test("map data client adapts refreshed API places without a local coordinate copy", async () => {
  const boundary = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../data/campus/campus_boundary.json"), "utf8"));
  const fetch = async (url) => ({ ok: true, json: async () =>
    url.endsWith("/places") ? places : url.endsWith("/boundary") ? boundary : presentation });
  const context = { window: {}, fetch };
  vm.runInNewContext(fs.readFileSync(path.join(widgetDir, "campus-data-client.js"), "utf8"), context);
  const result = await context.window.CampusDataClient.load();
  assert.equal(result.silverest.buildings.length, 23);
  assert.equal(result.silverest.boundary.length, boundary.geometry.coordinates[0].length);
  assert.deepEqual(new Set(result.silverest.buildings.map((p) => p.id)), new Set(places.map((p) => p.id)));
});
