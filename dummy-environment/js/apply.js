(function () {
  const form = document.querySelector("[data-demo-application]");
  const message = document.querySelector("[data-application-message]");

  form?.addEventListener("submit", (event) => {
    event.preventDefault();

    if (message) {
      message.textContent =
        "Demo enquiry recorded locally for this page only. No application was submitted.";
    }
  });
})();
