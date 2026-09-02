window.UnilusWidget = (function () {

  const OUTFIT_OPTIONS = [
    { key: "default",       label: "Default",      icon: "chatbot-widget/cap.png" },
    { key: "health-scrub",  label: "Health scrub", icon: "chatbot-widget/outfits/health-scrub.png" },
    { key: "health-coat",   label: "Doctor coat",  icon: "chatbot-widget/outfits/health-coat.png" },
    { key: "business",      label: "Business",     icon: "chatbot-widget/outfits/business-blazer.png" },
    { key: "tech-hoodie",   label: "Tech hoodie",  icon: "chatbot-widget/outfits/tech-hoodie.png" },
    { key: "tech-circuit",  label: "Tech circuit", icon: "chatbot-widget/outfits/tech-circuit-hoodie.png" },
    { key: "law-wig",       label: "Law",          icon: "chatbot-widget/outfits/law-wig.png" },
    { key: "spirit-tee",    label: "Spirit tee",   icon: "chatbot-widget/outfits/spirit-tee.png" }
  ];

  const GLASSES_OPTIONS = [
    { key: "none",          label: "None" },
    { key: "round-gold",    label: "Round gold",   icon: "chatbot-widget/outfits/glasses-round-gold.png" },
    { key: "square-black",  label: "Square black", icon: "chatbot-widget/outfits/glasses-square-black.png" },
    { key: "cateye-black",  label: "Cat-eye",      icon: "chatbot-widget/outfits/glasses-cateye-black.png" }
  ];

  const VIEW_TITLES = {
    chat: { title: "Unilus companion", subtitle: "Online now" },
    "settings-menu": { title: "Customise avatar", subtitle: null },
    outfits: { title: "Outfits", subtitle: null },
    glasses: { title: "Glasses", subtitle: null },
    map: { title: "Campus map", subtitle: null }
  };

  // ---------------------------------------------------------------------
  // CAMPUS MAP DATA
  // Coordinates below are placeholders centred roughly on Lusaka, Zambia -
  // swap `lat`/`lng` for each building with the real GPS pin once you have
  // it (drop a pin in Google Maps on each building and copy the numbers in).
  // ---------------------------------------------------------------------
  const CAMPUSES = {
    pioneer: {
      label: "Pioneer Campus",
      center: [-15.4067, 28.2871],
      zoom: 17,
      buildings: [
        { name: "Main Entrance",        lat: -15.4074, lng: 28.2864, desc: "Main gate and security post — start of your route to every building on campus." },
        { name: "Administration Block", lat: -15.4070, lng: 28.2869, desc: "Registrar, Finance, and Student Affairs offices." },
        { name: "Library",              lat: -15.4066, lng: 28.2874, desc: "Main library — study areas, past papers desk, and computer bay." },
        { name: "Lecture Block A",      lat: -15.4063, lng: 28.2868, desc: "General lecture theatres for first and second year classes." },
        { name: "Lecture Block B",      lat: -15.4061, lng: 28.2876, desc: "Lecture rooms for upper-year and postgraduate classes." },
        { name: "ICT / Computer Lab",   lat: -15.4068, lng: 28.2879, desc: "Computer labs for practicals, coding, and IT coursework." },
        { name: "Cafeteria",            lat: -15.4072, lng: 28.2878, desc: "Main cafeteria and student hangout area." },
        { name: "Sports Grounds",       lat: -15.4059, lng: 28.2870, desc: "Football pitch and outdoor sports courts." }
      ]
    },
    silverest: {
      label: "Silverest Campus",
      center: [-15.3985, 28.3102],
      zoom: 17,
      buildings: [
        { name: "Main Entrance",        lat: -15.3992, lng: 28.3095, desc: "Main gate and security post." },
        { name: "Administration Block", lat: -15.3988, lng: 28.3100, desc: "Registrar and administration offices." },
        { name: "Library",              lat: -15.3984, lng: 28.3105, desc: "Silverest campus library and study hall." },
        { name: "Lecture Block",        lat: -15.3981, lng: 28.3098, desc: "Main lecture rooms." },
        { name: "Science Labs",         lat: -15.3979, lng: 28.3107, desc: "Laboratories for health and science programmes." },
        { name: "Cafeteria",            lat: -15.3990, lng: 28.3108, desc: "Campus cafeteria." },
        { name: "Hostel Block",         lat: -15.3977, lng: 28.3092, desc: "Student residence block." },
        { name: "Sports Field",         lat: -15.3975, lng: 28.3103, desc: "Outdoor sports field." }
      ]
    },
    leopards: {
      label: "Leopards Hill Campus",
      center: [-15.4400, 28.3600],
      zoom: 17,
      buildings: [
        { name: "Main Entrance",        lat: -15.4400, lng: 28.3600, desc: "Main gate and security post." },
        { name: "Administration Block", lat: -15.4401, lng: 28.3601, desc: "Administration offices." },
        { name: "Lecture Block",        lat: -15.4402, lng: 28.3603, desc: "Lecture rooms and teaching facilities." },
        { name: "Library",              lat: -15.4403, lng: 28.3605, desc: "Campus library and study areas." }
      ]
    }
  };

  let avatarEl = null;
  let els = {};
  let chatOpen = false;
  let expanded = false;
  let hasBotReplied = false;
  let view = "chat"; // chat | settings-menu | outfits | glasses | map

  // Leaflet state - the map instance is created once and reused (Leaflet
  // panics if you try to init twice on the same container), then
  // invalidateSize() is called every time the map view is shown, because a
  // Leaflet map created while its container is `display:none` measures
  // itself as 0x0 and renders blank/grey until it's told to re-measure.
  let leafletMap = null;
  let markerLayer = null;
  let currentCampus = "pioneer";

  function isMobile() {
    return window.matchMedia("(max-width: 640px)").matches;
  }

  function init() {
    els = {
      launcher: document.getElementById("launcher"),
      panel: document.getElementById("chat-panel"),
      backBtn: document.getElementById("back-btn"),
      closeBtn: document.getElementById("close-btn"),
      expandBtn: document.getElementById("expand-btn"),
      settingsBtn: document.getElementById("settings-btn"),
      mapBtn: document.getElementById("map-btn"),
      titleText: document.getElementById("panel-title-text"),
      statusLine: document.getElementById("status-line"),
      heroArea: document.getElementById("hero-area"),
      heroSlot: document.getElementById("hero-avatar-slot"),
      launcherSlot: document.getElementById("launcher-avatar-slot"),
      settingsPreview: document.getElementById("settings-preview"),
      settingsSlot: document.getElementById("settings-avatar-slot"),
      viewChat: document.getElementById("view-chat"),
      viewSettingsMenu: document.getElementById("view-settings-menu"),
      viewOutfits: document.getElementById("view-outfits"),
      viewGlasses: document.getElementById("view-glasses"),
      viewMap: document.getElementById("view-map"),
      outfitGrid: document.getElementById("outfit-grid"),
      glassesGrid: document.getElementById("glasses-grid"),
      outfitPreviewIcon: document.getElementById("outfit-preview-icon"),
      glassesPreviewIcon: document.getElementById("glasses-preview-icon"),
      themeSwitch: document.getElementById("theme-switch"),
      userInput: document.getElementById("user-input"),
      campusMapEl: document.getElementById("campus-map"),
      campusToggle: document.getElementById("campus-toggle"),
      buildingCard: document.getElementById("map-building-card"),
      buildingName: document.getElementById("map-building-name"),
      buildingDesc: document.getElementById("map-building-desc"),
      buildingClose: document.getElementById("map-building-close")
    };

    // Restore the last-picked outfit/glasses (saved to localStorage, same
    // approach as the theme setting below) so the avatar doesn't reset to
    // default every time the widget re-initializes on a new page.
    const savedOutfit = localStorage.getItem(OUTFIT_KEY) || "default";
    const savedGlasses = localStorage.getItem(GLASSES_KEY) || "none";
    avatarEl = UniAvatar.init(els.heroSlot, {
      state: "idle",
      outfit: savedOutfit,
      glasses: savedGlasses === "none" ? null : savedGlasses
    });

    buildSwatches(els.outfitGrid, OUTFIT_OPTIONS, UniAvatar.getOutfit(), (key) => {
      UniAvatar.setOutfit(key === "default" ? null : key);
      localStorage.setItem(OUTFIT_KEY, key);
      highlightActive(els.outfitGrid, key);
      updateMenuPreviews();
    });
    buildSwatches(els.glassesGrid, GLASSES_OPTIONS, UniAvatar.getGlasses() || "none", (key) => {
      UniAvatar.setGlasses(key === "none" ? null : key);
      localStorage.setItem(GLASSES_KEY, key);
      highlightActive(els.glassesGrid, key);
      updateMenuPreviews();
    });
    updateMenuPreviews();

    els.launcher.addEventListener("click", openChat);
    els.closeBtn.addEventListener("click", closeChat);
    els.expandBtn.addEventListener("click", toggleExpand);
    els.settingsBtn.addEventListener("click", () => goToView("settings-menu"));
    els.mapBtn.addEventListener("click", () => goToView("map"));
    els.backBtn.addEventListener("click", goBack);

    document.querySelectorAll(".settings-row[data-nav]").forEach((row) => {
      row.addEventListener("click", () => goToView(row.dataset.nav));
    });

    if (els.campusToggle) {
      els.campusToggle.querySelectorAll(".map-campus-btn").forEach((btn) => {
        btn.addEventListener("click", () => switchCampus(btn.dataset.campus));
      });
    }
    if (els.buildingClose) {
      els.buildingClose.addEventListener("click", hideBuildingCard);
    }

    initTheme();
    placeAvatar();
  }

  // ----- persisted avatar customization (outfit/glasses) -----
  const OUTFIT_KEY = "unilus-widget-outfit";
  const GLASSES_KEY = "unilus-widget-glasses";

  // ----- theme (light/dark) -----
  const THEME_KEY = "unilus-widget-theme";

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    setTheme(saved === "dark");
    els.themeSwitch.addEventListener("click", () => {
      setTheme(!els.panel.classList.contains("dark-mode"));
    });
  }

  function setTheme(isDark) {
    els.panel.classList.toggle("dark-mode", isDark);
    els.themeSwitch.classList.toggle("is-on", isDark);
    els.themeSwitch.setAttribute("aria-checked", String(isDark));
    localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
  }

  function buildSwatches(grid, options, activeKey, onPick) {
    grid.innerHTML = "";
    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swatch" + (opt.key === activeKey ? " is-active" : "");
      btn.dataset.key = opt.key;
      btn.innerHTML = opt.icon
        ? `<img src="${opt.icon}" alt="">`
        : `<span class="swatch-icon">&ndash;</span>`;
      btn.innerHTML += `<span>${opt.label}</span>`;
      btn.addEventListener("click", () => onPick(opt.key));
      grid.appendChild(btn);
    });
  }

  function highlightActive(grid, key) {
    grid.querySelectorAll(".swatch").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.key === key);
    });
  }

  function updateMenuPreviews() {
    const outfitKey = UniAvatar.getOutfit() || "default";
    const glassesKey = UniAvatar.getGlasses() || "none";
    const outfit = OUTFIT_OPTIONS.find((o) => o.key === outfitKey);
    const glasses = GLASSES_OPTIONS.find((g) => g.key === glassesKey);
    els.outfitPreviewIcon.innerHTML = outfit && outfit.icon ? `<img src="${outfit.icon}" alt="">` : "";
    els.glassesPreviewIcon.innerHTML = glasses && glasses.icon ? `<img src="${glasses.icon}" alt="">` : "";
  }

  // The single avatar DOM node (with all its live tracking/animation state)
  // is relocated between mount points rather than recreated, so nothing resets.
  function mount(targetEl) {
    if (avatarEl && targetEl && avatarEl.parentElement !== targetEl) {
      targetEl.appendChild(avatarEl);
    }
  }

  function placeAvatar() {
    if (!chatOpen) {
      mount(els.launcherSlot);
    } else if (view === "settings-menu" || view === "outfits" || view === "glasses") {
      mount(els.settingsSlot);
    } else if (view === "map") {
      // No avatar slot on the map view - leave the avatar parked wherever
      // it last was (its parent view is hidden, so it's simply not shown).
    } else if (!hasBotReplied) {
      mount(els.heroSlot);
    } else if (window._latestBotAvatarSlot) {
      mount(window._latestBotAvatarSlot);
    }
  }

  function goToView(name) {
    view = name;
    els.viewChat.hidden = name !== "chat";
    els.viewSettingsMenu.hidden = name !== "settings-menu";
    els.viewOutfits.hidden = name !== "outfits";
    els.viewGlasses.hidden = name !== "glasses";
    els.viewMap.hidden = name !== "map";

    // The floating avatar preview strip only belongs to the settings flow -
    // showing it above the map would visually clip the toolbar.
    els.settingsPreview.hidden = !(name === "settings-menu" || name === "outfits" || name === "glasses");
    els.backBtn.hidden = name === "chat";
    els.settingsBtn.hidden = name !== "chat";
    els.mapBtn.hidden = name !== "chat";
    if (els.mapBtn) els.mapBtn.classList.toggle("is-active", name === "map");

    const copy = VIEW_TITLES[name];
    els.titleText.textContent = copy.title;
    els.statusLine.textContent = copy.subtitle || "";
    els.statusLine.style.visibility = copy.subtitle ? "visible" : "hidden";

    placeAvatar();

    if (name === "map") {
      // Defer to the next frame so the [hidden] toggle above has actually
      // un-hidden #campus-map before Leaflet measures it.
      requestAnimationFrame(initOrRefreshMap);
    } else {
      hideBuildingCard();
    }
  }

  function goBack() {
    if (view === "outfits" || view === "glasses") {
      goToView("settings-menu");
    } else {
      goToView("chat");
    }
  }

  // ----- Campus map (Leaflet) -----

  function buildingMarkerIcon(isYou) {
    return L.divIcon({
      className: "",
      html: `<div class="map-building-marker${isYou ? " is-you" : ""}">
               <svg viewBox="0 0 24 24" width="16" height="16">
                 <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/>
               </svg>
             </div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -30]
    });
  }

  function initOrRefreshMap() {
    if (!els.campusMapEl || typeof L === "undefined") return;

    if (!leafletMap) {
      leafletMap = L.map(els.campusMapEl, {
        zoomControl: true,
        attributionControl: true
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(leafletMap);
      markerLayer = L.layerGroup().addTo(leafletMap);
      renderCampus(currentCampus);
    }

    // Leaflet mis-measures a map that was initialised (or resized) while
    // its container was hidden, so force a re-measure every time the map
    // view becomes visible.
    leafletMap.invalidateSize();
  }

  function renderCampus(key) {
    const campus = CAMPUSES[key];
    if (!campus || !leafletMap || !markerLayer) return;

    markerLayer.clearLayers();
    hideBuildingCard();

    leafletMap.setView(campus.center, campus.zoom);

    campus.buildings.forEach((b) => {
      const marker = L.marker([b.lat, b.lng], { icon: buildingMarkerIcon(false) });
      marker.on("click", () => showBuildingCard(b));
      marker.addTo(markerLayer);
    });
  }

  function switchCampus(key) {
    if (!CAMPUSES[key] || key === currentCampus) {
      currentCampus = key;
    } else {
      currentCampus = key;
    }
    if (els.campusToggle) {
      els.campusToggle.querySelectorAll(".map-campus-btn").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.campus === key);
      });
    }
    renderCampus(key);
  }

  function showBuildingCard(building) {
    if (!els.buildingCard) return;
    els.buildingName.textContent = building.name;
    els.buildingDesc.textContent = building.desc || "";
    els.buildingCard.hidden = false;
  }

  function hideBuildingCard() {
    if (els.buildingCard) els.buildingCard.hidden = true;
  }

  // Called by app.js / the chatbot's location-intent handler so a reply
  // like "the library is over there" can jump straight to the pin.
  function focusBuilding(campusKey, buildingName) {
    const campus = CAMPUSES[campusKey];
    if (!campus) return;
    const building = campus.buildings.find(
      (b) => b.name.toLowerCase() === String(buildingName).toLowerCase()
    );
    if (!building) return;

    goToView("map");
    switchCampus(campusKey);
    requestAnimationFrame(() => {
      leafletMap.flyTo([building.lat, building.lng], 18, { duration: 0.8 });
      showBuildingCard(building);
    });
  }

  function openMap() {
    goToView("map");
  }

  // ----- open / close / expand -----

  // Morphs the panel out of the bubble's exact on-screen position/size, then
  // clears the inline styles so the panel goes back to being laid out by CSS
  // (including the expanded/mobile-fullscreen rules) for everything after.
  function morphFromLauncher(onDone) {
    const startRect = els.launcher.getBoundingClientRect();
    els.panel.hidden = false;
    const endRect = els.panel.getBoundingClientRect();

    const scaleX = startRect.width / endRect.width;
    const scaleY = startRect.height / endRect.height;
    const dx = (startRect.left + startRect.width / 2) - (endRect.left + endRect.width / 2);
    const dy = (startRect.top + startRect.height / 2) - (endRect.top + endRect.height / 2);

    els.panel.style.transition = "none";
    els.panel.style.transformOrigin = "center";
    els.panel.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
    els.panel.style.opacity = "0";
    els.panel.style.borderRadius = "32px";

    requestAnimationFrame(() => {
      els.panel.style.transition = "transform .34s cubic-bezier(.2,.9,.3,1.15), opacity .2s ease, border-radius .34s ease";
      els.panel.style.transform = "translate(0,0) scale(1,1)";
      els.panel.style.opacity = "1";
      els.panel.style.borderRadius = "";
      els.panel.addEventListener("transitionend", function handler() {
        els.panel.removeEventListener("transitionend", handler);
        els.panel.style.transition = "";
        els.panel.style.transform = "";
        if (onDone) onDone();
      }, { once: true });
    });
  }

  // Reverse of morphFromLauncher: shrinks the panel back down into the
  // bubble's position before actually hiding it.
  function morphToLauncher(onDone) {
    const endRect = els.launcher.getBoundingClientRect();
    const startRect = els.panel.getBoundingClientRect();

    const scaleX = endRect.width / startRect.width;
    const scaleY = endRect.height / startRect.height;
    const dx = (endRect.left + endRect.width / 2) - (startRect.left + startRect.width / 2);
    const dy = (endRect.top + endRect.height / 2) - (startRect.top + startRect.height / 2);

    els.panel.style.transition = "transform .28s cubic-bezier(.4,0,.2,1), opacity .22s ease, border-radius .28s ease";
    els.panel.style.transformOrigin = "center";
    els.panel.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
    els.panel.style.opacity = "0";
    els.panel.style.borderRadius = "32px";

    els.panel.addEventListener("transitionend", function handler() {
      els.panel.removeEventListener("transitionend", handler);
      els.panel.hidden = true;
      els.panel.style.transition = "";
      els.panel.style.transform = "";
      els.panel.style.opacity = "";
      els.panel.style.borderRadius = "";
      if (onDone) onDone();
    }, { once: true });
  }

  function openChat() {
    if (chatOpen) return;
    chatOpen = true;
    els.launcher.classList.add("is-hidden");
    morphFromLauncher(() => {
      placeAvatar();
      els.userInput && els.userInput.focus();
    });
    placeAvatar();
  }

  function closeChat() {
    if (!chatOpen) return;
    chatOpen = false;
    if (view !== "chat") goToView("chat");
    if (expanded) {
      expanded = false;
      els.panel.classList.remove("expanded");
    }
    morphToLauncher(() => {
      els.launcher.classList.remove("is-hidden");
      placeAvatar();
    });
  }

  function toggleExpand() {
    if (isMobile()) return;
    expanded = !expanded;
    els.panel.classList.toggle("expanded", expanded);
    if (view === "map") {
      requestAnimationFrame(initOrRefreshMap);
    }
  }

  // Called by app.js once the first bot reply lands: collapses the hero
  // intro and hands the avatar over to whichever bot bubble is newest.
  function onBotMessage(rowEl) {
    if (!hasBotReplied) {
      hasBotReplied = true;
      els.heroArea.classList.add("is-collapsed");
    }
    window._latestBotAvatarSlot = rowEl.querySelector(".avatar-slot--inline");
    placeAvatar();
  }

  return { init, onBotMessage, openMap, focusBuilding };
})();

document.addEventListener("DOMContentLoaded", UnilusWidget.init);