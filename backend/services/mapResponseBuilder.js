/**
 * mapResponseBuilder.js
 * =======================
 *
 * Builds the `navigation` block the frontend Leaflet map consumes to
 * pan/zoom/highlight without a page reload. Kept separate from
 * navigationService.js so the wire format can change (e.g. adding a
 * `bounds` field for fitBounds-based framing) without touching intent
 * detection or answer wording.
 */

const DEFAULT_ZOOM = 19;
const PROXIMITY_ZOOM = 18;

function toLatLng(coordinates) {
  return { lat: coordinates.lat, lng: coordinates.lng };
}

/**
 * @param {object} place  a campus_places.json record
 */
function buildLocateResponse(place) {
  return {
    type: "locate",
    placeId: place.id,
    name: place.name,
    category: place.category,
    ...toLatLng(place.coordinates),
    zoom: DEFAULT_ZOOM,
    highlight: true,
    geometry: place.geometry || null,
  };
}

/**
 * @param {object} place    the primary place the question centred on
 * @param {Array<{place: object, distanceMeters: number}>} nearby
 */
function buildProximityResponse(place, nearby) {
  return {
    type: "proximity",
    placeId: place.id,
    name: place.name,
    category: place.category,
    ...toLatLng(place.coordinates),
    zoom: PROXIMITY_ZOOM,
    highlight: true,
    geometry: place.geometry || null,
    nearby: nearby.map((entry) => ({
      placeId: entry.place.id,
      name: entry.place.name,
      category: entry.place.category,
      ...toLatLng(entry.place.coordinates),
      distanceMeters: Math.round(entry.distanceMeters),
    })),
  };
}

module.exports = { buildLocateResponse, buildProximityResponse, DEFAULT_ZOOM, PROXIMITY_ZOOM };
