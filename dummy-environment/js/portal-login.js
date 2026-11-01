(function () {
  const session = window.UnilusDemoSession;
  const form = document.querySelector("[data-portal-login]");
  const usernameInput = document.querySelector("#portal-username");
  const passwordInput = document.querySelector("#portal-password");
  const errorMessage = document.querySelector("[data-login-error]");
  const selector = document.querySelector("#portal-programme");

  if (selector) {
    for (const programme of window.UnilusDemoProgrammes.programmes) {
      const option = document.createElement("option");
      option.value = programme.id;
      option.textContent = programme.name;
      selector.appendChild(option);
    }
    selector.addEventListener("change", clearError);
  }

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

    if (!selector?.value) {
      showError("Select a programme for this demo session.");
      return;
    }
    const student = session.login(sessionStorage, username, password, selector.value);
    if (!student) {
      showError("Incorrect demo credentials. Use demo / unilus demo.");
      return;
    }

    window.location.replace("portal.html?v=programme-session-2");
  });
})();
