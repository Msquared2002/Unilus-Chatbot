const { distance, inside, intersection, projectOnSegment } = require('./campusGraphBuilder');

function validateSources({ walkwayGeojson, osmWalkwayGeojson = { features: [] }, accessPoints, boundary, buildings = [], roads = [], placeIds = null }) {
  const errors = [], warnings = [];
  if (walkwayGeojson?.type !== 'FeatureCollection' || !Array.isArray(walkwayGeojson.features)) {
    return { errors: ['Invalid walkway GeoJSON FeatureCollection'], warnings };
  }
  const ring = boundary.geometry.coordinates[0], ids = new Set(), endpoints = [], signatures = new Set();
  const allFeatures = [...walkwayGeojson.features, ...osmWalkwayGeojson.features];
  for (const feature of allFeatures) {
    const id = feature?.properties?.id;
    if (!id || ids.has(id)) errors.push(`Duplicate or missing path ID: ${id}`);
    ids.add(id);
    if (feature?.properties?.pedestrian_allowed === false)
      warnings.push(`Pedestrian access restricted; excluded from graph: ${id}`);
    if (!['footway', 'path', 'pedestrian', 'crossing', 'steps', 'shared_road'].includes(feature?.properties?.kind))
      errors.push(`Invalid path kind: ${id}`);
    const coords = feature?.geometry?.coordinates;
    if (feature?.geometry?.type !== 'LineString' || !Array.isArray(coords) || coords.length < 2 ||
        coords.some(c => !Array.isArray(c) || c.length !== 2 || !c.every(Number.isFinite))) {
      errors.push(`Invalid LineString: ${id}`); continue;
    }
    if (coords.some(c => !inside(c, ring))) warnings.push(`Path outside boundary: ${id}`);
    const signature = JSON.stringify(coords);
    const reverseSignature = JSON.stringify([...coords].reverse());
    if (signatures.has(signature) || signatures.has(reverseSignature)) warnings.push(`Duplicate path geometry: ${id}`);
    signatures.add(signature);
    for (let i = 0; i < coords.length - 1; i++) {
      if (distance(coords[i], coords[i + 1]) < 0.05) errors.push(`Zero-length segment: ${id}`);
      for (const building of buildings) {
        const polygon = building.geometry?.type === 'Polygon' ? building.geometry.coordinates?.[0] : null;
        if (!polygon) continue;
        if (inside(coords[i], polygon) || inside(coords[i + 1], polygon) ||
            polygon.slice(0, -1).some((p, j) => intersection(coords[i], coords[i + 1], p, polygon[j + 1]))) {
          warnings.push(`Building crossing needs review: ${id} / ${building.id}`);
        }
      }
    }
    endpoints.push({ id, point: coords[0] }, { id, point: coords.at(-1) });
  }
  for (const endpoint of endpoints) {
    const joinsEndpoint = endpoints.some(other => other !== endpoint && distance(other.point, endpoint.point) < 0.05);
    const almostJoins = endpoints.some(other => other !== endpoint && distance(other.point, endpoint.point) <= 3);
    const joinsLine = [...roads.map(r => r.coordinates), ...allFeatures
      .filter(f => f?.properties?.id !== endpoint.id).map(f => f?.geometry?.coordinates || [])]
      .filter(coords => Array.isArray(coords) && coords.every(c => Array.isArray(c) && c.length === 2 && c.every(Number.isFinite)))
      .some(coords => coords.slice(0, -1).some((p, i) => projectOnSegment(endpoint.point, p, coords[i + 1]).distance_m < 0.05));
    if (!joinsEndpoint && !joinsLine) {
      warnings.push(`Dangling endpoint: ${endpoint.id} at ${endpoint.point.join(',')}`);
      if (almostJoins) warnings.push(`Endpoints almost meet without topology: ${endpoint.id} at ${endpoint.point.join(',')}`);
    }
  }
  const accessIds = new Set();
  for (const access of accessPoints) {
    if (!access.id || accessIds.has(access.id)) errors.push(`Duplicate or missing access ID: ${access.id}`);
    accessIds.add(access.id);
    if (placeIds && !placeIds.has(access.place_id)) errors.push(`Unknown access place ID: ${access.place_id}`);
    if (!Number.isFinite(access.lat) || !Number.isFinite(access.lng) || !inside([access.lng, access.lat], ring))
      errors.push(`Invalid or outside access point: ${access.id}`);
    if (access.entrance === 'service' || ['private', 'no'].includes(access.osm_tags?.access) || access.osm_tags?.foot === 'no') {
      if (access.primary) warnings.push(`Inaccessible or service entrance selected as primary: ${access.id}`);
    }
    if (access.osm_node_id) {
      const point = [access.lng, access.lat];
      const matchingBuilding = buildings.find(b => b.osm_ref === access.parent_osm_ref);
      if (matchingBuilding?.geometry?.type === 'Polygon' && inside(point, matchingBuilding.geometry.coordinates[0]) &&
          !matchingBuilding.geometry.coordinates[0].slice(0, -1).some((p, i) =>
            projectOnSegment(point, p, matchingBuilding.geometry.coordinates[0][i + 1]).distance_m < 0.2))
        warnings.push(`Entrance inside building rather than on boundary: ${access.id}`);
    }
  }
  for (const placeId of new Set(accessPoints.map(a => a.place_id))) {
    if (accessPoints.filter(a => a.place_id === placeId && a.primary).length > 1)
      errors.push(`Multiple primary entrances: ${placeId}`);
  }
  return { errors, warnings: [...new Set(warnings)] };
}

module.exports = { validateSources };
