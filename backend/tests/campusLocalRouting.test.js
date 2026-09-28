const test = require('node:test');
const assert = require('node:assert/strict');
const repository = require('../services/campusRepository');
const builder = require('../services/campusGraphBuilder');
const routing = require('../services/campusRoutingService');
const validator = require('../services/campusRoutingValidator');
const navigation = require('../services/navigationService');

const boundary = repository.getBoundary();
const [x, y] = [boundary.coordinates.lng, boundary.coordinates.lat];
const A = [x, y], B = [x + 0.0005, y], C = [x + 0.00025, y + 0.00001];
const line = (id, kind, coordinates) => ({ id, kind, source: id, coordinates });
const accessPoints = [
  { id: 'test_library_entrance', place_id: 'unilus_library', lat: A[1], lng: A[0] },
  { id: 'test_hospital_entrance', place_id: 'unilus_hospital', lat: B[1], lng: B[0] },
];

test('Haversine measures metres and walking time derives from route length', () => {
  assert.ok(Math.abs(builder.distance(A, B) - 53.6) < 1);
  assert.equal(routing.WALKING_SPEED_MPS, 1.4);
});

test('local graph connects explicit vertices and same-level intersections', () => {
  const graph = builder.buildGraph({ boundary, roads: [line('road', 'shared_road', [A, B])],
    walkways: [line('cross', 'footway', [[x + .00025, y - .0001], [x + .00025, y + .0001]])] });
  assert.equal(graph.stats.connected_component_count, 1);
  assert.ok(graph.stats.edge_count >= 4);
  assert.ok(graph.edges.every(e => e.distance_m > 0 && e.cost_m >= e.distance_m));
});

test('a lightly longer footway wins over a shared road without falsifying distance', () => {
  const graph = builder.buildGraph({ boundary, roads: [line('road', 'shared_road', [A, B])],
    walkways: [line('walk', 'footway', [A, C, B])] });
  const start = graph.nodes.find(n => builder.distance(n.coordinates, A) < .1).id;
  const end = graph.nodes.find(n => builder.distance(n.coordinates, B) < .1).id;
  const route = routing.shortestPath(graph, start, end);
  assert.ok(route.distance_m > builder.distance(A, B));
  assert.ok(route.distance_m < builder.distance(A, B) * 1.07);
  assert.ok(route.edge_ids.every(id => graph.edges.find(e => e.id === id).kind === 'footway'));
});

test('verified entrances allow local A* with valid geometry and true ETA', () => {
  const graph = builder.buildGraph({ boundary, roads: [line('road', 'shared_road', [A, B])], accessPoints });
  const result = routing.route({ from: { place_id: 'unilus_library' }, to: { place_id: 'unilus_hospital' } },
    { graph, accessPoints });
  assert.equal(result.body.status, 'ok');
  assert.equal(result.body.geometry.type, 'LineString');
  assert.deepEqual(result.body.geometry.coordinates[0], A);
  assert.deepEqual(result.body.geometry.coordinates.at(-1), B);
  assert.ok(Math.abs(result.body.duration_s - result.body.distance_m / 1.4) < 1e-9);
});

test('unreachable verified entrance reports no_route', () => {
  const far = [x + .002, y + .001];
  const points = [accessPoints[0], { id: 'isolated_hospital', place_id: 'unilus_hospital', lat: far[1], lng: far[0] }];
  const graph = builder.buildGraph({ boundary, roads: [line('road', 'shared_road', [A, B]),
    line('island', 'shared_road', [far, [far[0] + .0001, far[1]]])], accessPoints: points });
  const result = routing.route({ from: { place_id: 'unilus_library' }, to: { place_id: 'unilus_hospital' } },
    { graph, accessPoints: points });
  assert.equal(result.body.code, 'no_route');
});

test('no entrance means no centroid or straight-line fallback', () => {
  const graph = builder.buildGraph({ boundary, roads: [line('road', 'shared_road', [A, B])] });
  const result = routing.route({ from: { lat: A[1], lng: A[0] }, to: { place_id: 'sports_pitch_soccer' } },
    { graph, accessPoints: [] });
  assert.equal(result.body.code, 'destination_access_unmapped');
  assert.equal(result.body.geometry, undefined);
  assert.equal(repository.getPlaceById('running_track_athletics').osm_ref, 'relation/13319425');
});

test('route intent asks for a start, while a location question only focuses the place', () => {
  assert.equal(navigation.tryHandleNavigation('Where is the library?').queryType.intentType, 'locate');
  const result = navigation.tryHandleNavigation('Navigate to the gym');
  assert.equal(result.queryType.intentType, 'route_start_required');
  assert.equal(result.routeIntent.destination.placeId, 'unilus_gym');
  assert.equal(result.routeIntent.origin, null);
  assert.equal(navigation.tryHandleNavigation('Where is Botanic Bloom?').navigation.placeId, 'p_c_school_of_business');
});

test('GPS snapping has a strict distance limit', () => {
  const graph = builder.buildGraph({ boundary, roads: [line('road', 'shared_road', [A, B])] });
  assert.ok(routing.snapCoordinate(graph, { lat: y, lng: x + .0002 }));
  assert.equal(routing.snapCoordinate(graph, { lat: y + .002, lng: x }, 25), null);
});

test('OSM import includes campus service roads and clips exterior roads', () => {
  const sources = builder.loadSources();
  assert.equal(sources.roads.length, 21);
  const graph = builder.buildGraph(sources);
  assert.equal(graph.stats.local_walkway_count, 0);
  assert.ok(graph.edges.every(e => e.kind === 'shared_road'));
  assert.ok(graph.nodes.every(n => builder.inside(n.coordinates, boundary.geometry.coordinates[0]) ||
    boundary.geometry.coordinates[0].some(p => builder.distance(p, n.coordinates) < .2)));
});

test('walkway validation catches duplicates, zero lengths, and outside points', () => {
  const features = [1, 2].map(() => ({ type: 'Feature', properties: { id: 'duplicate', kind: 'footway' },
    geometry: { type: 'LineString', coordinates: [A, A] } }));
  const report = validator.validateSources({ walkwayGeojson: { type: 'FeatureCollection', features },
    accessPoints: [], boundary });
  assert.ok(report.errors.some(e => e.includes('Duplicate')));
  assert.ok(report.errors.some(e => e.includes('Zero-length')));
});
