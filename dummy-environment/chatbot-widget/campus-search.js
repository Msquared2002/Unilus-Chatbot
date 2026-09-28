// Search uses the existing campus API rather than a second browser-side index.
window.CampusSearch = (function () {
  function mount(view, onPick, onStatus) {
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
      const query = input.value.trim();
      if (!query) { results.hidden = true; results.replaceChildren(); return; }
      timer = setTimeout(async () => {
        const myRequest = ++requestNumber;
        try {
          const response = await fetch(`${CampusDataClient.API_BASE}/search?q=${encodeURIComponent(query)}`);
          if (!response.ok) throw new Error("Search unavailable");
          const matches = await response.json();
          if (myRequest !== requestNumber) return;
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
              onPick(place.id);
            });
            results.appendChild(button);
          });
          results.hidden = false;
        } catch (_) { onStatus("Campus search is unavailable."); }
      }, 200);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") results.hidden = true;
    });
  }
  return { mount };
})();
