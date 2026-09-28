// The campus API owns names, IDs, coordinates and geometry. This file only
// adapts its records to the existing Leaflet widget's [lat, lng] convention.
window.CampusDataClient = (function () {
  const API_BASE = "http://localhost:5000/api/campus";
  const PRESENTATION_URL = "chatbot-widget/campus-data/presentation.json";

  async function getJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response.json();
  }

  async function load() {
    const [places, boundary, presentation] = await Promise.all([
      getJson(`${API_BASE}/places`),
      getJson(`${API_BASE}/boundary`),
      getJson(PRESENTATION_URL)
    ]);
    if (!Array.isArray(places) || !boundary?.geometry?.coordinates?.[0]) {
      throw new Error("Campus API returned invalid place or boundary data");
    }
    const silverest = presentation.silverest || {};
    const enrichment = silverest.places || {};
    return {
      silverest: {
        label: silverest.label || "Silverest Campus",
        available: true,
        center: [boundary.coordinates.lat, boundary.coordinates.lng],
        zoom: 17,
        boundary: boundary.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]),
        buildings: places.map((place) => ({
          id: place.id,
          name: place.name,
          description: place.description,
          category: enrichment[place.id]?.displayCategory || place.category,
          coordinates: [place.coordinates.lat, place.coordinates.lng],
          geometry: place.geometry,
          facilities: enrichment[place.id]?.facilities || [],
          gallery: enrichment[place.id]?.gallery || []
        }))
      },
      pioneer: presentation.pioneer,
      leopards: presentation.leopards
    };
  }

  return { load, API_BASE };
})();
