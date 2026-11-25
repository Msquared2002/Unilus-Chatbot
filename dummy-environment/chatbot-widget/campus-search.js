/*
Changes: Debounces campus place searches and presents selectable API results.
Affects: Campus map search controls and selected-place behavior.
Purpose: Uses the canonical campus search endpoint instead of duplicating its index in the browser.
*/
window.CampusSearch = (function () {
  function mount(view, onPick, onStatus, getCampus = () => 'silverest') {
    if (!view || view.querySelector(".map-search")) return;
    const box = document.createElement("div");
    box.className = "map-search";
    box.innerHTML = `<label class="map-search-label" for="map-search-input">Search buildings and places</label>
      <input id="map-search-input" type="search" placeholder="Search buildings, facilities…" autocomplete="off">
      <div class="map-search-results" hidden role="listbox"></div>`;
    view.querySelector(".map-toolbar")?.appendChild(box);
    const input = box.querySelector("input");
    const results = box.querySelector(".map-search-results");
    let timer;
    let requestNumber = 0;
    input.addEventListener("input", () => {
      clearTimeout(timer);
      const myRequest = ++requestNumber;
      const query = input.value.trim();
      const campus = getCampus();
      results.hidden = true;
      results.replaceChildren();
      if (!query) { results.hidden = true; results.replaceChildren(); return; }
      timer = setTimeout(async () => {
        try {
          const response = await fetch(`${CampusDataClient.API_BASE}/search?q=${encodeURIComponent(query)}&campus=${encodeURIComponent(campus)}`);
          if (!response.ok) throw new Error("Search unavailable");
          const matches = await response.json();
          if (myRequest !== requestNumber || campus !== getCampus()) return;
          results.replaceChildren();
          if (!matches.length) {
            const empty = document.createElement("p");
            empty.textContent = "No matching campus places.";
            results.appendChild(empty);
          }
          matches.forEach(({ place, facility }) => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = facility ? `${facility.name} · ${place.name}` : place.name;
            button.addEventListener("click", () => {
              input.value = facility ? facility.name : place.name;
              results.hidden = true;
              onPick(place.id, facility, campus);
            });
            results.appendChild(button);
          });
          results.hidden = false;
        } catch (_) { if (myRequest === requestNumber) onStatus("Campus search is unavailable."); }
      }, 200);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") results.hidden = true;
    });
  }
  return { mount };
})();
