const test = require('node:test');
const assert = require('node:assert/strict');
const { buildGraph, loadSources } = require('../services/campusGraphBuilder');
const { route } = require('../services/campusRoutingService');

const boundary = { geometry: { coordinates: [[
  [28.46, -15.36], [28.48, -15.36], [28.48, -15.35], [28.46, -15.35], [28.46, -15.36],
]] } };
const A = [28.468, -15.355], B = [28.469, -15.355], C = [28.470, -15.355];
function way(id, kind, coordinates, node_ids, osm_tags = {}) {
  return { id, kind, coordinates, node_ids, osm_tags, source: `way/${id}`, provenance: `osm:${kind}` };
}
const access = (id, place_id, point, entrance = 'main') => ({ id, place_id, lng: point[0], lat: point[1],
  osm_node_id: id, entrance, primary: true });

test('imports footway, path, pedestrian, steps and preserves edge provenance', () => {
  for (const kind of ['footway', 'path', 'pedestrian', 'steps']) {
    const g = buildGraph({ boundary, walkways: [way('1', kind, [A, B], ['a', 'b'])] });
    assert.equal(g.edges.length, 1);
    assert.equal(g.edges[0].provenance, `osm:${kind}`);
    assert.equal(g.edges[0].kind, kind);
  }
});

test('shared OSM nodes connect and a crossing without shared nodes does not', () => {
  const joined = buildGraph({ boundary, walkways: [way('1', 'footway', [A, B], ['a', 'b']),
    way('2', 'path', [B, C], ['b', 'c'])] });
  assert.equal(joined.stats.connected_component_count, 1);
  const crossed = buildGraph({ boundary, walkways: [way('1', 'footway', [A, C], ['a', 'c']),
    way('2', 'path', [[28.469, -15.354], [28.469, -15.356]], ['d', 'e'])] });
  assert.equal(crossed.stats.connected_component_count, 2);
});

test('bridge crossing stays separate from a ground path', () => {
  const g = buildGraph({ boundary, walkways: [way('1', 'footway', [A, C], ['a', 'c']),
    way('2', 'path', [[28.469, -15.354], [28.469, -15.356]], ['d', 'e'], { bridge: 'yes', layer: '1' })] });
  assert.equal(g.stats.connected_component_count, 2);
});

test('OSM entrance needs a mapped routing node; no centroid fallback', () => {
  const g = buildGraph({ boundary, walkways: [way('1', 'footway', [A, B], ['a', 'b'])],
    accessPoints: [access('b', 'library', B), access('missing', 'hospital', C)] });
  assert.equal(g.access_points.b.connected, true);
  assert.equal(g.access_points.b.place_id, 'library');
  assert.equal(g.access_points.b.entrance, 'main');
  assert.equal(g.access_points.missing.connected, false);
});

test('local route runs from one mapped entrance through OSM footways to another', () => {
  const first = access('a', 'unilus_library', A);
  const last = access('c', 'unilus_hospital', C);
  const g = buildGraph({ boundary, walkways: [way('1', 'footway', [A, B], ['a', 'b']),
    way('2', 'path', [B, C], ['b', 'c'])], accessPoints: [first, last] });
  const result = route({ from: { place_id: first.place_id }, to: { place_id: last.place_id } },
    { graph: g, accessPoints: [first, last] });
  assert.equal(result.statusCode, 200);
  assert.ok(result.body.distance_m > 0);
  assert.equal(result.body.to.access_point_id, 'c');
});

test('a connected main entrance is preferred over a closer entrance=yes', () => {
  const first = access('a', 'unilus_library', A);
  const secondary = access('b', 'unilus_hospital', B, 'yes');
  const main = access('c', 'unilus_hospital', C, 'main');
  const points = [first, secondary, main];
  const g = buildGraph({ boundary, walkways: [way('1', 'footway', [A, B, C], ['a', 'b', 'c'])],
    accessPoints: points });
  const result = route({ from: { place_id: first.place_id }, to: { place_id: main.place_id } },
    { graph: g, accessPoints: points });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.to.access_point_id, 'c');
});

test('duplicate local walkway does not duplicate an OSM path', () => {
  const g = buildGraph({ boundary, walkways: [way('1', 'footway', [A, B], ['a', 'b']),
    { id: 'local', kind: 'footway', coordinates: [A, B] }] });
  assert.equal(g.edges.length, 1);
});

test('foot prohibited OSM path is excluded from routing', () => {
  const blocked = { ...way('1', 'footway', [A, B], ['a', 'b']), pedestrian_allowed: false };
  const g = buildGraph({ boundary, walkways: [blocked] });
  assert.equal(g.edges.length, 0);
});

test('existing Silverest service-road graph remains valid without mapped paths', () => {
  const g = buildGraph(loadSources());
  assert.equal(g.stats.source_shared_road_count, 21);
  assert.equal(g.stats.node_count, 114);
  assert.equal(g.stats.edge_count, 127);
  assert.equal(g.stats.connected_component_count, 1);
  assert.equal(g.stats.osm_pedestrian_way_count, 0);
});
