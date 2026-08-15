(function () {
  const DEMO_USERNAME = "demo";
  const DEMO_PASSWORD = "unilus demo";
  const SESSION_KEY = "unilusDemoSession";
  const form = document.querySelector("[data-portal-login]");
  const usernameInput = document.querySelector("#portal-username");
  const passwordInput = document.querySelector("#portal-password");
  const errorMessage = document.querySelector("[data-login-error]");

  function showError(message) {
    if (errorMessage) {
      errorMessage.textContent = message;
    }
  }

  function clearError() {
    showError("");
  }

  usernameInput?.addEventListener("input", clearError);
  passwordInput?.addEventListener("input", clearError);

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    clearError();

    const username = usernameInput?.value.trim() ?? "";
    const password = passwordInput?.value ?? "";

    if (username !== DEMO_USERNAME || password !== DEMO_PASSWORD) {
      showError("Incorrect demo credentials. Try demo / unilus demo.");
      return;
    }

    sessionStorage.setItem(SESSION_KEY, "authenticated");
    window.location.replace("portal.html");
  });
})();
