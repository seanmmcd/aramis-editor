const MODULES = {
  library: {
    title: "Your photo library,<br>on your machine.",
    body: "Import folders, browse RAW and JPEG files with fast thumbnails, and search your entire catalog — no cloud required.",
    features: [
      "Folder import & EXIF metadata",
      "Thumbnail grid with search",
      "Multi-select & filmstrip",
    ],
  },
  develop: {
    title: "Develop with precision,<br>non-destructively.",
    body: "Adjust exposure, color, tone curve, HSL, lens corrections, and more. Every edit is reversible with full history and checkpoints.",
    features: [
      "Basic, Detail, Effects & Crop",
      "Tone curve, HSL & calibration",
      "Presets, history & spot heal",
    ],
  },
  export: {
    title: "Export in batch,<br>your way.",
    body: "Send finished photos to JPEG, PNG, or TIFF with quality, resize, and upscale controls. Export beside your originals or to a custom folder.",
    features: [
      "Batch export queue",
      "JPEG, PNG & TIFF output",
      "Quality, resize & upscale",
    ],
  },
};

const MODULE_ORDER = ["library", "develop", "export"];

document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll("[data-module]");
  const screens = document.querySelectorAll("[data-preview-screen]");
  const pitch = document.querySelector(".pitch");
  const titleEl = document.querySelector("[data-pitch-title]");
  const bodyEl = document.querySelector("[data-pitch-body]");
  const featuresEl = document.querySelector("[data-pitch-features]");

  let active = "library";

  function setModule(name) {
    if (!MODULES[name] || name === active) return;
    active = name;

    tabs.forEach((tab) => {
      const on = tab.dataset.module === name;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });

    screens.forEach((screen) => {
      screen.classList.toggle(
        "is-active",
        screen.dataset.previewScreen === name
      );
    });

    pitch.classList.add("is-fading");

    window.setTimeout(() => {
      const mod = MODULES[name];
      titleEl.innerHTML = mod.title;
      bodyEl.textContent = mod.body;

      featuresEl.innerHTML = mod.features
        .map((item) => `<li>${item}</li>`)
        .join("");

      pitch.classList.remove("is-fading");
    }, 180);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => setModule(tab.dataset.module));
  });

  document.addEventListener("keydown", (event) => {
    if (event.target.closest("input, textarea, select")) return;

    const idx = MODULE_ORDER.indexOf(active);

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      setModule(MODULE_ORDER[(idx + 1) % MODULE_ORDER.length]);
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      setModule(MODULE_ORDER[(idx - 1 + MODULE_ORDER.length) % MODULE_ORDER.length]);
    }

    if (event.key >= "1" && event.key <= "3") {
      setModule(MODULE_ORDER[Number(event.key) - 1]);
    }
  });
});
