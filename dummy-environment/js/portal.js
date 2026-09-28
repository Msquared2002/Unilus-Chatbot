(function () {
  const SESSION_KEY = "unilusDemoSession";

  if (sessionStorage.getItem(SESSION_KEY) !== "authenticated") {
    window.location.replace("portal-login.html");
    return;
  }

  const sidebar = document.querySelector(".portal-sidebar");
  const menuButton = document.querySelector(".portal-menu-toggle");
  menuButton?.addEventListener("click", () => {
    const open = sidebar.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(open));
  });
  document
    .querySelector("[data-logout]")
    ?.addEventListener("click", (event) => {
      event.preventDefault();
      sessionStorage.removeItem(SESSION_KEY);
      window.location.replace("portal-login.html");
    });
})();
