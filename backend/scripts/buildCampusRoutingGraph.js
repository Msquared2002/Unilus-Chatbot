#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const repository = require('../services/campusRepository');
const { buildGraph, loadSources } = require('../services/campusGraphBuilder');
const { validateSources } = require('../services/campusRoutingValidator');

function main() {
  const sources = loadSources();
  const report = validateSources({ ...sources, buildings: repository.getAllBuildings(),
    placeIds: new Set(repository.getAllPlaces().map(p => p.id)) });
  if (report.errors.length) throw new Error(report.errors.join('\n'));
  const graph = buildGraph(sources);
  const places = repository.getAllPlaces();
  const accessible = new Set(sources.accessPoints.filter(a => graph.access_points[a.id]?.connected).map(a => a.place_id));
  graph.stats.destinations_with_valid_access = [...accessible].filter(id => places.some(p => p.id === id));
  graph.stats.destinations_without_valid_access = places.map(p => p.id).filter(id => !accessible.has(id));
  graph.validation = report;
  const target = path.resolve(__dirname, '../data/campus/campus_routing_graph.json');
  fs.writeFileSync(target, JSON.stringify(graph, null, 2) + '\n');
  console.log(JSON.stringify(graph.stats, null, 2));
  if (report.warnings.length) console.warn(report.warnings.join('\n'));
  return graph;
}
if (require.main === module) main();
module.exports = { main };
