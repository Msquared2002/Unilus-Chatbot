// GPS is requested only from an explicit map control interaction.
window.CampusLocation = (function () {
  let current = null;
  let marker = null;
  let accuracyCircle = null;

  function insideBoundary(point, ring) {
    if (!Array.isArray(ring) || ring.length < 3) return false;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const yi = ring[i][0], xi = ring[i][1];
      const yj = ring[j][0], xj = ring[j][1];
      if ((yi > point.lat) !== (yj > point.lat) &&
          point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function request(map, boundary, onStatus, onLocated) {
    if (!navigator.geolocation) {
      onStatus("Location is unavailable in this browser.");
      return;
    }
    onStatus("Finding your location…");
    navigator.geolocation.getCurrentPosition((position) => {
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      current = { ...point, accuracyMeters: position.coords.accuracy,
        onCampus: insideBoundary(point, boundary) };
      if (marker) map.removeLayer(marker);
      if (accuracyCircle) map.removeLayer(accuracyCircle);
      marker = L.circleMarker([point.lat, point.lng], {
        radius: 9, color: "#fff", weight: 3, fillColor: "#2388ff", fillOpacity: 1,
        className: "map-current-location"
      }).addTo(map);
      if (Number.isFinite(current.accuracyMeters)) {
        accuracyCircle = L.circle([point.lat, point.lng], {
          radius: current.accuracyMeters, color: "#2388ff", weight: 1,
          fillColor: "#2388ff", fillOpacity: 0.12, interactive: false
        }).addTo(map);
      }
      if (current.onCampus) {
        map.flyTo([point.lat, point.lng], Math.max(map.getZoom(), 17));
        onStatus("Location found on Silverest Campus.");
        if (onLocated) onLocated(current);
      } else {
        onStatus("You appear to be outside Silverest Campus.");
      }
    }, (error) => {
      const message = error.code === 1 ? "Location permission was denied." :
        error.code === 3 ? "Location request timed out." : "Location is unavailable.";
      onStatus(message);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  }

  function recenter(map, boundary, onStatus) {
    if (current?.onCampus) map.flyTo([current.lat, current.lng], Math.max(map.getZoom(), 17));
    else request(map, boundary, onStatus);
  }

  return { insideBoundary, request, recenter, getCurrent: () => current };
})();
