// campus-map.js
// ---------------------------------------------------------------------
// Owns everything about the campus map: the Leaflet instance, tile
// layer, buildings.json data, campus boundary/lock, marker rendering,
// and the building info panel. It NEVER decides which campus/building
// to show - that decision belongs to the chatbot flow in app.js. This
// module only executes a confirmed instruction:
//
//   CampusMap.init(elements)          -> wire up DOM + start loading data
//   CampusMap.show()                  -> create/measure the Leaflet map
//   CampusMap.openCampus(key)         -> switch campus (or toast its
//                                         "not available yet" message)
//   CampusMap.flyToBuilding(id)       -> pan/zoom to a building by id
//   CampusMap.openBuildingCard(id)    -> populate + reveal the info panel
//   CampusMap.closeBuildingCard()
//
// Data-driven: campus/building data (availability, boundary,
// coordinates, facilities, gallery filenames) lives in
// campus-data/buildings.json, not in code. Cover/gallery images are
// never referenced by path in that file - they're found purely by
// convention (campus-data/buildings/<campus>/<id>/cover.*, trying
// webp/jpg/jpeg/png in turn) - so dropping real photos in later needs
// no JS or JSON path changes, just a `gallery` array of filenames
// (without extension) once photos exist. Missing images fall back to
// campus-data/placeholder.svg automatically.
//
// RESERVED FOR LATER: a building object may one day include an optional
// `polygon` field (an array of [lat,lng] points outlining the building's
// footprint, same shape as a campus `boundary`). Nothing here reads it
// yet - it's simply ignored, exactly like any other unrecognised JSON
// field - so adding it to buildings.json today is harmless. Highlighting
// it on the map is a deliberately separate, not-yet-built feature.
// ---------------------------------------------------------------------

