/*
Changes:
Adds one reusable menu to the primary UNILUS logo on each demo page.
Affects:
The launcher, public website, LMS, student portal, and Support Centre headers.
Purpose:
Gives visitors consistent links between the local website and demo environment.
*/
(() => {
  const selectors = ".launcher__brand, .site-header__brand, .lms-name, .portal-auth-brand, .portal-brand, .admin-brand";
  const labels = ["UNILUS Main Website", "UNILUS Chatbot Demo Environment"];
  const links = ["website.html", "index.html"];

  document.querySelectorAll(selectors).forEach((trigger) => {
    const wrapper = document.createElement("span");
    wrapper.className = "global-brand-menu";
    trigger.parentNode.insertBefore(wrapper, trigger);
    wrapper.appendChild(trigger);
    if (trigger.classList.contains("site-header__brand")) wrapper.classList.add("global-brand-menu--site");

    const menu = document.createElement("span");
    menu.className = "global-brand-menu__panel";
    menu.hidden = true;
    menu.setAttribute("role", "menu");
    links.forEach((href, index) => {
      const link = document.createElement("a");
      link.href = href;
      link.textContent = labels[index];
      link.setAttribute("role", "menuitem");
      menu.appendChild(link);
    });
    wrapper.appendChild(menu);
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", "false");

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      const open = menu.hidden;
      document.querySelectorAll(".global-brand-menu__panel").forEach((other) => { other.hidden = true; });
      document.querySelectorAll("[aria-haspopup='menu']").forEach((other) => other.setAttribute("aria-expanded", "false"));
      menu.hidden = !open;
      trigger.setAttribute("aria-expanded", String(open));
      if (open) menu.classList.add("is-open");
      else menu.classList.remove("is-open");
    });
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest(".global-brand-menu")) return;
    document.querySelectorAll(".global-brand-menu__panel").forEach((menu) => { menu.hidden = true; menu.classList.remove("is-open"); });
    document.querySelectorAll("[aria-haspopup='menu']").forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll(".global-brand-menu__panel").forEach((menu) => { menu.hidden = true; menu.classList.remove("is-open"); });
    document.querySelectorAll("[aria-haspopup='menu']").forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
  });
})();
