const fs = require('node:fs');
const path = require('node:path');
const { distanceMeters } = require('./campusRepository');

/*
Changes: Builds campus graph edges from approved path geometry and access points.
Affects: campus_routing_graph.json consumed by campusRoutingService.js.
Purpose: Keeps geometry validation and graph construction consistent with the local walking network.
*/

const DATA = path.resolve(__dirname, '../data/campus');
const METRES_PER_DEGREE = 111195;
const point = ([lng, lat]) => ({ lat, lng });
const coordinate = ({ lat, lng }) => [lng, lat];
const distance = (a, b) => distanceMeters(point(a), point(b));

function inside(p, ring) {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) result = !result;
  }
  return result;
}

function cross(a, b) { return a[0] * b[1] - a[1] * b[0]; }
function subtract(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
function intersection(a, b, c, d) {
  const r = subtract(b, a), s = subtract(d, c), denominator = cross(r, s);
  if (Math.abs(denominator) < 1e-15) return null;
  const t = cross(subtract(c, a), s) / denominator;
  const u = cross(subtract(c, a), r) / denominator;
  if (t < -1e-10 || t > 1 + 1e-10 || u < -1e-10 || u > 1 + 1e-10) return null;
  return { t, u, p: [a[0] + t * r[0], a[1] + t * r[1]] };
}

function clipSegment(a, b, ring) {
  const cuts = [{ t: 0, p: a }, { t: 1, p: b }];
  for (let i = 0; i < ring.length - 1; i++) {
    const hit = intersection(a, b, ring[i], ring[i + 1]);
    if (hit) cuts.push({ t: hit.t, p: hit.p });
  }
  cuts.sort((x, y) => x.t - y.t);
  const output = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const first = cuts[i], last = cuts[i + 1];
    if (distance(first.p, last.p) < 0.05) continue;
    const mid = [(first.p[0] + last.p[0]) / 2, (first.p[1] + last.p[1]) / 2];
    if (inside(mid, ring)) output.push([first.p, last.p]);
  }
  return output;
}

