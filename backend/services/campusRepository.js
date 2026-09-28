/**
 * campusRepository.js
 * ====================
 *
 * Data-access layer for the campus navigation dataset. This is the
 * ONLY module that reads data/campus/*.json directly — every other
 * navigation module (locationSearchService, navigationService,
 * mapResponseBuilder, campusRoutes) goes through this repository,
 * the same pattern resourceService.js and timetableService.js use
 * for their own datasets.
 *
 * The four files under data/campus/ are treated as authoritative and
 * are never written to by this module. In particular, "nearby place"
 * data is deliberately NOT stored in campus_places.json — it's
 * computed once at load time from the existing centroids (see
 * getNearby below) so the hand-verified GIS dataset never needs to be
 * regenerated just to support a new derived feature.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data/campus");

function loadJsonOrEmpty(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    console.warn(`campusRepository: ${filePath} not found. Campus navigation data unavailable.`);
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const boundary = loadJsonOrEmpty(path.join(DATA_DIR, "campus_boundary.json"), null);

const placesFile = loadJsonOrEmpty(path.join(DATA_DIR, "campus_places.json"), { places: [] });
const buildingsFile = loadJsonOrEmpty(path.join(DATA_DIR, "campus_buildings.json"), { buildings: [] });
const searchIndexFile = loadJsonOrEmpty(path.join(DATA_DIR, "campus_search_index.json"), {
  search_index: {},
  aliases: {},
  place_id_lookup: {},
});

const places = placesFile.places || [];
const buildings = buildingsFile.buildings || [];

const placesById = new Map(places.map((p) => [p.id, p]));
const placesByOsmRef = new Map(places.map((p) => [p.osm_ref, p]));
const buildingsById = new Map(buildings.map((b) => [b.id, b]));

/**
 * Haversine distance between two {lat,lng} points, in meters.
 * Accurate enough for campus-scale distances (everything here is
 * under 500m) — no need for a full geodesic library for this.
 */
function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Nearest-neighbour table for every named place, computed once at
 * module load from the existing centroids and cached in memory.
 * Sorted nearest-first so getNearby() is just a slice.
 */
const nearbyById = new Map();
for (const place of places) {
  const distances = places
    .filter((other) => other.id !== place.id)
    .map((other) => ({
      place: other,
      distanceMeters: distanceMeters(place.coordinates, other.coordinates),
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
  nearbyById.set(place.id, distances);
}

function getBoundary() {
  return boundary;
}

function getAllPlaces() {
  return places;
}

function getPlaceById(id) {
  return placesById.get(id) || null;
}

function getPlaceByOsmRef(osmRef) {
  return placesByOsmRef.get(osmRef) || null;
}

function getAllBuildings() {
  return buildings;
}

function getBuildingById(id) {
  return buildingsById.get(id) || null;
}

function getSearchIndex() {
  return searchIndexFile;
}

/**
 * Nearby places for a given place id, nearest first.
 *
 * @param {string} placeId
 * @param {object} options
 * @param {number} options.limit              max results (default 3)
 * @param {number|null} options.maxDistanceMeters  optional distance cutoff
 * @returns {Array<{place: object, distanceMeters: number}>}
 */
function getNearby(placeId, { limit = 3, maxDistanceMeters = null } = {}) {
  const all = nearbyById.get(placeId) || [];
  const filtered = maxDistanceMeters == null ? all : all.filter((entry) => entry.distanceMeters <= maxDistanceMeters);
  return filtered.slice(0, limit);
}

module.exports = {
  getBoundary,
  getAllPlaces,
  getPlaceById,
  getPlaceByOsmRef,
  getAllBuildings,
  getBuildingById,
  getSearchIndex,
  getNearby,
  distanceMeters,
};
