(function () {
  const year = new Date().getFullYear();
  document.querySelectorAll("[data-year]").forEach((node) => {
    node.textContent = year;
  });
  const menuButton = document.querySelector(".site-header__toggle");
  const nav = document.querySelector(".site-nav");
  menuButton?.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(open));
  });
  const toast = document.querySelector(".demo-toast");
  let toastTimer;
  window.showDemoToast = function (message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
  };
  document.querySelectorAll("[data-demo-action]").forEach((button) =>
    button.addEventListener("click", (event) => {
      event.preventDefault();
      window.showDemoToast(
        "Demonstration only - no live service is connected.",
      );
    }),
  );
})();
