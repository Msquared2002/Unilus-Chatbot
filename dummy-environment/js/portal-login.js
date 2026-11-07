(function () {
  const session = window.UnilusDemoSession;
  const API = window.UNILUS_API_BASE || "http://localhost:5000/api";
  const form = document.querySelector("[data-portal-login]");
  const usernameInput = document.querySelector("#portal-username");
  const passwordInput = document.querySelector("#portal-password");
  const errorMessage = document.querySelector("[data-login-error]");
  const selector = document.querySelector("#portal-programme");
  const submitButton = form?.querySelector("button[type=submit], input[type=submit]");

  // The backend account stores a short programme code. The portal pages use
  // the prospectus catalogue ids, so this table connects the two.
  // Add a line here for each programme code a student account can have.
  const PROGRAMME_BY_CODE = {
    BIT: "bachelor-of-science-in-information-systems-and-technology",
    BCS: "bachelor-of-science-in-computer-science"
  };
  // Only used if the backend cannot be reached (offline demo).
  const OFFLINE_DEFAULT_PROGRAMME = PROGRAMME_BY_CODE.BIT;

  // Students no longer pick a programme: the account already knows it.
  if (selector) {
    selector.required = false;
    selector.removeAttribute("required");
    const wrapper = selector.closest("label, .form-field, .field");
    (wrapper && wrapper !== form ? wrapper : selector).hidden = true;
  }

  function showError(message) {
    if (errorMessage) errorMessage.textContent = message;
  }
  function clearError() { showError(""); }
  function setBusy(busy) {
    if (submitButton) submitButton.disabled = busy;
  }

  usernameInput?.addEventListener("input", clearError);
  passwordInput?.addEventListener("input", clearError);

  // Resolves to { user, token } on success, { error } for a refused sign-in,
  // or null when the backend is unavailable (so the offline demo can take over).
  async function backendLogin(username, password) {
    let response;
    try {
      response = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
    } catch {
      return null;
    }
    if (response.status === 503) return null;
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { error: body.error || "Sign-in failed. Please try again." };
    return { user: body.user, token: body.token };
  }

  function finish(programmeId, token) {
    const student = session.startSession(sessionStorage, programmeId);
    if (!student) return false;
    try {
      if (token) sessionStorage.setItem("unilusAuthToken", token);
      else sessionStorage.removeItem("unilusAuthToken");
      sessionStorage.removeItem("unilusChatSession"); // new sign-in, new conversation
    } catch { /* ignore */ }
    window.location.replace("portal.html?v=programme-session-2");
    return true;
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();

    const username = usernameInput?.value.trim() ?? "";
    const password = passwordInput?.value ?? "";
    if (!username || !password) {
      showError("Enter your username and password.");
      return;
    }

    setBusy(true);
    try {
      const result = await backendLogin(username, password);

      if (result && result.error) {
        showError(result.error);
        return;
      }

      if (result) {
        if (result.user.role !== "student") {
          showError("This is the student portal. Staff sign in through the Support Centre.");
          return;
        }
        const code = String(result.user.programme || "").trim().toUpperCase();
        const programmeId = PROGRAMME_BY_CODE[code] || session.canonicalProgramme(result.user.programme)?.id;
        if (!programmeId) {
          showError("Your account's programme is not set up in the portal yet. Please contact support.");
          return;
        }
        finish(programmeId, result.token);
        return;
      }

      // Backend unavailable: fall back to the local demo account so a demo never dead-ends.
      const offline = session.authenticate(username, password, OFFLINE_DEFAULT_PROGRAMME);
      if (!offline) {
        showError("Cannot reach the chatbot server, and these are not the offline demo details (demo / unilus demo).");
        return;
      }
      finish(offline.programmeId, null);
    } finally {
      setBusy(false);
    }
  });
})();