function parseOsmServiceRoads(xml) {
  const nodes = new Map();
  for (const match of xml.matchAll(/<node\b([^>]*?)\/?>(?:<\/node>)?/g)) {
    const attrs = Object.fromEntries([...match[1].matchAll(/([\w:]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    if (attrs.id && attrs.lat && attrs.lon) nodes.set(attrs.id, [Number(attrs.lon), Number(attrs.lat)]);
  }
  const roads = [];
  for (const match of xml.matchAll(/<way\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/way>/g)) {
    if (!/<tag\s+k="highway"\s+v="service"\s*\/>/.test(match[2])) continue;
    const coordinates = [...match[2].matchAll(/<nd\s+ref="([^"]+)"\s*\/>/g)].map(m => nodes.get(m[1])).filter(Boolean);
    if (coordinates.length < 2) continue;
    const osm_tags = Object.fromEntries([...match[2].matchAll(/<tag\s+k="([^"]+)"\s+v="([^"]*)"\s*\/>/g)]
      .map(m => [m[1], m[2]]));
    roads.push({ id: `osm_way_${match[1]}`, kind: 'shared_road', source: `way/${match[1]}`,
      provenance: 'osm:shared_road', node_ids: [...match[2].matchAll(/<nd\s+ref="([^"]+)"\s*\/>/g)].map(m => m[1]),
      coordinates, osm_tags, level: 0, accessible: null });
  }
  return roads;
}

function projectOnSegment(p, a, b) {
  const scale = Math.cos(p[1] * Math.PI / 180);
  const dx = (b[0] - a[0]) * scale, dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, (((p[0] - a[0]) * scale * dx) + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  const snapped = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { t, p: snapped, distance_m: distance(p, snapped) };
}

function routingMultiplier(kind) {
  return ({ footway: 1, path: 1.03, pedestrian: 1, crossing: 1, shared_road: 1.07, steps: 1.12 })[kind] || 1.07;
}

function layerOf(line) {
  const tags = line.osm_tags || {};
  const numeric = Number(tags.layer);
  return Number.isFinite(numeric) ? numeric : (line.level || 0);
}

function sameGrade(a, b) {
  if (layerOf(a) !== layerOf(b)) return false;
  const at = a.osm_tags || {}, bt = b.osm_tags || {};
  const active = value => Boolean(value && !['no', 'false', '0'].includes(value));
  return active(at.bridge) === active(bt.bridge) && active(at.tunnel) === active(bt.tunnel);
}

function duplicateLine(a, b) {
  if (a.coordinates.length !== b.coordinates.length) return false;
  const matches = (coords) => coords.every((p, i) => distance(p, b.coordinates[i]) < 0.5);
  return matches(a.coordinates) || matches([...a.coordinates].reverse());
}

function buildGraph({ roads = [], walkways = [], accessPoints = [], boundary, snapMeters = 2.5 } = {}) {
  const ring = boundary?.geometry?.coordinates?.[0];
  if (!ring) throw new Error('Campus boundary is required');
  const segments = [];
  const selectedWalkways = [];
  for (const line of walkways) {
    if (line.pedestrian_allowed === false) continue;
    if ([...roads, ...selectedWalkways].some(other => other.id === line.id || duplicateLine(line, other))) continue;
    selectedWalkways.push(line);
  }
  for (const line of [...roads, ...selectedWalkways]) {
    if (!Array.isArray(line.coordinates) || line.coordinates.length < 2) throw new Error(`Invalid line ${line.id}`);
    for (let i = 0; i < line.coordinates.length - 1; i++) {
      for (const [a, b] of clipSegment(line.coordinates[i], line.coordinates[i + 1], ring)) {
        const unchanged = distance(a, line.coordinates[i]) < 0.05 && distance(b, line.coordinates[i + 1]) < 0.05;
        const nodeIds = unchanged && line.node_ids ? [line.node_ids[i], line.node_ids[i + 1]] : [null, null];
        segments.push({ a, b, line, nodeIds, cuts: [{ t: 0, p: a, osmId: nodeIds[0] }, { t: 1, p: b, osmId: nodeIds[1] }] });
      }
    }
  }
  // A manually traced walkway endpoint within tolerance of an existing line
  // joins that line at the projected point, rather than leaving a tiny gap.
  for (const segment of segments) {
    if (segment.line.node_ids) continue;
    for (const end of ['a', 'b']) {
      let best = null;
      for (const other of segments) {
        if (other === segment || other.line.id === segment.line.id ||
            !sameGrade(other.line, segment.line)) continue;
        const candidate = projectOnSegment(segment[end], other.a, other.b);
        if (!best || candidate.distance_m < best.distance_m) best = { ...candidate, other };
      }
      if (best && best.distance_m <= snapMeters) {
        segment[end] = best.p;
        segment.cuts[end === 'a' ? 0 : segment.cuts.length - 1].p = best.p;
        best.other.cuts.push({ t: best.t, p: best.p });
      }
    }
  }
  // Rendered line crossings are not pedestrian junctions. Preserve the
  // historical service-road intersection handling for the existing network.
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    if (!sameGrade(segments[i].line, segments[j].line)) continue;
    if (!(segments[i].line.kind === 'shared_road' && segments[j].line.kind === 'shared_road')) continue;
    const hit = intersection(segments[i].a, segments[i].b, segments[j].a, segments[j].b);
    if (hit) {
      segments[i].cuts.push({ t: hit.t, p: hit.p });
      segments[j].cuts.push({ t: hit.u, p: hit.p });
    }
  }
  const accessStatus = {};
  for (const access of accessPoints) {
    const p = [access.lng, access.lat];
    let best = null;
    for (const segment of segments) {
      if (access.osm_node_id && !segment.nodeIds.includes(String(access.osm_node_id))) continue;
      if (access.osm_node_id && !sameGrade(access, segment.line)) continue;
      const candidate = projectOnSegment(p, segment.a, segment.b);
      if (!best || candidate.distance_m < best.distance_m) best = { ...candidate, segment };
    }
    if (!best || best.distance_m > (access.osm_node_id ? 0.35 : snapMeters) || !inside(p, ring)) {
      accessStatus[access.id] = { connected: false, reason: 'not_on_network' };
      continue;
    }
    if (!best.segment.cuts.some(c => Math.abs(c.t - best.t) < 1e-9))
      best.segment.cuts.push({ t: best.t, p: best.p, osmId: access.osm_node_id || null });
    accessStatus[access.id] = { connected: true, snapped: best.p, place_id: access.place_id };
  }
  const nodes = [], edges = [];
  const nodeFor = (p, level = 0, osmId = null) => {
    const found = nodes.find(n => n.level === level && (osmId ?
      n.osm_node_id === osmId || distance(n.coordinates, p) < 0.01 :
      distance(n.coordinates, p) < 0.35));
    if (found) return found.id;
    const id = `n${nodes.length + 1}`;
    nodes.push({ id, coordinates: p, level, osm_node_id: osmId, edge_ids: [] });
    return id;
  };
  for (const segment of segments) {
    const cuts = segment.cuts.sort((x, y) => x.t - y.t);
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i].p, b = cuts[i + 1].p, length = distance(a, b);
      if (length < 0.05) continue;
      const from = nodeFor(a, layerOf(segment.line), cuts[i].osmId),
        to = nodeFor(b, layerOf(segment.line), cuts[i + 1].osmId);
      if (from === to) continue;
      const id = `e${edges.length + 1}`;
      edges.push({ id, from, to, distance_m: length, cost_m: length * routingMultiplier(segment.line.kind),
        kind: segment.line.kind, source: segment.line.source, source_geometry_ref: segment.line.id,
        provenance: segment.line.provenance || 'local_override', osm_tags: segment.line.osm_tags || null,
        accessible: segment.line.accessible ?? null });
      nodes[Number(from.slice(1)) - 1].edge_ids.push(id);
      nodes[Number(to.slice(1)) - 1].edge_ids.push(id);
    }
  }
  for (const access of accessPoints) {
    const status = accessStatus[access.id];
    if (status?.connected) {
      const node = nodes.find(n => (access.osm_node_id ? n.osm_node_id === String(access.osm_node_id) :
        distance(n.coordinates, status.snapped) < 0.35));
      status.node_id = node?.id || null;
      status.osm_node_id = access.osm_node_id || null;
      status.entrance = access.entrance || null;
      if (!node) status.connected = false;
    }
  }
  const adjacency = new Map(nodes.map(n => [n.id, []]));
  for (const edge of edges) { adjacency.get(edge.from).push(edge.to); adjacency.get(edge.to).push(edge.from); }
  const seen = new Set(), components = [];
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    const queue = [node.id], component = [];
    seen.add(node.id);
    while (queue.length) {
      const id = queue.pop(); component.push(id);
      for (const next of adjacency.get(id)) if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
    components.push(component);
  }
  return { schema_version: 1, nodes, edges, access_points: accessStatus,
    stats: { source_shared_road_count: roads.length, local_walkway_count: walkways.length,
      osm_pedestrian_way_count: selectedWalkways.filter(w => w.node_ids).length,
      access_point_count: accessPoints.length, node_count: nodes.length, edge_count: edges.length,
      connected_component_count: components.length, disconnected_components: components.slice(1).map(c => c.length),
      total_network_length_m: edges.reduce((sum, e) => sum + e.distance_m, 0) } };
}

function loadSources() {
  const boundary = JSON.parse(fs.readFileSync(path.join(DATA, 'campus_boundary.json')));
  const latest = path.join(DATA, 'source/silverest_latest.osm');
  const xml = fs.readFileSync(fs.existsSync(latest) ? latest : path.join(DATA, 'source/map(4).osm'), 'utf8');
  const generatedRoads = path.join(DATA, 'campus_osm_service_roads.json');
  const roads = fs.existsSync(generatedRoads) ?
    JSON.parse(fs.readFileSync(generatedRoads)).roads : parseOsmServiceRoads(xml);
  const walkwayGeojson = JSON.parse(fs.readFileSync(path.join(DATA, 'campus_walkways.geojson')));
  const walkways = walkwayGeojson.features.map(f => ({ id: f.properties.id, kind: f.properties.kind,
    source: f.properties.source || 'manual_survey', accessible: f.properties.accessible,
    level: f.properties.level || 0, coordinates: f.geometry.coordinates }));
  const importedPath = path.join(DATA, 'campus_osm_pedestrian.geojson');
  let osmWalkwayGeojson = { type: 'FeatureCollection', features: [] };
  if (fs.existsSync(importedPath)) {
    osmWalkwayGeojson = JSON.parse(fs.readFileSync(importedPath));
    for (const f of osmWalkwayGeojson.features) walkways.push({ ...f.properties, coordinates: f.geometry.coordinates,
      provenance: `osm:${f.properties.kind}` });
  }
  const accessPoints = JSON.parse(fs.readFileSync(path.join(DATA, 'campus_access_points.json'))).access_points;
  const importedAccessPath = path.join(DATA, 'campus_osm_access_points.json');
  if (fs.existsSync(importedAccessPath)) {
    const imported = JSON.parse(fs.readFileSync(importedAccessPath));
    for (const a of imported.access_points) {
      for (let i = accessPoints.length - 1; i >= 0; i--) {
        const local = accessPoints[i];
        if (local.id === a.id || (local.place_id === a.place_id &&
            distance([local.lng, local.lat], [a.lng, a.lat]) < 0.5)) accessPoints.splice(i, 1);
        else if (a.primary && local.place_id === a.place_id) local.primary = false;
      }
      accessPoints.push(a);
    }
  }
  return { boundary, roads, walkways, accessPoints, walkwayGeojson, osmWalkwayGeojson };
}

module.exports = { buildGraph, loadSources, parseOsmServiceRoads, inside, clipSegment,
  intersection, projectOnSegment, distance, point, coordinate, routingMultiplier };
