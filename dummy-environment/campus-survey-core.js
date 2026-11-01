(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CampusSurvey = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const R = 6371000;
  function distance(a, b) {
    const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function quality(m) { return m <= 10 ? 'good' : m <= 25 ? 'acceptable' : 'poor'; }
  function sample(position) {
    const c = position.coords;
    return { lat: c.latitude, lng: c.longitude, timestamp: new Date(position.timestamp).toISOString(),
      accuracy_m: c.accuracy, altitude_m: c.altitude ?? null, heading_deg: c.heading ?? null,
      speed_mps: c.speed ?? null };
  }
  function accept(next, last) {
    if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng) || !Number.isFinite(next.accuracy_m)) return 'invalid';
    if (next.accuracy_m > 25) return 'poor_accuracy';
    if (!last) return 'accepted';
    const seconds = (Date.parse(next.timestamp) - Date.parse(last.timestamp)) / 1000;
    const metres = distance(last, next);
    if (seconds < 2) return 'too_soon';
    if (metres < 1.5 && seconds < 20) return 'stationary';
    return 'accepted';
  }
  function representative(samples) {
    const usable = samples.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng) && Number.isFinite(s.accuracy_m));
    if (!usable.length) throw new Error('No usable GPS readings');
    const best = [...usable].sort((a, b) => a.accuracy_m - b.accuracy_m).slice(0, Math.min(3, usable.length));
    const median = key => [...best].sort((a, b) => a[key] - b[key])[Math.floor(best.length / 2)][key];
    return { lat: median('lat'), lng: median('lng'), best_accuracy_m: best[0].accuracy_m,
      sample_count: usable.length, timestamp: best[0].timestamp };
  }
  function exportPackage(state) {
    return { schema_version: 1, source: 'gps_survey', exported_at: new Date().toISOString(),
      session_id: state.session_id, walkways: { type: 'FeatureCollection', features: state.walkways.map(w => ({
        type: 'Feature', properties: { id: w.id, kind: w.kind, source: 'gps_survey', verification: 'field_survey',
          surveyed_at: w.surveyed_at, point_count: w.points.length, accuracy_summary: { best_m: Math.min(...w.points.map(p => p.accuracy_m)),
            worst_m: Math.max(...w.points.map(p => p.accuracy_m)) }, note: w.note || '', raw_samples: w.raw_samples },
        geometry: { type: 'LineString', coordinates: w.points.map(p => [p.lng, p.lat]) } })) },
      access_points: state.access_points.map(a => ({ ...a, source: 'gps_survey', verification: 'field_survey' })) };
  }
  function exportFilename(date = new Date(), sequence = 1) {
    return `silverest-survey-${date.toISOString().slice(0,10)}-${String(sequence).padStart(2,'0')}.json`;
  }
  function persist(store, key, state) { store.setItem(key, JSON.stringify(state)); }
  function restore(store, key) {
    const raw = store.getItem(key); if (!raw) return null;
    const state = JSON.parse(raw);
    if (!Array.isArray(state.walkways) || !Array.isArray(state.access_points)) throw new Error('Invalid saved survey');
    if (state.active?.mode === 'recording') state.active.mode = 'paused';
    return state;
  }
  return { distance, quality, sample, accept, representative, exportPackage, exportFilename, persist, restore };
});
