# Aramis Editor: Architecture Plan

A high-performance desktop photo editor focused on library management and
non-destructive develop adjustments (excluding pixel-level retouching and
generative removal tools).

## Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Shell | **Tauri 2** | Native performance, Rust backend, cross-platform |
| UI | **React 18 + TypeScript + Vite** | Component model fits panel-based editing UI |
| Styling | **Tailwind CSS** + custom dark theme tokens | Consistent dark editing UI |
| RAW decode | **rawloader** (Rust) | NEF, CR2, CR3, ARW, DNG, RAF, ORF, RW2 |
| Image pipeline | **Rust `image` crate + custom tone ops** | Non-destructive edit stack in Rust |
| GPU preview | **wgpu** (future phase) | Real-time loupe at full resolution |
| Catalog | **SQLite (rusqlite)** | Library metadata, edit history, collections |
| Sidecars | **XMP** (Camera Raw settings subset) | Interop with common RAW workflows |

## UI Layout (Develop module)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Top bar: Module picker (Library | Develop | Export)   Search  Sync  │
├────────┬─────────────────────────────────────────────┬───────────────┤
│ Left   │                                             │ Right panel   │
│ panel  │           Main canvas / Loupe               │ (Develop)     │
│        │                                             │               │
│ Presets│                                             │ Basic         │
│ Snap-  │                                             │ Tone Curve    │
│ shots  │                                             │ HSL / Color   │
│ History│                                             │ Split Toning  │
│        │                                             │ Detail        │
│        │                                             │ Lens Corrections│
│        │                                             │ Transform     │
│        │                                             │ Effects       │
│        │                                             │ Calibration   │
├────────┴─────────────────────────────────────────────┴───────────────┤
│ Filmstrip (thumbnail strip)                                          │
└──────────────────────────────────────────────────────────────────────┘
```

## Task Breakdown

| # | Branch | Scope |
|---|--------|-------|
| 1 | `feat/foundation` | Tauri scaffold, Rust workspace, CI, dev scripts |
| 2 | `feat/ui-shell` | App layout shell, theme, module routing |
| 3 | `feat/library` | Folder import, catalog SQLite, grid + filmstrip |
| 4 | `feat/raw-pipeline` | RAW decode, thumbnail gen, preview cache |
| 5 | `feat/basic-edits` | Exposure, WB, tone (highlights/shadows/whites/blacks) |
| 6 | `feat-tone-curve-hsl` | Tone curve, HSL, color grading, calibration |
| 7 | `feat-geometry-detail` | Crop, rotate, lens correction, transform, sharpening, NR |
| 8 | `feat/effects-export` | Vignette, grain, upscaling, export dialog |
| 9 | `feat/presets-history` | Presets, snapshots, history panel, XMP sidecars |

## Edit Pipeline (Non-Destructive)

```
RAW bytes → Decode (linear RGB f32) → Edit stack (ordered params) → Display transform (sRGB) → Canvas
```

Each edit is a parametric adjustment stored in the catalog; the stack is replayed on demand.

## Supported RAW Formats (Phase 1)

NEF (Nikon), CR2/CR3 (Canon), ARW (Sony), DNG, RAF (Fujifilm), ORF (Olympus), RW2 (Panasonic), PEF (Pentax), SRW (Samsung), 3FR (Hasselblad).
