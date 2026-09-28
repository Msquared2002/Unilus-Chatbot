const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const data = path.resolve(__dirname, "../data/campus");
const read = (name) => JSON.parse(fs.readFileSync(path.join(data, name), "utf8"));
const boundary = read("campus_boundary.json");
const places = read("campus_places.json").places;
const geometry = read("campus_buildings.json").buildings;
const index = read("campus_search_index.json");
const catalog = read("campus_place_catalog.json").places;

function onSegment([x, y], [ax, ay], [bx, by]) {
  const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
  return Math.abs(cross) < 1e-10 && x >= Math.min(ax, bx) - 1e-10 && x <= Math.max(ax, bx) + 1e-10 &&
    y >= Math.min(ay, by) - 1e-10 && y <= Math.max(ay, by) + 1e-10;
}

function contains(point, ring) {
  let inside = false;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i + 1];
    if (onSegment(point, a, b)) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function rings(shape) {
  if (shape.type === "Point") return [];
  assert.ok(["Polygon", "MultiPolygon"].includes(shape.type));
  return shape.type === "Polygon" ? shape.coordinates : shape.coordinates.flat();
}

test("OSM import preserves canonical IDs and resolves every catalog reference", () => {
  assert.equal(places.length, 23);
  assert.deepEqual(new Set(places.map((p) => p.id)), new Set(catalog.map((p) => p.id)));
  assert.equal(new Set(places.map((p) => p.osm_ref)).size, places.length);
  assert.equal(places.find((p) => p.id === "unilus_gym").osm_ref, "way/1562747667");
});

test("all imported physical geometry lies inside the OSM campus boundary", () => {
  const campus = boundary.geometry.coordinates[0];
  assert.equal(boundary.osm_ref, "way/1558103619");
  assert.equal(geometry.length, 37);
  assert.equal(new Set(geometry.map((item) => item.osm_ref)).size, geometry.length);
  for (const item of [...geometry, ...places]) {
    assert.ok(Number.isFinite(item.coordinates.lat) && Number.isFinite(item.coordinates.lng), item.id);
    if (item.geometry.type === "Point") {
      assert.ok(contains(item.geometry.coordinates, campus), `${item.id}: outside campus`);
      continue;
    }
    for (const ring of rings(item.geometry)) {
      assert.ok(ring.length >= 4 && JSON.stringify(ring[0]) === JSON.stringify(ring.at(-1)), item.id);
      for (const coordinate of ring) assert.ok(contains(coordinate, campus), `${item.id}: outside campus`);
    }
  }
});

test("search index references only canonical OSM objects", () => {
  const refs = new Set(places.map((p) => p.osm_ref));
  for (const ref of Object.values(index.search_index)) assert.ok(refs.has(ref), ref);
  for (const [ref, id] of Object.entries(index.place_id_lookup)) {
    assert.ok(refs.has(ref));
    assert.equal(places.find((p) => p.osm_ref === ref).id, id);
  }
  assert.equal(Object.keys(index.place_id_lookup).length, places.length);
});
