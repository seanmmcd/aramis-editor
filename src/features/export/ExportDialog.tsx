import { IconClose } from "@/components/icons";
import { useEffect } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type { ExportFormat, ResizeMode, UpscaleFactor } from "@/types/edits";
import { useDevelopStore } from "@/stores/useDevelopStore";
import { useExportStore } from "@/stores/useExportStore";
import { useUIStore } from "@/stores/useUIStore";

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "tiff", label: "TIFF" },
  { value: "original", label: "Original" },
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

export function ExportDialog() {
  const dialogOpen = useUIStore((s) => s.exportDialogOpen);
  const setDialogOpen = useUIStore((s) => s.setExportDialogOpen);
  const developPhotoId = useDevelopStore((s) => s.photoId);
  const {
    settings,
    setSettings,
    pickOutputFolder,
    exportPhoto,
    isExporting,
    progress,
    error,
    lastOutputFolder,
    openExportFolder,
    resetProgress,
  } = useExportStore();

  useEffect(() => {
    if (!dialogOpen) resetProgress();
  }, [dialogOpen, resetProgress]);

  if (!dialogOpen) return null;

  const pct =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const onExportCurrent = async () => {
    if (developPhotoId == null) return;
    await exportPhoto(developPhotoId);
  };

  const onBrowse = async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: "Choose export folder",
    });
    if (typeof selected === "string") {
      setSettings({ output_folder: selected });
    } else {
      await pickOutputFolder();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        className="w-full max-w-md rounded-lg border border-ae-border bg-ae-bg-secondary shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-ae-border px-4 py-3">
          <h2 id="export-dialog-title" className="text-sm font-semibold text-ae-text-primary">
            Export Photo
          </h2>
          <button
            type="button"
            onClick={() => setDialogOpen(false)}
            className="text-ae-text-secondary hover:text-ae-text-primary"
            aria-label="Close"
          >
            <IconClose size={14} />
          </button>
        </header>

        <div className="space-y-4 px-4 py-4 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ae-text-secondary">Format</span>
            <select
              value={settings.format}
              onChange={(e) => setSettings({ format: e.target.value as ExportFormat })}
              className="rounded border border-ae-border bg-ae-bg-panel px-2 py-1 text-ae-text-primary"
            >
              {FORMATS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {settings.format === "jpeg" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ae-text-secondary">Quality ({settings.quality})</span>
              <input
                type="range"
                min={1}
                max={100}
                value={settings.quality}
                onChange={(e) => setSettings({ quality: Number(e.target.value) })}
                className="accent-ae-accent"
              />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs text-ae-text-secondary">Resize</span>
            <select
              value={settings.resize_mode}
              onChange={(e) => setSettings({ resize_mode: e.target.value as ResizeMode })}
              className="rounded border border-ae-border bg-ae-bg-panel px-2 py-1 text-ae-text-primary"
            >
              {RESIZE_MODES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {settings.resize_mode === "long_edge" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ae-text-secondary">Long edge (px)</span>
              <input
                type="number"
                min={1}
                value={settings.long_edge}
                onChange={(e) => setSettings({ long_edge: Number(e.target.value) })}
                className="rounded border border-ae-border bg-ae-bg-panel px-2 py-1 text-ae-text-primary"
              />
            </label>
          )}

          {settings.resize_mode === "dimensions" && (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-ae-text-secondary">Width</span>
                <input
                  type="number"
                  min={1}
                  value={settings.width}
                  onChange={(e) => setSettings({ width: Number(e.target.value) })}
                  className="rounded border border-ae-border bg-ae-bg-panel px-2 py-1 text-ae-text-primary"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-ae-text-secondary">Height</span>
                <input
                  type="number"
                  min={1}
                  value={settings.height}
                  onChange={(e) => setSettings({ height: Number(e.target.value) })}
                  className="rounded border border-ae-border bg-ae-bg-panel px-2 py-1 text-ae-text-primary"
                />
              </label>
            </div>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs text-ae-text-secondary">Upscale</span>
            <select
              value={settings.upscale_factor}
              onChange={(e) => setSettings({ upscale_factor: e.target.value as UpscaleFactor })}
              className="rounded border border-ae-border bg-ae-bg-panel px-2 py-1 text-ae-text-primary"
            >
              {UPSCALE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-ae-text-secondary">Output folder</span>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={settings.output_folder}
                placeholder="Choose a folder..."
                className="min-w-0 flex-1 truncate rounded border border-ae-border bg-ae-bg-panel px-2 py-1 text-xs text-ae-text-primary"
              />
              <button
                type="button"
                onClick={() => void onBrowse()}
                className="shrink-0 rounded bg-ae-bg-panel px-2 py-1 text-xs text-ae-text-primary hover:bg-ae-border"
              >
                Browse
              </button>
            </div>
          </div>

          {isExporting && (
            <div className="space-y-1">
              <div className="h-2 overflow-hidden rounded-full bg-ae-border">
                <div
                  className="h-full bg-ae-accent transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-ae-text-secondary">
                Exporting... {progress.current} / {progress.total}
              </p>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-ae-border px-4 py-3">
          {lastOutputFolder ? (
            <button
              type="button"
              onClick={() => void openExportFolder()}
              className="text-xs text-ae-accent hover:underline"
            >
              Open folder
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="rounded px-3 py-1 text-xs text-ae-text-secondary hover:text-ae-text-primary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isExporting || developPhotoId == null || !settings.output_folder}
              onClick={() => void onExportCurrent()}
              className="rounded bg-ae-accent px-3 py-1 text-xs text-white disabled:opacity-40"
            >
              Export
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
