(function () {
  const SESSION_KEY = "unilusDemoSession";

  if (sessionStorage.getItem(SESSION_KEY) !== "authenticated") {
    window.location.replace("portal-login.html");
    return;
  }

  const student = window.UnilusDemoSession.currentStudent();
  if (!student) {
    window.UnilusDemoSession.logout();
    window.location.replace("portal-login.html");
    return;
  }
  document.querySelectorAll("[data-demo-identity]").forEach((element) => {
    element.textContent = student.username;
  });
  document.querySelectorAll("[data-demo-programme]").forEach((element) => {
    element.textContent = student.programmeName;
  });

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
      window.UnilusDemoSession.logout();
      window.dispatchEvent(new Event("unilus-student-context-changed"));
      window.location.replace("portal-login.html?v=programme-session-2");
    });
})();
