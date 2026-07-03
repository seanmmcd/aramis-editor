import { IconClose } from "@/components/icons";
import { useEffect } from "react";
import { RangeSlider } from "@/components/layout/RangeSlider";
import { Spinner } from "@/components/Spinner";
import type { ExportFormat, ResizeMode, UpscaleFactor } from "@/types/edits";
import { DEFAULT_EXPORT_SETTINGS } from "@/types/edits";
import { useDevelopStore } from "@/stores/useDevelopStore";
import { useExportStore } from "@/stores/useExportStore";
import { useUIStore } from "@/stores/useUIStore";
import { folderFromOutputPath, notifyExportSuccess } from "@/stores/useToastStore";

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
    exportPhoto,
    isExporting,
    error,
    resetProgress,
  } = useExportStore();

  useEffect(() => {
    if (!dialogOpen) resetProgress();
  }, [dialogOpen, resetProgress]);

  if (!dialogOpen) return null;

  const onExportCurrent = async () => {
    if (developPhotoId == null) return;
    const result = await exportPhoto(developPhotoId);
    if (result) {
      setDialogOpen(false);
      notifyExportSuccess(folderFromOutputPath(result.output_path));
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
              <RangeSlider
                min={1}
                max={100}
                value={settings.quality}
                resetValue={DEFAULT_EXPORT_SETTINGS.quality}
                onChange={(quality) => setSettings({ quality })}
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

          <p className="text-xs text-ae-text-secondary">
            Saves to an <span className="text-ae-text-primary">Exports</span> folder next to the
            source image.
          </p>

          {isExporting && (
            <div className="flex items-center gap-2 text-xs text-ae-text-secondary">
              <Spinner size={16} />
              <span>Exporting photo…</span>
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-ae-border px-4 py-3">
          <div className="flex gap-2">            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="rounded px-3 py-1 text-xs text-ae-text-secondary hover:text-ae-text-primary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isExporting || developPhotoId == null}
              onClick={() => void onExportCurrent()}
              className="flex items-center gap-1.5 rounded bg-ae-accent px-3 py-1 text-xs text-white disabled:opacity-40"
            >
              {isExporting && <Spinner size={12} className="border-white/30 border-t-white" />}
              Export
            </button>          </div>
        </footer>
      </div>
    </div>
  );
}
