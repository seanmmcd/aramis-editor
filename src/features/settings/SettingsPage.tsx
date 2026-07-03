import { useEffect } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { RangeSlider } from "@/components/layout/RangeSlider";
import type { ColorSpace, ExportFormat, ResizeMode, UpscaleFactor } from "@/types/edits";
import { DEFAULT_EXPORT_SETTINGS } from "@/types/edits";
import { useAppSettingsStore } from "@/stores/useAppSettingsStore";
import { DEFAULT_HIGHLIGHT_COLOR, DEFAULT_TEXT_COLOR_DARK, DEFAULT_TEXT_COLOR_LIGHT } from "@/lib/theme";

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "tiff", label: "TIFF" },
  { value: "original", label: "Original" },
];

const COLOR_SPACES: { value: ColorSpace; label: string }[] = [
  { value: "srgb", label: "sRGB" },
  { value: "rgb1998", label: "Adobe RGB (1998)" },
  { value: "pro_photo", label: "ProPhoto RGB" },
];

const RESIZE_MODES: { value: ResizeMode; label: string }[] = [
  { value: "original", label: "Original size" },
  { value: "long_edge", label: "Long edge" },
  { value: "dimensions", label: "Custom dimensions" },
];

const UPSCALE_OPTIONS: { value: UpscaleFactor; label: string }[] = [
  { value: "x1", label: "1x" },
  { value: "x1_5", label: "1.5x" },
  { value: "x2", label: "2x" },
  { value: "x4", label: "4x" },
];

const MAX_THREADS = Math.max(1, navigator.hardwareConcurrency || 8);

