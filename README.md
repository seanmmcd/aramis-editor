# Aramis Editor

A desktop photo editor for library management, non-destructive develop adjustments, and batch export. Built with **Tauri 2**, **Rust**, and **React**.

Aramis Editor runs locally on your machine. Your photos, catalog, and edit history stay on disk — nothing is uploaded to a cloud service.

## Features

- **Library** — Import folders, browse photos with thumbnails, view EXIF metadata
- **Develop** — Non-destructive editing: Basic, Detail, Effects, Crop, Transform, Lens
- **RAW support** — CR2, NEF, ARW, DNG, and more via [rawloader](https://github.com/pedrocr/rawloader)
- **Edit stack** — Tone curve, HSL, color grading, calibration, crop, transform, lens, detail, effects
- **Presets, history & snapshots** — Save and recall edit states in a SQLite catalog
- **XMP sidecars** — Read and write standard Camera Raw settings sidecar files
- **Export** — JPEG, PNG, TIFF with quality, resize, and upscale options

## Screenshots

_Screenshots coming soon._

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform

## Getting started

Clone the repository and install dependencies:

```bash
git clone https://github.com/YOUR_USERNAME/aramis-editor.git
cd aramis-editor
npm install
```

Run in development mode (Vite dev server + Tauri window):

```bash
npm run tauri dev
```

Build a production executable:

```bash
npm run build:app
```

The release binary is written to `src-tauri/target/release/`.

### Windows shortcut

- **Quick launch:** `scripts\launch-aramis-editor.bat` builds (if needed) and starts the release binary.
- **Start Menu:** run `scripts\create-start-menu-shortcut.ps1` to create a shortcut.

## Tech stack

| Layer    | Technology                            |
|----------|---------------------------------------|
| Shell    | Tauri 2                               |
| Backend  | Rust (rawloader, image, rusqlite)     |
| Frontend | React 18, TypeScript, Vite, Tailwind  |
| State    | Zustand                               |

## Project structure

```
src/              React frontend (Library, Develop, Export modules)
src-tauri/src/    Rust backend (catalog, pipeline, edits, export, XMP)
docs/             Architecture notes
scripts/          Launch and setup helpers
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for module layout, edit pipeline, and roadmap.

## Privacy

Aramis Editor is a local-first application:

- Photos and folders are accessed only from paths you choose.
- The catalog (`catalog.db`) and generated thumbnails are stored in your OS app-data directory, not in this repository.
- There is no built-in telemetry, analytics, or network sync.

## License

MIT — see [LICENSE](LICENSE).

Third-party licenses (including LGPL components) are documented in [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES).
