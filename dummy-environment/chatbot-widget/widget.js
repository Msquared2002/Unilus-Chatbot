/*
Changes: Coordinates widget state, chat requests, settings, and view rendering.
Affects: The embedded chatbot UI and its calls to backend chat and campus endpoints.
Purpose: Keeps user interaction orchestration in the widget controller while feature modules handle focused behavior.
*/
window.UnilusWidget = (function () {

  const OUTFIT_OPTIONS = [
    { key: "default",       label: "Default",      icon: "chatbot-widget/cap.png" },
    { key: "health-scrub",  label: "Health scrub", icon: "chatbot-widget/outfits/health-scrub.png" },
    { key: "health-coat",   label: "Doctor coat",  icon: "chatbot-widget/outfits/health-coat.png" },
    { key: "business",      label: "Business",     icon: "chatbot-widget/outfits/business-blazer.png" },
    { key: "tech-hoodie",   label: "Tech hoodie",  icon: "chatbot-widget/outfits/tech-hoodie.png" },
    { key: "tech-circuit",  label: "Tech circuit", icon: "chatbot-widget/outfits/tech-circuit-hoodie.png" },
    { key: "law-wig",       label: "Law",          icon: "chatbot-widget/outfits/law-wig.png" },
    { key: "spirit-tee",    label: "Spirit tee",   icon: "chatbot-widget/outfits/spirit-tee.png" },
    { key: "spirit-hoodie", label: "Green Spirit Hoodie", icon: "chatbot-widget/outfits/spirit-hoodie.png" },
    { key: "green-polo", label: "Green Polo", icon: "chatbot-widget/outfits/green-polo.png" },
    { key: "navy-varsity-tee", label: "Navy Varsity Tee", icon: "chatbot-widget/outfits/navy-varsity-tee.png" },
    { key: "white-varsity-tee", label: "White Varsity Tee", icon: "chatbot-widget/outfits/white-varsity-tee.png" },
    { key: "gray-spirit-hoodie", label: "Gray Spirit Hoodie", icon: "chatbot-widget/outfits/gray-spirit-hoodie.png" },
    { key: "black-spirit-hoodie", label: "Black Spirit Hoodie", icon: "chatbot-widget/outfits/black-spirit-hoodie.png" },
    { key: "maroon-spirit-hoodie", label: "Maroon Spirit Hoodie", icon: "chatbot-widget/outfits/maroon-spirit-hoodie.png" },
    { key: "white-nursing-uniform", label: "White Nursing Uniform", icon: "chatbot-widget/outfits/white-nursing-uniform.png" },
    { key: "striped-nursing-uniform", label: "Striped Nursing Uniform", icon: "chatbot-widget/outfits/striped-nursing-uniform.png" }
  ];

  const GLASSES_OPTIONS = [
    { key: "none",          label: "None" },
    { key: "round-gold",    label: "Round gold",   icon: "chatbot-widget/outfits/glasses-round-gold.png" },
    { key: "square-black",  label: "Square black", icon: "chatbot-widget/outfits/glasses-square-black.png" },
    { key: "cateye-black",  label: "Cat-eye",      icon: "chatbot-widget/outfits/glasses-cateye-black.png" }
  ];

  const VIEW_TITLES = {
    notifications: {title:"Notifications",subtitle:null},
    chat: { title: "Unilus companion", subtitle: "Online now" },
    "settings-menu": { title: "Customise avatar", subtitle: null },
    outfits: { title: "Outfits", subtitle: null },
    glasses: { title: "Glasses", subtitle: null },
    accessories: { title: "Accessories", subtitle: null },
    hairstyles: { title: "Hairstyles", subtitle: null },
    map: { title: "Campus map", subtitle: null }
  };

  let avatarEl = null;
  let els = {};
  let chatOpen = false;
  let expanded = false;
  let hasBotReplied = false;
  let notificationScroll=0;
  let view = "chat"; // chat | settings-menu | outfits | glasses | map
  let entitlements = UnilusAvatarEntitlements.resolveEntitlements(null);
  let currentStudent = null;
  let identityKey = null;
  let laptopPreference = null;

  // The Leaflet instance, campus/building data, and marker + card
  // rendering all live in campus-map.js now (window.CampusMap). This
  // file only decides when the map view opens/closes and wires the
  // toolbar/close button DOM to it - see CampusMap.init() below.

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
      outfitRow: document.querySelector('.settings-row[data-nav="outfits"]'),
      glassesRow: document.querySelector('.settings-row[data-nav="glasses"]'),
      outfitPreviewIcon: document.getElementById("outfit-preview-icon"),
      glassesPreviewIcon: document.getElementById("glasses-preview-icon"),
      themeSwitch: document.getElementById("theme-switch"),
      userInput: document.getElementById("user-input"),
      campusMapEl: document.getElementById("campus-map"),
      campusToggle: document.getElementById("campus-toggle"),
      buildingCard: document.getElementById("map-building-card"),
      buildingName: document.getElementById("map-building-name"),
      buildingDesc: document.getElementById("map-building-desc"),
      buildingClose: document.getElementById("map-building-close"),
      buildingImage: document.getElementById("map-building-image"),
      buildingFacilities: document.getElementById("map-building-facilities"),
      buildingGallery: document.getElementById("map-building-gallery"),
      buildingDirections: document.getElementById("map-building-directions")
    };

    initAccessoryControls();
    initHairstyleControls();

    // Restore the last-picked outfit/glasses (saved to localStorage, same
    // approach as the theme setting below) so the avatar doesn't reset to
    // default every time the widget re-initializes on a new page.
    avatarEl = UniAvatar.init(els.heroSlot, {
      state: "idle",
      outfit: "default",
      glasses: null,
      laptop: false
    });
    refreshIdentity();

    els.launcher.addEventListener("click", openChat);
    els.closeBtn.addEventListener("click", closeChat);
    els.expandBtn.addEventListener("click", toggleExpand);
    els.settingsBtn.addEventListener("click", () => goToView("settings-menu"));
    els.mapBtn.addEventListener("click", () => goToView("map"));
    els.backBtn.addEventListener("click", goBack);

    document.querySelectorAll(".settings-row[data-nav]").forEach((row) => {
      row.addEventListener("click", () => goToView(row.dataset.nav));
    });
    els.laptopSwitch.addEventListener("click", () => {
      if (!entitlements.accessories.includes("laptop")) return;
      laptopPreference = !UniAvatar.getLaptop();
      UniAvatar.setLaptop(laptopPreference);
      localStorage.setItem(preferenceKey(LAPTOP_KEY), String(laptopPreference));
      updateLaptopSwitch();
    });
    window.addEventListener("unilus-student-context-changed", refreshIdentity);
    window.addEventListener("pageshow", refreshIdentity);
    window.addEventListener("focus", refreshIdentity);
    window.addEventListener("storage", refreshIdentity);

    // CampusMap owns the toolbar/toggle/card DOM from here on - it wires
    // its own click listeners for campus switching and card close.
    if (typeof CampusMap !== "undefined") {
      CampusMap.init({
        mapEl: els.campusMapEl,
        campusToggle: els.campusToggle,
        buildingCard: els.buildingCard,
        buildingName: els.buildingName,
        buildingDesc: els.buildingDesc,
        buildingClose: els.buildingClose,
        buildingImage: els.buildingImage,
        buildingFacilities: els.buildingFacilities,
        buildingGallery: els.buildingGallery,
        buildingDirections: els.buildingDirections
      });
    }

    initTheme();
    placeAvatar();
  }

  // ----- persisted avatar customization (outfit/glasses) -----
  const OUTFIT_KEY = "unilus-widget-outfit";
  const GLASSES_KEY = "unilus-widget-glasses";
  const LAPTOP_KEY = "unilus-widget-laptop";
  const HAIRSTYLE_KEY = "unilus-widget-hairstyle";

  function preferenceKey(base) {
    return UnilusAvatarEntitlements.preferenceKey(base, currentStudent);
  }

  function initAccessoryControls() {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "settings-row";
    row.dataset.nav = "accessories";
    row.innerHTML = '<span class="settings-row-icon">▣</span><span class="settings-row-label">Accessories</span><span class="settings-row-chevron">›</span>';
    els.glassesRow.after(row);
    const panel = document.createElement("div");
    panel.id = "view-accessories";
    panel.className = "panel-view";
    panel.hidden = true;
    panel.innerHTML = '<div class="accessory-list"><div class="settings-row settings-row--static"><span class="settings-row-icon">▣</span><span class="settings-row-label">Laptop</span><button type="button" class="theme-switch" id="laptop-switch" role="switch" aria-checked="false" aria-label="Toggle laptop"></button></div></div>';
    els.viewGlasses.after(panel);
    els.accessoryRow = row;
    els.viewAccessories = panel;
    els.laptopSwitch = panel.querySelector("#laptop-switch");
  }

  function updateLaptopSwitch() {
    const enabled = UniAvatar.getLaptop();
    els.laptopSwitch.classList.toggle("is-on", enabled);
    els.laptopSwitch.setAttribute("aria-checked", String(enabled));
  }

  function initHairstyleControls() {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "settings-row";
    row.dataset.nav = "hairstyles";
    row.hidden = true;
    row.innerHTML = '<span class="settings-row-icon" id="hair-preview-icon" aria-hidden="true">⌁</span><span class="settings-row-label">Hairstyles</span><span class="settings-row-chevron" aria-hidden="true">›</span>';
    els.glassesRow.after(row);
    const panel = document.createElement("div");
    panel.id = "view-hairstyles";
    panel.className = "panel-view";
    panel.hidden = true;
    panel.innerHTML = '<p class="hair-wig-note" hidden>The Law wig covers your hairstyle. Your selection returns when you choose another outfit.</p><div class="hair-picker"></div>';
    els.viewGlasses.after(panel);
    els.hairRow = row;
    els.viewHairstyles = panel;
    els.hairList = panel.querySelector(".hair-picker");
    els.hairWigNote = panel.querySelector(".hair-wig-note");
    els.hairPreviewIcon = row.querySelector("#hair-preview-icon");
  }

  function buildHairstylePicker() {
    els.hairList.innerHTML = "";
    if (!currentStudent) return;
    const choose = (key) => {
      if (!currentStudent || (key !== "none" && !UnilusHairstyles.get(key))) return;
      UniAvatar.setHairstyle(key === "none" ? null : key);
      localStorage.setItem(preferenceKey(HAIRSTYLE_KEY), key);
      highlightActive(els.hairList, key);
      els.hairList.querySelectorAll(".swatch").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.key === key));
      });
      updateMenuPreviews();
    };
    const active = UniAvatar.getHairstyle() || "none";
    const addGrid = (parent, options) => {
      const grid = document.createElement("div");
      grid.className = "swatch-grid";
      parent.appendChild(grid);
      buildSwatches(grid, options, active, choose);
      grid.querySelectorAll(".swatch").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.key === active));
      });
    };
    addGrid(els.hairList, [{ key: "none", label: "None" }]);
    UnilusHairstyles.CATEGORIES.forEach((category) => {
      const section = document.createElement("section");
      section.dataset.category = category.id;
      section.className = "hair-category";
      els.hairList.appendChild(section);
      addGrid(section, UnilusHairstyles.HAIRSTYLES.filter((style) => style.category === category.id)
        .map((style) => ({ key: style.id, label: style.label, icon: style.src })));
    });
  }

  function refreshIdentity() {
    const student = UnilusAvatarEntitlements.getCurrentStudent();
    const nextKey = student ? `${student.id}:${student.programmeCode || ""}:${student.programmeName || ""}:${student.programme || ""}` : "guest";
    if (nextKey === identityKey && avatarEl) return;
    identityKey = nextKey;
    currentStudent = student;
    entitlements = UnilusAvatarEntitlements.resolveEntitlements(student);
    const allowedOutfits = new Set(entitlements.outfits);
    const savedOutfit = student ? localStorage.getItem(preferenceKey(OUTFIT_KEY)) : null;
    const savedGlasses = student ? localStorage.getItem(preferenceKey(GLASSES_KEY)) : null;
    const savedLaptop = student && entitlements.accessories.includes("laptop")
      ? localStorage.getItem(preferenceKey(LAPTOP_KEY)) : null;
    const appearance = UnilusAvatarEntitlements.resolveAppearance(entitlements,
      { outfit: savedOutfit, glasses: savedGlasses, laptop: savedLaptop });
    laptopPreference = appearance.laptopPreference;
    const outfit = appearance.outfit;
    UniAvatar.setOutfit(outfit);
    UniAvatar.setGlasses(appearance.glasses);
    UniAvatar.setLaptop(appearance.laptop);
    UniAvatar.setHairstyle(UnilusHairstyles.restore(student,
      student ? localStorage.getItem(preferenceKey(HAIRSTYLE_KEY)) : null));
    els.outfitRow.hidden = !student;
    els.glassesRow.hidden = !student;
    els.hairRow.hidden = !student;
    els.accessoryRow.hidden = !entitlements.accessories.includes("laptop");
    els.settingsBtn.setAttribute("aria-label", student ? "Customise avatar" : "Settings");
    if (view === "settings-menu") els.titleText.textContent = student ? "Customise avatar" : "Settings";
    if (!student && ["outfits", "glasses", "accessories", "hairstyles"].includes(view)) goToView("settings-menu");
    if (student && view === "accessories" && els.accessoryRow.hidden) goToView("settings-menu");
    buildSwatches(els.outfitGrid, OUTFIT_OPTIONS.filter((o) => allowedOutfits.has(o.key)), outfit, (key) => {
      if (!entitlements.outfits.includes(key)) return;
      UniAvatar.setOutfit(key);
      localStorage.setItem(preferenceKey(OUTFIT_KEY), key);
      if (laptopPreference === null && ["tech-hoodie", "tech-circuit"].includes(key)) UniAvatar.setLaptop(true);
      highlightActive(els.outfitGrid, key);
      updateLaptopSwitch();
      updateMenuPreviews();
    });
    buildSwatches(els.glassesGrid, student ? GLASSES_OPTIONS : [], UniAvatar.getGlasses() || "none", (key) => {
      if (!currentStudent || !GLASSES_OPTIONS.some((g) => g.key === key)) return;
      UniAvatar.setGlasses(key === "none" ? null : key);
      localStorage.setItem(preferenceKey(GLASSES_KEY), key);
      highlightActive(els.glassesGrid, key);
      updateMenuPreviews();
    });
    updateLaptopSwitch();
    buildHairstylePicker();
    updateMenuPreviews();
  }

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
    const hairstyle = UnilusHairstyles.get(UniAvatar.getHairstyle());
    els.hairPreviewIcon.innerHTML = hairstyle ? `<img src="${hairstyle.src}" alt="">` : "⌁";
    els.hairWigNote.hidden = outfitKey !== "law-wig";
  }

  // The single avatar DOM node (with all its live tracking/animation state)
  // is relocated between mount points rather than recreated, so nothing resets.
  function mount(targetEl) {
    if (avatarEl && targetEl && avatarEl.parentElement !== targetEl) {
      targetEl.appendChild(avatarEl);
      UniAvatar.resetTracking();
    }
    if (avatarEl && targetEl) {
      // Inline replies always sit to the avatar's right. Elsewhere choose
      // the side with room after the persistent node has been mounted.
      const inline = targetEl.classList.contains("avatar-slot--inline");
      const rect = targetEl.getBoundingClientRect();
      avatarEl.classList.toggle("bubble-left", inline || rect.right > window.innerWidth - rect.left);
    }
  }

  function placeAvatar() {
    if (!chatOpen) {
      mount(els.launcherSlot);
    } else if (view === "settings-menu" || view === "outfits" || view === "glasses" || view === "accessories" || view === "hairstyles") {
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
    if (["outfits", "glasses", "accessories", "hairstyles"].includes(name) && !currentStudent) name = "settings-menu";
    if (name === "accessories" && !entitlements.accessories.includes("laptop")) name = "settings-menu";
    if(name==="notifications"&&view==="chat")notificationScroll=document.getElementById("chat-box")?.scrollTop||0;
    if(view==="notifications"&&name==="chat")requestAnimationFrame(()=>{const box=document.getElementById("chat-box");if(box)box.scrollTop=notificationScroll;});
    view = name;
    const inbox=document.getElementById("view-notifications");if(inbox)inbox.hidden=name!=="notifications";
    els.viewChat.hidden = name !== "chat";
    els.viewSettingsMenu.hidden = name !== "settings-menu";
    els.viewOutfits.hidden = name !== "outfits";
    els.viewGlasses.hidden = name !== "glasses";
    els.viewAccessories.hidden = name !== "accessories";
    els.viewHairstyles.hidden = name !== "hairstyles";
    els.viewMap.hidden = name !== "map";

    // The floating avatar preview strip only belongs to the settings flow -
    // showing it above the map would visually clip the toolbar.
    els.settingsPreview.hidden = !(name === "settings-menu" || name === "outfits" || name === "glasses" || name === "accessories" || name === "hairstyles");
    els.backBtn.hidden = name === "chat";
    els.settingsBtn.hidden = name !== "chat";
    els.mapBtn.hidden = name !== "chat";
    if (els.mapBtn) els.mapBtn.classList.toggle("is-active", name === "map");

    const copy = VIEW_TITLES[name];
    els.titleText.textContent = name === "settings-menu" && !currentStudent ? "Settings" : copy.title;
    els.statusLine.textContent = copy.subtitle || "";
    els.statusLine.style.visibility = copy.subtitle ? "visible" : "hidden";

    placeAvatar();

    if (name === "map") {
      // Defer to the next frame so the [hidden] toggle above has actually
      // un-hidden #campus-map before Leaflet measures it.
      requestAnimationFrame(CampusMap.show);
    } else {
      CampusMap.closeBuildingCard();
    }
  }

  function goBack() {
    if(view==="notifications"){goToView("chat");document.getElementById("notification-bell")?.focus();return;}
    if (view === "outfits" || view === "glasses" || view === "accessories" || view === "hairstyles") {
      goToView("settings-menu");
    } else {
      goToView("chat");
    }
  }

  // ----- Campus map -----
  // Leaflet, buildings.json, campus availability/boundary, marker
  // rendering, and the building card are all owned by CampusMap
  // (campus-map.js). This file only owns view-switching mechanics -
  // deciding WHICH campus/building to show is the chatbot's job
  // (app.js), never this file's or campus-map.js's.

  // Called by app.js once the user has explicitly confirmed they want
  // to see a specific, already-identified building on the map (e.g.
  // clicking "View on Map" after the chatbot named a location). This
  // function does not do any deciding of its own - campus/buildingId
  // arrive already resolved.
  function showBuildingOnMap({ campus, buildingId, route, routeFromGps, mapsTab }) {
    goToView("map");
    requestAnimationFrame(() => {
      CampusMap.show();
      CampusMap.openCampus(campus).then(() => {
        CampusMap.flyToBuilding(buildingId, campus);
        CampusMap.openBuildingCard(buildingId, campus);
        if (route?.status === "ok") CampusMap.showRoute(route);
        if (routeFromGps) CampusMap.routeFromCurrentLocation(buildingId, mapsTab);
      });
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
    window.dispatchEvent(new Event("unilus-chat-opened"));
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
    placeAvatar();
    if (view === "map") {
      requestAnimationFrame(CampusMap.show);
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

  return {
  init,
  onBotMessage,
  showNotifications: () => goToView("notifications"),
  openMap,
  showBuildingOnMap
};
})();

document.addEventListener("DOMContentLoaded", UnilusWidget.init);