window.CampusMap = (function () {

  // This module is bundled into dist/chatbot-widget.js and loaded by the
  // host page via <script src="chatbot-widget/dist/chatbot-widget.js">
  // - relative fetch()/img paths resolve against the HOST PAGE's URL,
  // not this file's location, so paths into our own folder need the
  // same "chatbot-widget/" prefix the host's <link>/<script> tags
  // already use. Update this if the widget folder is ever renamed or
  // moved relative to the host pages.
  const BASE_PATH = "chatbot-widget/";
  const PLACEHOLDER_IMAGE = BASE_PATH + "campus-data/placeholder.svg";
  const BUILDINGS_DIR = BASE_PATH + "campus-data/buildings";
  // Tried in this order for every cover/gallery image - drop a photo in
  // with any of these extensions and it's picked up automatically, no
  // JS or buildings.json changes needed.
  const IMAGE_EXTENSIONS = ["webp", "jpg", "jpeg", "png"];
  const FLY_ZOOM = 18;
  const TOAST_DURATION_MS = 3200;
  const SATELLITE_TILE_URL =
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const SATELLITE_ATTRIBUTION =
    "Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics";

  // Base folder for a building's photos, by convention alone - nothing
  // building-specific is ever hardcoded here. campus-data/buildings/
  // <campus>/<id>/ is the only structure a new building needs.
  function buildingAssetDir(campusKey, buildingId) {
    return `${BUILDINGS_DIR}/${campusKey}/${buildingId}`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  let els = {};                 // DOM refs, passed in from widget.js via init()
  let leafletMap = null;
  let markerLayer = null;
  let markersById = {};    // building id -> Leaflet marker, rebuilt every renderCampus()
  let activeMarkerId = null; // the currently-selected building's marker, kept in front of the rest
  let maskLayer = null;         // dims everything outside the campus boundary
  let boundaryLayer = null;
  let toastEl = null;           // brief "not available" message, created once
  let toastTimer = null;
  let campusesData = null;      // parsed buildings.json, once loaded
  let dataLoadPromise = null;
  let activeCategory = "all";
  let currentCampus = "silverest"; // the only available campus in the API
  let routeLayer = null;
  let routeStartMarker = null;
  let routeSummary = null;

  // ----- data loading (fetched once, cached) -----

  function loadData() {
    if (dataLoadPromise) return dataLoadPromise;
    dataLoadPromise = CampusDataClient.load()
      .then((json) => {
        campusesData = json;
        updateCampusButtons();
        return json;
      })
      .catch((err) => {
        // Don't break the UI if the data file is missing/malformed - the
        // map still shows, it just has no markers until this is fixed.
        console.error("[CampusMap] Failed to load campus API data:", err);
        showToast("Campus places are unavailable. Check the campus API connection.");
        campusesData = campusesData || {};
        return campusesData;
      });
    return dataLoadPromise;
  }

  function getCampus(key) {
    return campusesData ? campusesData[key] : null;
  }

  function firstAvailableCampusKey() {
    if (!campusesData) return null;
    return Object.keys(campusesData).find((k) => campusesData[k].available) || null;
  }

  function findBuilding(id, campusKey) {
    const campus = getCampus(campusKey || currentCampus);
    if (!campus || !campus.buildings) return null;
    return campus.buildings.find((b) => b.id === id) || null;
  }

  const LOCK_ICON = `<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 2a4 4 0 0 0-4 4v3H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a4 4 0 0 0-4-4Zm0 2a2 2 0 0 1 2 2v3h-4V6a2 2 0 0 1 2-2Z"/></svg>`;
  const CHECK_ICON = `<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.2 14.4-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4Z"/></svg>`;

  // Rebuilds each toggle button's inner markup with an icon + status line
  // (matching the target design) and keeps is-active/is-unavailable in
  // sync. Safe to call before data has loaded (falls back to plain
  // labels) and every time availability/active campus changes.
  function updateCampusButtons() {
    if (!els.campusToggle) return;
    els.campusToggle.querySelectorAll(".map-campus-btn").forEach((btn) => {
      const key = btn.dataset.campus;
      const campus = getCampus(key);
      const isActive = key === currentCampus && !!campus && campus.available !== false;
      const isUnavailable = !!campus && campus.available === false;

      btn.classList.toggle("is-active", isActive);
      btn.classList.toggle("is-unavailable", isUnavailable);

      // Preserve the label text the host page shipped with (e.g.
      // "Leopards Hill") rather than hardcoding it here.
      const label = btn.dataset.mapLabel || btn.textContent.trim();
      btn.dataset.mapLabel = label;

      const status = isUnavailable
        ? "Not available"
        : isActive
          ? "Current campus"
          : "Tap to view";

      btn.innerHTML =
        `<span class="map-campus-btn-icon">${isUnavailable ? LOCK_ICON : CHECK_ICON}</span>` +
        `<span class="map-campus-btn-text">` +
        `<span class="map-campus-btn-label">${escapeHtml(label)}</span>` +
        `<span class="map-campus-btn-status">${status}</span>` +
        `</span>`;
    });
  }

  // ----- init -----

  function init(elements) {
    els = elements || {};

    if (els.buildingClose) {
      els.buildingClose.addEventListener("click", closeBuildingCard);
    }
    if (els.campusToggle) {
      els.campusToggle.querySelectorAll(".map-campus-btn").forEach((btn) => {
        btn.addEventListener("click", () => openCampus(btn.dataset.campus));
      });
    }

    restructureLayout();
    restructureBuildingCard();
    initMobileSheetDrag();
    initMapControls();
    updateCampusButtons();

    return loadData();
  }

  // Puts #campus-map and #map-building-card side by side in a shared
  // flex row, instead of the panel floating on top of the map. This is
  // the fix that actually matters: with the panel as a real flex
  // sibling, the map's own box shrinks to make room for it, so Leaflet
  // (once told to re-measure - see refreshMapLayout()) genuinely
  // re-centers the campus in whatever space is left, instead of
  // rendering the full-width view underneath a panel that just covers
  // part of it.
  function restructureLayout() {
    if (!els.mapEl || els.mapEl.dataset.wrapped) return;
    const viewport = document.createElement("div");
    viewport.className = "map-viewport";
    els.mapEl.parentNode.insertBefore(viewport, els.mapEl);

    // Buildings list docks on the LEFT (its own flex sibling, same
    // pattern as the info panel on the right) - inserted before the map
    // so it appears first in the row.
    const list = buildBuildingsListEl();
    viewport.appendChild(list);
    els.buildingsList = list;

    viewport.appendChild(els.mapEl);
    if (els.buildingCard) viewport.appendChild(els.buildingCard);

    // Small floating summary bar in the map's bottom-left corner (e.g.
    // "Silverest Campus - 13 buildings - Campus locked"). Tapping it
    // opens the buildings list. Lives inside the map itself (which
    // already has position:relative) so it can never spill over the
    // toolbar/toggle row the way an earlier version's overlay did.
    const summary = buildCampusSummaryEl();
    els.mapEl.appendChild(summary);
    els.campusSummary = summary;

    els.mapEl.dataset.wrapped = "true";
  }

  // ----- buildings list (left panel) -----

  function buildBuildingsListEl() {
    const panel = document.createElement("div");
    panel.className = "map-buildings-list";
    panel.hidden = true;
    panel.innerHTML =
      `<div class="map-buildings-list-header">
         <h4>Buildings &amp; Places</h4>
         <button type="button" class="map-buildings-list-close" aria-label="Close">&times;</button>
       </div>
       <div class="map-category-filters" aria-label="Filter places"></div>
       <ul class="map-buildings-list-items"></ul>`;
    panel.querySelector(".map-buildings-list-close").addEventListener("click", () => toggleBuildingsList(false));
    return panel;
  }

  function initMapControls() {
    const view = els.mapEl?.closest("#view-map");
    if (!view) return;
    CampusSearch.mount(view, (id) => {
      toggleBuildingsList(false);
      flyToBuilding(id, "silverest");
      openBuildingCard(id, "silverest");
    }, showToast);
    const filters = els.buildingsList?.querySelector(".map-category-filters");
    ["All", "Academic", "Facilities", "Food", "Sports"].forEach((name) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = name;
      button.dataset.category = name.toLowerCase();
      button.classList.toggle("is-active", name === "All");
      button.addEventListener("click", () => {
        activeCategory = button.dataset.category;
        filters.querySelectorAll("button").forEach((item) =>
          item.classList.toggle("is-active", item === button));
        const campus = getCampus(currentCampus);
        if (campus) renderBuildingsList(campus, currentCampus);
      });
      filters.appendChild(button);
    });
    const locationButton = document.createElement("button");
    locationButton.type = "button";
    locationButton.className = "map-location-button";
    locationButton.textContent = "◎ Re-center";
    locationButton.setAttribute("aria-label", "Use or re-center on my location");
    locationButton.addEventListener("click", () => {
      const campus = getCampus("silverest");
      if (!leafletMap || !campus) return;
      locationButton.disabled = true;
      CampusLocation.recenter(leafletMap, campus.boundary, (message) => {
        showToast(message);
        if (!message.includes("Finding")) locationButton.disabled = false;
      });
    });
    els.mapEl.appendChild(locationButton);
  }

  function toggleBuildingsList(show) {
    if (!els.buildingsList) return;
    const willShow = show == null ? els.buildingsList.hidden : show;
    els.buildingsList.hidden = !willShow;
    requestAnimationFrame(refreshMapLayout);
  }

  function renderBuildingsList(campus, campusKey) {
    if (!els.buildingsList) return;
    const list = els.buildingsList.querySelector(".map-buildings-list-items");
    list.innerHTML = "";
    (campus.buildings || []).filter((b) => {
      if (activeCategory === "all") return true;
      const category = (b.category || "").toLowerCase();
      return activeCategory === "facilities" ? category === "facility" || category === "healthcare" :
        activeCategory === "food" ? category.includes("food") : category.includes(activeCategory);
    }).forEach((b) => {
      const li = document.createElement("li");
      li.className = "map-buildings-list-item";
      li.tabIndex = 0;
      li.setAttribute("role", "button");
      const thumb = document.createElement("img");
      thumb.alt = "";
      setImageWithFallback(thumb, `${buildingAssetDir(campusKey, b.id)}/cover`);
      const label = document.createElement("span");
      label.textContent = b.name;
      li.appendChild(thumb);
      li.appendChild(label);
      const select = () => {
        flyToBuilding(b.id, campusKey);
        openBuildingCard(b.id, campusKey);
        toggleBuildingsList(false);
      };
      li.addEventListener("click", select);
      li.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(); }
      });
      list.appendChild(li);
    });
  }

  // ----- campus summary bar -----

  const SHIELD_ICON = `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 2 4 5v6c0 5.25 3.4 9.74 8 11 4.6-1.26 8-5.75 8-11V5l-8-3Z"/></svg>`;
  const CHEVRON_ICON = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="m9 6 6 6-6 6-1.4-1.4L12.2 12 7.6 7.4Z"/></svg>`;

  function buildCampusSummaryEl() {
    const bar = document.createElement("button");
    bar.type = "button";
    bar.className = "map-campus-summary";
    bar.hidden = true;
    bar.addEventListener("click", () => toggleBuildingsList());
    return bar;
  }

  function updateCampusSummary(campus) {
    if (!els.campusSummary) return;
    if (!campus || !campus.available) {
      els.campusSummary.hidden = true;
      return;
    }
    const count = (campus.buildings || []).length;
    els.campusSummary.innerHTML =
      `<span class="map-campus-summary-icon">${SHIELD_ICON}</span>` +
      `<span class="map-campus-summary-text">` +
      `<strong>${escapeHtml(campus.label)}</strong>` +
      `<span>${count} building${count === 1 ? "" : "s"} &middot; Campus locked</span>` +
      `</span>` +
      `<span class="map-campus-summary-chevron">${CHEVRON_ICON}</span>`;
    els.campusSummary.hidden = false;
  }

  // Leaflet sizes itself from its container's actual box at the moment
  // it's asked to - it has no way to know the container just resized
  // (e.g. the info panel just appeared/disappeared) unless told to
  // re-measure. invalidateSize() alone (not a fitBounds reset) is
  // exactly what's needed here: by default it keeps the current
  // geographic center in view while adjusting for the new container
  // size, so switching between buildings - or opening the panel at all -
  // never snaps the view back out to the whole campus.
  function refreshMapLayout() {
    if (!leafletMap) return;
    leafletMap.invalidateSize();
  }

  // Moves the existing building-card elements (already in the host
  // HTML - #map-building-image, #map-building-name, etc.) into a
  // header/body grouping, adds a mobile drag handle, and relocates the
  // whole card to live INSIDE the map container itself (which already
  // has position:relative) rather than #view-map. That keeps its
  // right:0/top:0/bottom:0 positioning scoped to the map area only - it
  // can never stretch over the toolbar/campus-toggle row or the
  // widget's shared header the way the old "unavailable" overlay
  // accidentally did. This only regroups/moves nodes that already
  // exist - it doesn't create new ones for any data field, so every
  // els.* reference used elsewhere keeps working unchanged.
  function restructureBuildingCard() {
    const card = els.buildingCard;
    if (!card || card.dataset.restructured) return;

    const grabber = document.createElement("div");
    grabber.className = "map-building-grabber";
    card.insertBefore(grabber, card.firstChild);

    const header = document.createElement("div");
    header.className = "map-building-header";
    if (els.buildingImage) header.appendChild(els.buildingImage);

    // Category tag pill overlaid on the cover image (e.g. "Facility"),
    // and the close button - both float over the image, top corners.
    const categoryTag = document.createElement("span");
    categoryTag.className = "map-building-tag";
    header.appendChild(categoryTag);
    els.buildingTag = categoryTag;

    if (els.buildingClose) header.appendChild(els.buildingClose);
    card.insertBefore(header, grabber.nextSibling);

    const body = document.createElement("div");
    body.className = "map-building-body";
    if (els.buildingName) body.appendChild(els.buildingName);
    if (els.buildingDesc) body.appendChild(els.buildingDesc);

    // Campus location line (pin icon + campus label), under the
    // description - purely from data we already have (campus.label),
    // nothing fabricated.
    const location = document.createElement("p");
    location.className = "map-building-location";
    body.appendChild(location);
    els.buildingLocation = location;

    body.appendChild(document.createElement("hr")).className = "map-building-divider";

    if (els.buildingFacilities) {
      const facHeading = document.createElement("h4");
      facHeading.className = "map-building-section-heading";
      facHeading.textContent = "Facilities";
      els.buildingFacilities.insertBefore(facHeading, els.buildingFacilities.firstChild);
      body.appendChild(els.buildingFacilities);
    }
    if (els.buildingGallery) body.appendChild(els.buildingGallery);
    if (els.buildingDirections) body.appendChild(els.buildingDirections);
    card.appendChild(body);

    // On mobile, tapping/dragging the grabber toggles half-height vs
    // full-height (see initMobileSheetDrag). On desktop the grabber is
    // simply hidden via CSS - the panel is always full height there.
    card.dataset.restructured = "true";
  }

  // Lets the mobile bottom sheet be dragged (or tapped) between its
  // default half-screen height and full screen, per the requested
  // "scroll it up to take up the full screen" behaviour.
  function initMobileSheetDrag() {
    const grabber = els.buildingCard && els.buildingCard.querySelector(".map-building-grabber");
    if (!grabber) return;

    let startY = 0;
    let dragging = false;

    grabber.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 640px)").matches) {
        els.buildingCard.classList.toggle("is-full");
      }
    });

    grabber.addEventListener("pointerdown", (e) => {
      if (!window.matchMedia("(max-width: 640px)").matches) return;
      dragging = true;
      startY = e.clientY;
      grabber.setPointerCapture(e.pointerId);
    });
    grabber.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const delta = startY - e.clientY;
      if (delta > 40) {
        els.buildingCard.classList.add("is-full");
        dragging = false;
      } else if (delta < -40) {
        els.buildingCard.classList.remove("is-full");
        dragging = false;
      }
    });
    grabber.addEventListener("pointerup", () => { dragging = false; });
  }

  // ----- Leaflet map -----

  // A small floating card above each marker's pin (cover image + name),
  // matching the target design - not a plain teardrop pin. The image is
  // filled in after the marker is added (see renderCampus), reusing the
  // same setImageWithFallback() used everywhere else so there's exactly
  // one image-loading implementation in this file.
  // ----- marker stacking: selection + hover -----
  // Markers overlap heavily at normal zoom, so whichever one was clicked
  // (via a pin, the buildings list, or the chatbot's "View on Map") is
  // kept in front of the others via Leaflet's own z-index API, and
  // hovering any marker briefly brings IT to front while dimming
  // everything else, so it's unambiguous which pin is under the cursor
  // before clicking.

  // ----- marker states: simple pin (default) <-> expanded card (hover/selected) -----
  // Only ONE marker on the whole map is ever the expanded cover-image
  // card at a time - every other building is a plain small pin. This
  // also means cover images are only fetched for whichever building is
  // actually being looked at, not all of them upfront.

  function setActiveMarker(id, building, campusKey) {
    if (activeMarkerId && activeMarkerId !== id && markersById[activeMarkerId]) {
      collapseMarker(markersById[activeMarkerId]);
    }
    activeMarkerId = id;
    if (id && markersById[id]) {
      expandMarker(markersById[id], building, campusKey);
      markersById[id].setZIndexOffset(1000);
    }
  }

  function setMarkersDimmed(dimmed, exceptId) {
    Object.keys(markersById).forEach((key) => {
      const el = markersById[key].getElement();
      if (el) el.classList.toggle("is-dimmed", dimmed && key !== exceptId);
    });
  }

  function simplePinIcon() {
    return L.divIcon({
      className: "",
      html: `<div class="map-marker"><span class="map-marker-pin"><span class="map-marker-pin-dot"></span></span></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 24],
      popupAnchor: [0, -24]
    });
  }

  function expandedMarkerIcon(name) {
    return L.divIcon({
      className: "",
      html: `<div class="map-marker">
               <div class="map-marker-card">
                 <img class="map-marker-thumb" alt="">
                 <span class="map-marker-label">${escapeHtml(name)}</span>
               </div>
               <span class="map-marker-connector"></span>
               <span class="map-marker-pin"><span class="map-marker-pin-dot"></span></span>
             </div>`,
      iconSize: [130, 66],
      iconAnchor: [65, 62],
      popupAnchor: [0, -62]
    });
  }

  // Swaps a marker from the plain pin to the cover-image card. Changing
  // a Leaflet marker's icon replaces its DOM element entirely, so the
  // cover image has to be (re)applied to the freshly-created <img> here
  // every time - there's no persistent element to reuse across swaps.
  function expandMarker(marker, building, campusKey) {
    marker.setIcon(expandedMarkerIcon(building.name));
    const el = marker.getElement();
    const thumb = el && el.querySelector(".map-marker-thumb");
    setImageWithFallback(thumb, `${buildingAssetDir(campusKey, building.id)}/cover`);
  }

  function collapseMarker(marker) {
    marker.setIcon(simplePinIcon());
    marker.setZIndexOffset(0);
  }

  // Brief, non-blocking message (e.g. "Navigation is currently
  // available only for Silverest Campus...") shown near the campus
  // toggle. Unlike the old implementation, this never covers the map,
  // the toggle buttons, or the widget's back/close controls - it just
  // appears and fades, and the map underneath is untouched.
  function ensureToastEl() {
    if (toastEl || !els.campusToggle || !els.campusToggle.parentNode) return toastEl;
    toastEl = document.createElement("div");
    toastEl.className = "map-campus-toast";
    els.campusToggle.parentNode.insertBefore(toastEl, els.campusToggle.nextSibling);
    return toastEl;
  }

  function showToast(message) {
    const el = ensureToastEl();
    if (!el) return;
    el.textContent = message;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), TOAST_DURATION_MS);
  }

  // Called every time the map view becomes visible. Leaflet is only
  // constructed once (it panics if you init twice on the same
  // container); invalidateSize() is called every time because a map
  // created/resized while its container was display:none measures
  // itself as 0x0 and renders blank until told to re-measure.
  function show() {
    if (!els.mapEl || typeof L === "undefined") return;

    if (!leafletMap) {
      leafletMap = L.map(els.mapEl, {
        zoomControl: true,
        attributionControl: true,
        minZoom: 15,
        maxZoom: 18,
        // Vector overlays (our boundary mask) can visibly desync from
        // the tile layer for one frame during Leaflet's animated zoom,
        // reading as a jarring "flash" of the full unmasked map. Turning
        // off the zoom animation removes that desync entirely.
        zoomAnimation: false
      });
      L.tileLayer(SATELLITE_TILE_URL, {
        // Capped at 18, matching the map's own maxZoom above - Esri's
        // World Imagery doesn't have detailed coverage this far out for
        // every location, and zooming past what's actually available
        // shows Esri's own gray "Map data not yet available" placeholder
        // tiles, which reads as broken. 18 stays comfortably inside
        // real coverage for campus-scale detail.
        maxZoom: 18,
        attribution: SATELLITE_ATTRIBUTION
      }).addTo(leafletMap);
      markerLayer = L.layerGroup().addTo(leafletMap);

      loadData().then(() => {
        // If the default active campus (from the host HTML) turns out to
        // have no map data, land on the first available one instead of
        // showing an unavailable campus on first open.
        const startCampus = getCampus(currentCampus);
        if (!startCampus || !startCampus.available) {
          const fallback = firstAvailableCampusKey();
          if (fallback) { openCampus(fallback); return; }
        }
        renderCampus(currentCampus);
      });
    }

    leafletMap.invalidateSize();
  }

  // A polygon covering a box around the campus (not the whole world)
  // with the boundary cut out as a hole, so everything outside the
  // campus is heavily dimmed rather than a normal, distracting view of
  // the surrounding city. className + the matching CSS rule
  // (.map-boundary-mask{fill-rule:evenodd}) make the hole render
  // correctly regardless of which winding direction the boundary
  // polygon happens to use. Keeping the outer ring finite (padded
  // campus bounds, not [-180,180]) rather than world-spanning is also
  // what keeps this cheap enough to redraw without visible lag.
  function buildMask(boundaryRing, bounds) {
    const padded = bounds.pad(6);
    const sw = padded.getSouthWest();
    const ne = padded.getNorthEast();
    const outer = [
      [sw.lat, sw.lng], [sw.lat, ne.lng], [ne.lat, ne.lng], [ne.lat, sw.lng]
    ];
    return L.polygon([outer, boundaryRing], {
      className: "map-boundary-mask",
      stroke: false,
      fillColor: "#050b16",
      fillOpacity: 0.82,
      interactive: false
    });
  }

  function renderCampus(key) {
    const campus = getCampus(key);
    if (!campus || !leafletMap || !markerLayer) return;

    markerLayer.clearLayers();
    clearRoute();
    closeBuildingCard();

    const boundaryRing = campus.boundary || null;

    if (boundaryRing && boundaryRing.length) {
      const bounds = L.latLngBounds(boundaryRing);

      if (boundaryLayer) leafletMap.removeLayer(boundaryLayer);
      boundaryLayer = L.polygon(boundaryRing, {
        className: "map-boundary-outline",
        color: "#2ede8c",
        weight: 3,
        fillOpacity: 0
      }).addTo(leafletMap);

      if (maskLayer) leafletMap.removeLayer(maskLayer);
      maskLayer = buildMask(boundaryRing, bounds).addTo(leafletMap);

      leafletMap.setMaxBounds(bounds.pad(0.15));
      leafletMap.fitBounds(bounds, { padding: [20, 20] });
    } else {
      leafletMap.setMaxBounds(null);
      leafletMap.setView(campus.center, campus.zoom);
      if (maskLayer) { leafletMap.removeLayer(maskLayer); maskLayer = null; }
      if (boundaryLayer) { leafletMap.removeLayer(boundaryLayer); boundaryLayer = null; }
    }

    markersById = {};
    (campus.buildings || []).forEach((b) => {
      const marker = L.marker(b.coordinates, { icon: simplePinIcon() });
      marker.on("click", () => openBuildingCard(b.id, key));
      marker.on("mouseover", () => {
        marker.setZIndexOffset(2000);
        expandMarker(marker, b, key);
        setMarkersDimmed(true, b.id);
      });
      marker.on("mouseout", () => {
        setMarkersDimmed(false);
        if (b.id === activeMarkerId) {
          marker.setZIndexOffset(1000); // stays expanded - it's the selected building
        } else {
          collapseMarker(marker);
        }
      });
      marker.addTo(markerLayer);
      markersById[b.id] = marker;
    });

    updateCampusSummary(campus);
    renderBuildingsList(campus, key);
    toggleBuildingsList(false);
  }

  // Switching TO an unavailable campus just shows a toast - the map,
  // active button, and current campus are left exactly as they were
  // (there's nothing to switch to: no markers, no boundary, no fake
  // coordinates).
  function openCampus(key) {
    return loadData().then(() => {
      const campus = getCampus(key);
      if (campus && campus.available === false) {
        showToast(campus.message || "Navigation is currently available only for Silverest Campus. Pioneer and Leopards Hill will be added in a future update.");
        return;
      }
      currentCampus = key;
      updateCampusButtons();
      if (leafletMap) renderCampus(key);
    });
  }

  function flyToBuilding(id, campusKey) {
    return loadData().then(() => {
      const building = findBuilding(id, campusKey);
      if (!building || !leafletMap) return;
      leafletMap.flyTo(building.coordinates, FLY_ZOOM, { duration: 0.8 });
    });
  }

  // ----- building card -----

  function setImageWithFallback(imgEl, basePath) {
    if (!imgEl) return;
    if (!basePath) {
      imgEl.onerror = null;
      imgEl.src = PLACEHOLDER_IMAGE;
      return;
    }
    let i = 0;
    imgEl.onerror = function () {
      i += 1;
      if (i < IMAGE_EXTENSIONS.length) {
        imgEl.src = `${basePath}.${IMAGE_EXTENSIONS[i]}`;
      } else {
        // Tried every extension, nothing exists yet - fall back quietly,
        // no console error of our own. (The browser's network panel will
        // still show the attempted 404s - that's inherent to feature-
        // testing images via <img onerror>, not something app code logs.)
        imgEl.onerror = null;
        imgEl.src = PLACEHOLDER_IMAGE;
      }
    };
    imgEl.src = `${basePath}.${IMAGE_EXTENSIONS[0]}`;
  }

  function renderFacilities(facilities) {
    if (!els.buildingFacilities) return;
    const list = facilities || [];
    // Only rebuild the <ul> - the "Facilities" heading (inserted once in
    // restructureBuildingCard) is a permanent child of this container
    // and must survive re-renders.
    const oldUl = els.buildingFacilities.querySelector("ul");
    if (oldUl) oldUl.remove();
    if (!list.length) {
      els.buildingFacilities.hidden = true;
      return;
    }
    const ul = document.createElement("ul");
    list.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      ul.appendChild(li);
    });
    els.buildingFacilities.appendChild(ul);
    els.buildingFacilities.hidden = false;
  }

  function renderGallery(gallery, buildingName, assetDir) {
    if (!els.buildingGallery) return;
    const list = gallery || [];
    els.buildingGallery.innerHTML = "";
    if (!list.length) {
      els.buildingGallery.hidden = true;
      return;
    }
    list.forEach((baseName) => {
      const img = document.createElement("img");
      img.className = "map-building-gallery-thumb";
      img.alt = (buildingName || "Building") + " photo";
      setImageWithFallback(img, `${assetDir}/${baseName}`);
      els.buildingGallery.appendChild(img);
    });
    els.buildingGallery.hidden = false;
  }

  const DIRECTIONS_ICON = `<svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M21.71 11.29 12.71 2.29a1 1 0 0 0-1.42 0l-9 9a1 1 0 0 0 0 1.42l9 9a1 1 0 0 0 1.42 0l9-9a1 1 0 0 0 0-1.42ZM14 14.5V12h-3v3H9v-4a1 1 0 0 1 1-1h4V7.5l3.5 3.5Z"/></svg>`;

  function renderDirections(building) {
    if (!els.buildingDirections) return;
    if (!building?.coordinates) {
      els.buildingDirections.hidden = true;
      return;
    }
    els.buildingDirections.removeAttribute("href");
    els.buildingDirections.innerHTML = `${DIRECTIONS_ICON}<span>Route from my location</span>`;
    els.buildingDirections.onclick = (event) => { event.preventDefault(); routeFromCurrentLocation(building.id); };
    els.buildingDirections.hidden = false;
  }

  // Populates + reveals the building info panel from a buildings.json
  // record. Unlike earlier versions, everything (description,
  // facilities, gallery, directions) is shown at once - the panel is
  // now spacious enough (right-docked on desktop, a scrollable sheet on
  // mobile) that a separate mini/expanded toggle isn't needed. On
  // mobile the only remaining toggle is the sheet's HEIGHT (half vs
  // full screen), via the grab handle - see initMobileSheetDrag().
  //
  // Images are never read from a path in buildings.json - they're found
  // purely by convention (campus-data/buildings/<campus>/<id>/), so
  // adding real photos later never needs a JS or JSON change.
  function openBuildingCard(id, campusKey) {
    return loadData().then(() => {
      const resolvedCampus = campusKey || currentCampus;
      const building = findBuilding(id, resolvedCampus);
      const campus = getCampus(resolvedCampus);
      if (!building || !els.buildingCard) return;

      const assetDir = buildingAssetDir(resolvedCampus, building.id);

      if (els.buildingName) els.buildingName.textContent = building.name;
      if (els.buildingDesc) els.buildingDesc.textContent = building.description || "";
      if (els.buildingTag) {
        els.buildingTag.textContent = building.category || "";
        els.buildingTag.hidden = !building.category;
      }
      if (els.buildingLocation) {
        els.buildingLocation.innerHTML =
          `<svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>` +
          `<span>${escapeHtml((campus && campus.label) || "")}</span>`;
      }
      setImageWithFallback(els.buildingImage, `${assetDir}/cover`);
      renderFacilities(building.facilities);
      renderGallery(building.gallery, building.name, assetDir);
      renderDirections(building);

      els.buildingCard.classList.remove("is-full");
      els.buildingCard.hidden = false;
      requestAnimationFrame(refreshMapLayout);
      setActiveMarker(building.id, building, resolvedCampus);
    });
  }

  function closeBuildingCard() {
    if (els.buildingCard) {
      els.buildingCard.hidden = true;
      els.buildingCard.classList.remove("is-full");
      requestAnimationFrame(refreshMapLayout);
      setActiveMarker(null, null, null);
    }
  }

  function clearRoute() {
    if (routeLayer && leafletMap) leafletMap.removeLayer(routeLayer);
    if (routeStartMarker && leafletMap) leafletMap.removeLayer(routeStartMarker);
    if (routeSummary) routeSummary.remove();
    routeLayer = routeStartMarker = routeSummary = null;
  }

  function showRoute(result) {
    if (!leafletMap || result?.status !== "ok" || result.geometry?.type !== "LineString") return;
    clearRoute();
    const points = result.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    if (points.length < 2) return;
    routeLayer = L.polyline(points, { color: "#1687ff", weight: 7, opacity: 0.95,
      lineCap: "round", lineJoin: "round", className: "map-walking-route" }).addTo(leafletMap);
    routeStartMarker = L.circleMarker(points[0], { radius: 7, color: "white", weight: 3,
      fillColor: "#1687ff", fillOpacity: 1 }).addTo(leafletMap);
    leafletMap.fitBounds(routeLayer.getBounds(), { padding: [55, 55], maxZoom: 18 });
    const minutes = result.duration_s < 60 ? "< 1 min" : `${Math.round(result.duration_s / 60)} min`;
    routeSummary = document.createElement("div");
    routeSummary.className = "map-route-summary";
    routeSummary.textContent = `${Math.round(result.distance_m)} m · ${minutes} walk`;
    els.mapEl.appendChild(routeSummary);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const line = routeLayer.getElement();
      if (line?.getTotalLength) {
        const length = line.getTotalLength();
        line.style.strokeDasharray = `${length} ${length}`;
        line.style.strokeDashoffset = String(length);
        requestAnimationFrame(() => {
          line.style.transition = "stroke-dashoffset 1.2s ease";
          line.style.strokeDashoffset = "0";
        });
      }
    }
  }

  async function routeFromCurrentLocation(placeId) {
    const campus = getCampus("silverest");
    if (!leafletMap || !campus) return;
    const run = async (position) => {
      if (!position?.onCampus) return;
      try {
        const response = await fetch(`${CampusDataClient.API_BASE}/route`, { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from: { lat: position.lat, lng: position.lng }, to: { place_id: placeId } }) });
        const result = await response.json();
        if (result.status === "ok") showRoute(result);
        else showToast(result.message || "A verified walking route is not available yet.");
      } catch (_) { showToast("The local campus route service is unavailable."); }
    };
    const current = CampusLocation.getCurrent();
    if (current?.onCampus) run(current);
    else CampusLocation.request(leafletMap, campus.boundary, showToast, run);
  }

  return {
    init,
    show,
    openCampus,
    flyToBuilding,
    openBuildingCard,
    closeBuildingCard,
    showRoute,
    routeFromCurrentLocation
  };
})();
