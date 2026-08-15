export function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

export function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

export function stateCard(type, title, message) {
  const icons = { loading: "◌", empty: "○", error: "!" };
  return `<div class="state-card state-card--${type}" role="${type === "error" ? "alert" : "status"}"><span class="state-card__icon" aria-hidden="true">${icons[type] || "•"}</span><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p></div></div>`;
}

export function setRegionState(region, type, title, message) {
  region.innerHTML = stateCard(type, title, message);
}

export function resultOrState(region, result, render) {
  if (result.status === "success") {
    region.innerHTML = render(result.data);
  } else if (result.status === "empty") {
    setRegionState(region, "empty", "Nothing to show yet", "This demonstration adapter returned an empty result for the selected state.");
  } else {
    setRegionState(region, "error", "Demo data unavailable", result.error || "The local demonstration adapter could not respond.");
  }
}

export function wireNavigation() {
  const menuButton = document.querySelector("[data-menu-toggle]");
  const nav = document.querySelector("[data-primary-nav]");
  menuButton?.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });
}

export function renderAppFrame({ client, title, navItems, activeRoute, content }) {
  const nav = navItems.map((item) => `<a href="#${item.route}" ${activeRoute === item.route ? 'aria-current="page"' : ""}>${escapeHtml(item.label)}</a>`).join("");
  document.body.innerHTML = `<div class="app-body"><header class="app-header"><div class="container header-inner"><a class="brand-lockup" href="../.."><span class="brand-mark" aria-hidden="true">U</span><span><strong>UNILUS</strong><small>${escapeHtml(client)}</small></span></a><button class="menu-toggle" type="button" data-menu-toggle aria-expanded="false" aria-controls="primary-nav">Menu</button><nav class="site-nav" id="primary-nav" data-primary-nav aria-label="Primary navigation">${nav}</nav><div class="header-actions"><span class="demo-pill">Demo only</span></div></div></header><main class="app-main"><div class="container"><div class="demo-banner"><strong>Demonstration environment</strong><span>Local fixture data · No live university connection</span></div>${content}</div></main><footer class="app-footer"><div class="container footer-inner"><span>UNILUS AI · Phase 1 foundation</span><span>Client: ${escapeHtml(client)} · ${escapeHtml(title)}</span></div></footer></div>`;
  wireNavigation();
}
