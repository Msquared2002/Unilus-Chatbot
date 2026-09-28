(function () {
  document
    .querySelectorAll(
      ".timeline-controls button,.calendar-nav span,.lms-tools button",
    )
    .forEach((control) =>
      control.addEventListener("click", (event) => {
        event.preventDefault();
        window.showDemoToast("This LMS control is a visual demonstration.");
      }),
    );
  document
    .querySelector(".timeline-controls input")
    ?.addEventListener("input", (event) => {
      const query = event.target.value.toLowerCase();
      document
        .querySelectorAll(".timeline-event b,.upcoming b")
        .forEach((item) => {
          item
            .closest(".timeline-event,.upcoming")
            ?.classList.toggle(
              "is-filtered",
              Boolean(query && !item.textContent.toLowerCase().includes(query)),
            );
        });
    });
})();
