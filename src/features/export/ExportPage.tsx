import { convertFileSrc } from "@tauri-apps/api/core";
import type { ExportFormat, ResizeMode, UpscaleFactor } from "@/types/edits";
import { useExportStore } from "@/stores/useExportStore";

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

export function ExportPage() {
  const workingSetPhotos = useExportStore((s) => s.workingSetPhotos);
  const selectedPhotoIds = useExportStore((s) => s.selectedPhotoIds);
  const {
    settings,
    setSettings,
    pickOutputFolder,
    exportBatch,
    isExporting,
    progress,
    error,
    lastOutputFolder,
    openExportFolder,
    setSelectedPhotoIds,
    togglePhoto,
    removeFromWorkingSet,
    clearWorkingSet,
  } = useExportStore();

  const pct =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const selectAll = () => setSelectedPhotoIds(workingSetPhotos.map((p) => p.id));
  const selectNone = () => setSelectedPhotoIds([]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="border-b border-ae-border px-6 py-4">
        <h1 className="text-lg font-semibold text-ae-text-primary">Batch Export</h1>
        <p className="text-sm text-ae-text-secondary">
          Export photos from your working set. Add photos from Library via &ldquo;Add to
          Export&rdquo;.
        </p>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col border-r border-ae-border">
          <div className="flex items-center gap-2 border-b border-ae-border px-4 py-2">
            <span className="text-xs text-ae-text-secondary">
              {selectedPhotoIds.length} of {workingSetPhotos.length} selected
            </span>
            {workingSetPhotos.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-ae-accent hover:underline"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={selectNone}
                  className="text-xs text-ae-text-secondary hover:underline"
                >
                  Clear selection
                </button>
                <button
                  type="button"
                  onClick={clearWorkingSet}
                  className="ml-auto text-xs text-ae-text-secondary hover:underline"
                >
                  Clear working set
                </button>
              </>
            )}
          </div>

          <div className="flex-1 overflow-auto p-4">
            {workingSetPhotos.length === 0 ? (
              <p className="text-sm text-ae-text-secondary">
                No photos in the export queue. Select photos in Library and click
                &ldquo;Add to Export&rdquo;, or use Batch Export with a selection.
              </p>
            ) : (
              <ul className="space-y-2">
                {workingSetPhotos.map((photo) => {
                  const checked = selectedPhotoIds.includes(photo.id);
                  const thumb = photo.thumbnail_path
                    ? convertFileSrc(photo.thumbnail_path)
                    : undefined;
                  return (
                    <li key={photo.id}>
                      <div className="flex items-center gap-2 rounded border border-ae-border bg-ae-bg-panel px-3 py-2 hover:bg-ae-bg-secondary">
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePhoto(photo.id)}
                            className="accent-ae-accent"
                          />
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-ae-bg-primary">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <span className="truncate text-sm text-ae-text-primary">
                            {photo.file_name}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeFromWorkingSet(photo.id)}
                          className="shrink-0 text-xs text-ae-text-secondary hover:text-red-400"
                          aria-label={`Remove ${photo.file_name} from export queue`}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <aside className="flex w-80 shrink-0 flex-col overflow-y-auto p-4">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-ae-text-secondary">
            Settings
          </h2>

          <div className="space-y-3 text-sm">
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
                <span className="text-xs text-ae-text-secondary">
                  Quality ({settings.quality})
                </span>
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
                onChange={(e) =>
                  setSettings({ upscale_factor: e.target.value as UpscaleFactor })
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
                  onClick={() => void pickOutputFolder()}
                  className="shrink-0 rounded bg-ae-bg-panel px-2 py-1 text-xs text-ae-text-primary hover:bg-ae-border"
                >
                  Browse
                </button>
              </div>
            </div>
          </div>

          {isExporting && (
            <div className="mt-4 space-y-1">
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

          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              disabled={
                isExporting ||
                selectedPhotoIds.length === 0 ||
                !settings.output_folder
              }
              onClick={() => void exportBatch()}
              className="rounded bg-ae-accent px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              Export {selectedPhotoIds.length} photo
              {selectedPhotoIds.length === 1 ? "" : "s"}
            </button>
            {lastOutputFolder && (
              <button
                type="button"
                onClick={() => void openExportFolder()}
                className="text-xs text-ae-accent hover:underline"
              >
                Open export folder
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
