document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll("[data-showcase-tab]");
  const screens = document.querySelectorAll("[data-showcase-screen]");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.showcaseTab;

      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", active ? "true" : "false");
      });
      screens.forEach((screen) => {
        screen.classList.toggle(
          "is-active",
          screen.dataset.showcaseScreen === target
        );
      });
    });
  });
});