export function SettingsPage() {
  const {
    settings,
    loaded,
    saving,
    error,
    loadSettings,
    setExportThreadCount,
    setExportDefaults,
    setThemeMode,
    setHighlightColor,
    setTextColor,
    saveSettings,
  } = useAppSettingsStore();

  useEffect(() => {
    if (!loaded) void loadSettings();
  }, [loaded, loadSettings]);

  const defaults = settings.export_defaults;
  const defaultTextColor =
    settings.theme_mode === "light" ? DEFAULT_TEXT_COLOR_LIGHT : DEFAULT_TEXT_COLOR_DARK;
  const threadLabel =
    settings.export_thread_count === 0
      ? `Auto (${MAX_THREADS} threads)`
      : `${settings.export_thread_count} thread${settings.export_thread_count === 1 ? "" : "s"}`;

  const onBrowseOutputFolder = async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: "Choose default batch export folder",
    });
    if (typeof selected === "string") {
      setExportDefaults({ output_folder: selected });
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <header className="border-b border-ae-border px-6 py-4">
        <h1 className="text-lg font-semibold text-ae-text-primary">Settings</h1>
        <p className="text-sm text-ae-text-secondary">
          Configure appearance, export performance, and default export options.
        </p>
      </header>

      <div className="mx-auto w-full max-w-2xl space-y-8 p-6">
        <section className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-ae-text-secondary">
            Appearance
          </h2>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-ae-text-secondary">Theme</span>
            <select
              value={settings.theme_mode}
              onChange={(e) => setThemeMode(e.target.value as "dark" | "light")}
              className="rounded border border-ae-border bg-ae-bg-panel px-2 py-1 text-ae-text-primary"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-ae-text-primary">Highlight color</span>
            <span className="text-xs text-ae-text-secondary">
              Used for accents, active tabs, buttons, sliders, and checkboxes.
            </span>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.highlight_color}
                onChange={(e) => setHighlightColor(e.target.value)}
                className="h-9 w-14 cursor-pointer rounded border border-ae-border bg-ae-bg-panel"
              />
              <input
                type="text"
                value={settings.highlight_color}
                onChange={(e) => setHighlightColor(e.target.value)}
                placeholder={DEFAULT_HIGHLIGHT_COLOR}
                className="min-w-0 flex-1 rounded border border-ae-border bg-ae-bg-panel px-2 py-1 font-mono text-xs text-ae-text-primary"
              />
              <button
                type="button"
                onClick={() => setHighlightColor(DEFAULT_HIGHLIGHT_COLOR)}
                className="shrink-0 rounded bg-ae-bg-panel px-2 py-1 text-xs text-ae-text-primary hover:bg-ae-border"
              >
                Reset
              </button>
            </div>
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-ae-text-primary">Text color</span>
            <span className="text-xs text-ae-text-secondary">
              Overrides the primary text color across the app. Leave empty to use the theme default.
            </span>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.text_color || defaultTextColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="h-9 w-14 cursor-pointer rounded border border-ae-border bg-ae-bg-panel"
              />
              <input
                type="text"
                value={settings.text_color}
                onChange={(e) => setTextColor(e.target.value)}
                placeholder={defaultTextColor}
                className="min-w-0 flex-1 rounded border border-ae-border bg-ae-bg-panel px-2 py-1 font-mono text-xs text-ae-text-primary"
              />
              <button
                type="button"
                onClick={() => setTextColor("")}
                className="shrink-0 rounded bg-ae-bg-panel px-2 py-1 text-xs text-ae-text-primary hover:bg-ae-border"
              >
                Reset
              </button>
            </div>
          </label>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-ae-text-secondary">
            Performance
          </h2>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-ae-text-primary">Export parallel threads</span>
            <span className="text-xs text-ae-text-secondary">
              Batch exports process multiple photos at once. Set to Auto to use all logical CPUs (
              {MAX_THREADS}).
            </span>
            <RangeSlider
              min={0}
              max={MAX_THREADS}
              value={settings.export_thread_count}
              resetValue={0}
              onChange={setExportThreadCount}
            />
            <span className="text-xs text-ae-text-secondary">{threadLabel}</span>
          </label>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-ae-text-secondary">
            Export defaults
          </h2>
          <p className="text-xs text-ae-text-secondary">
            Used as starting values in Quick Export and Batch Export. Single-photo exports always
            save beside the source image in an <code className="text-ae-text-primary">Exports</code>{" "}
            folder.
          </p>

          <div className="space-y-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ae-text-secondary">Format</span>
              <select
                value={defaults.format}
                onChange={(e) =>
                  setExportDefaults({ format: e.target.value as ExportFormat })
                }
                className="rounded border border-ae-border bg-ae-bg-panel px-2 py-1 text-ae-text-primary"
              >
                {FORMATS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            {defaults.format === "jpeg" && (
              <label className="flex flex-col gap-1">
                <span className="text-xs text-ae-text-secondary">
                  JPEG quality ({defaults.quality})
                </span>
                <RangeSlider
                  min={1}
                  max={100}
                  value={defaults.quality}
                  resetValue={DEFAULT_EXPORT_SETTINGS.quality}
                  onChange={(quality) => setExportDefaults({ quality })}
                />
              </label>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-xs text-ae-text-secondary">Color space</span>
              <select
                value={defaults.color_space}
                onChange={(e) =>
                  setExportDefaults({ color_space: e.target.value as ColorSpace })
                }
                className="rounded border border-ae-border bg-ae-bg-panel px-2 py-1 text-ae-text-primary"
              >
                {COLOR_SPACES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-ae-text-secondary">Resize</span>
              <select
                value={defaults.resize_mode}
                onChange={(e) =>
                  setExportDefaults({ resize_mode: e.target.value as ResizeMode })
                }
                className="rounded border border-ae-border bg-ae-bg-panel px-2 py-1 text-ae-text-primary"
              >
                {RESIZE_MODES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            {defaults.resize_mode === "long_edge" && (
              <label className="flex flex-col gap-1">
                <span className="text-xs text-ae-text-secondary">Long edge (px)</span>
                <input
                  type="number"
                  min={1}
                  value={defaults.long_edge}
                  onChange={(e) => setExportDefaults({ long_edge: Number(e.target.value) })}
                  className="rounded border border-ae-border bg-ae-bg-panel px-2 py-1 text-ae-text-primary"
                />
              </label>
            )}

            {defaults.resize_mode === "dimensions" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ae-text-secondary">Width</span>
                  <input
                    type="number"
                    min={1}
                    value={defaults.width}
                    onChange={(e) => setExportDefaults({ width: Number(e.target.value) })}
                    className="rounded border border-ae-border bg-ae-bg-panel px-2 py-1 text-ae-text-primary"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ae-text-secondary">Height</span>
                  <input
                    type="number"
                    min={1}
                    value={defaults.height}
                    onChange={(e) => setExportDefaults({ height: Number(e.target.value) })}
                    className="rounded border border-ae-border bg-ae-bg-panel px-2 py-1 text-ae-text-primary"
                  />
                </label>
              </div>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-xs text-ae-text-secondary">Upscale</span>
              <select
                value={defaults.upscale_factor}
                onChange={(e) =>
                  setExportDefaults({ upscale_factor: e.target.value as UpscaleFactor })
                }
                className="rounded border border-ae-border bg-ae-bg-panel px-2 py-1 text-ae-text-primary"
              >
                {UPSCALE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-ae-text-secondary">Filename template</span>
              <input
                type="text"
                value={defaults.filename_template}
                onChange={(e) => setExportDefaults({ filename_template: e.target.value })}
                placeholder="{filename}_edited"
                className="rounded border border-ae-border bg-ae-bg-panel px-2 py-1 text-ae-text-primary"
              />
              <span className="text-xs text-ae-text-secondary">
                Use <code className="text-ae-text-primary">{"{filename}"}</code> for the original
                name.
              </span>
            </label>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-ae-text-secondary">
                Default batch output folder
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={defaults.output_folder}
                  placeholder="Choose a folder for multi-photo exports..."
                  className="min-w-0 flex-1 truncate rounded border border-ae-border bg-ae-bg-panel px-2 py-1 text-xs text-ae-text-primary"
                />
                <button
                  type="button"
                  onClick={() => void onBrowseOutputFolder()}
                  className="shrink-0 rounded bg-ae-bg-panel px-2 py-1 text-xs text-ae-text-primary hover:bg-ae-border"
                >
                  Browse
                </button>
              </div>
            </div>
          </div>
        </section>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="button"
          disabled={saving || !loaded}
          onClick={() => void saveSettings()}
          className="rounded bg-ae-accent px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save settings"}
        </button>
      </div>
    </div>
  );
}
