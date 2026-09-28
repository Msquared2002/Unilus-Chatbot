const fs = require('node:fs');
const path = require('node:path');
const repository = require('./campusRepository');
const { projectOnSegment, distance, inside } = require('./campusGraphBuilder');
const DATA = path.resolve(__dirname, '../data/campus');
const WALKING_SPEED_MPS = Number(process.env.CAMPUS_WALKING_SPEED_MPS) > 0 ? Number(process.env.CAMPUS_WALKING_SPEED_MPS) : 1.4;
const GPS_SNAP_LIMIT_M = 25;
const fail = (code, message, statusCode = 422) => ({ statusCode, body: { status: code, code, message } });

function insideCampus({ lat, lng }) {
  const ring = repository.getBoundary()?.geometry?.coordinates?.[0];
  return Boolean(ring && inside([lng, lat], ring));
}
function loadGraph() {
  const file = path.join(DATA, 'campus_routing_graph.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}
function loadAccessPoints() {
  return JSON.parse(fs.readFileSync(path.join(DATA, 'campus_access_points.json'), 'utf8')).access_points;
}
function endpoint(value) {
  if (value?.place_id || value?.placeId) return { type: 'place', placeId: value.place_id || value.placeId };
  if (value?.type === 'coordinates' || (value && 'lat' in value && 'lng' in value))
    return { type: 'coordinates', lat: Number(value.lat), lng: Number(value.lng) };
  return null;
}

function shortestPath(graph, startId, endId, extraEdges = []) {
  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  const adjacency = new Map(graph.nodes.map(n => [n.id, []]));
  for (const edge of [...graph.edges, ...extraEdges]) {
    adjacency.get(edge.from)?.push({ edge, next: edge.to });
    adjacency.get(edge.to)?.push({ edge, next: edge.from });
  }
  const open = new Set([startId]), costs = new Map([[startId, 0]]), previous = new Map();
  while (open.size) {
    let current, best = Infinity;
    for (const id of open) {
      const estimate = costs.get(id) + distance(nodes.get(id).coordinates, nodes.get(endId).coordinates);
      if (estimate < best) { best = estimate; current = id; }
    }
    if (current === endId) {
      const nodeIds = [current], edgeIds = [], usedEdges = [];
      while (previous.has(current)) {
        const step = previous.get(current); edgeIds.push(step.edge.id); usedEdges.push(step.edge);
        current = step.from; nodeIds.push(current);
      }
      nodeIds.reverse(); edgeIds.reverse();
      return { node_ids: nodeIds, edge_ids: edgeIds, cost_m: costs.get(endId),
        distance_m: usedEdges.reduce((sum, e) => sum + e.distance_m, 0),
        coordinates: nodeIds.map(id => nodes.get(id).coordinates) };
    }
    open.delete(current);
    for (const { edge, next } of adjacency.get(current) || []) {
      const nextCost = costs.get(current) + edge.cost_m;
      if (nextCost < (costs.get(next) ?? Infinity)) {
        costs.set(next, nextCost); previous.set(next, { from: current, edge }); open.add(next);
      }
    }
  }
  return null;
}

function snapCoordinate(graph, start, limit = GPS_SNAP_LIMIT_M) {
  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  let best;
  for (const edge of graph.edges) {
    const candidate = projectOnSegment([start.lng, start.lat], nodes.get(edge.from).coordinates, nodes.get(edge.to).coordinates);
    if (!best || candidate.distance_m < best.distance_m) best = { ...candidate, edge };
  }
  if (!best || best.distance_m > limit) return null;
  const node = { id: 'gps_start', coordinates: best.p };
  const edges = [best.edge.from, best.edge.to].map((to, i) => {
    const length = distance(best.p, nodes.get(to).coordinates);
    return { id: `gps_edge_${i}`, from: node.id, to, distance_m: length,
      cost_m: length * best.edge.cost_m / best.edge.distance_m };
  });
  return { node, edges, snap_distance_m: best.distance_m };
}

function route(payload = {}, options = {}) {
  const legacy = Boolean(payload.origin || payload.destination);
  const from = endpoint(payload.from || payload.origin), to = endpoint(payload.to || payload.destination);
  if (!from || !to || to.type !== 'place') return fail(legacy ? 'INVALID_REQUEST' : 'invalid_request', 'Start and destination are required.', 400);
  const target = repository.getPlaceById(to.placeId);
  if (!target) return fail(legacy ? 'DESTINATION_NOT_FOUND' : 'unknown_place', 'Destination place was not found.', 404);
  if (from.type === 'place' && !repository.getPlaceById(from.placeId))
    return fail(legacy ? 'ORIGIN_NOT_FOUND' : 'unknown_place', 'Start place was not found.', 404);
  if (from.type === 'coordinates') {
    if (!Number.isFinite(from.lat) || !Number.isFinite(from.lng)) return fail('invalid_request', 'Valid coordinates are required.', 400);
    if (!insideCampus(from)) return fail(legacy ? 'ORIGIN_OUTSIDE_CAMPUS' : 'outside_routing_area', 'Start is outside Silverest Campus.');
  }
  const graph = options.graph || loadGraph();
  if (!graph?.nodes?.length || !graph?.edges?.length) return fail('routing_graph_unavailable', 'Local routing graph unavailable.', 503);
  const accessPoints = options.accessPoints || loadAccessPoints();
  const destinations = accessPoints.filter(a => a.place_id === target.id && graph.access_points?.[a.id]?.connected);
  if (!destinations.length) return legacy
    ? { statusCode: 503, body: { status: 'unavailable', campus: 'silverest', code: 'PEDESTRIAN_NETWORK_REQUIRED',
      message: 'A verified Silverest pedestrian path network is required before walking routes can be calculated.' } }
    : fail('destination_access_unmapped', `A verified entrance for ${target.name} has not been mapped.`);
  let starts, snap;
  if (from.type === 'place') {
    starts = accessPoints.filter(a => a.place_id === from.placeId && graph.access_points?.[a.id]?.connected)
      .map(a => ({ access: a, node_id: graph.access_points[a.id].node_id }));
    if (!starts.length) return fail('start_access_unmapped', 'The start place has no verified entrance.');
  } else {
    snap = snapCoordinate(graph, from);
    if (!snap) return fail('outside_routing_area', 'Start is too far from the mapped network.');
    starts = [{ access: null, node_id: snap.node.id }];
  }
  const workingGraph = snap ? { ...graph, nodes: [...graph.nodes, snap.node] } : graph;
  let best;
  for (const start of starts) for (const destination of destinations) {
    const result = shortestPath(workingGraph, start.node_id, graph.access_points[destination.id].node_id, snap?.edges || []);
    if (!result) continue;
    const startOffset = start.access ? distance([start.access.lng, start.access.lat], result.coordinates[0]) : 0;
    const endOffset = distance(result.coordinates.at(-1), [destination.lng, destination.lat]);
    const total = result.distance_m + startOffset + endOffset;
    if (!best || result.cost_m + startOffset + endOffset < best.cost_m) {
      const coords = [...result.coordinates];
      if (startOffset > 0.05) coords.unshift([start.access.lng, start.access.lat]);
      if (endOffset > 0.05) coords.push([destination.lng, destination.lat]);
      best = { ...result, coordinates: coords, distance_m: total, cost_m: result.cost_m + startOffset + endOffset,
        start_access: start.access?.id || null, destination_access: destination.id };
    }
  }
  if (!best) return fail('no_route', 'No connected route exists between these access points.');
  return { statusCode: 200, body: { status: 'ok', from, to: { place_id: target.id, access_point_id: best.destination_access },
    distance_m: best.distance_m, duration_s: best.distance_m / WALKING_SPEED_MPS,
    geometry: { type: 'LineString', coordinates: best.coordinates }, node_ids: best.node_ids, edge_ids: best.edge_ids,
    start_access_point_id: best.start_access, gps_snap_distance_m: snap?.snap_distance_m ?? null } };
}
module.exports = { route, insideCampus, shortestPath, snapCoordinate, WALKING_SPEED_MPS, GPS_SNAP_LIMIT_M };
