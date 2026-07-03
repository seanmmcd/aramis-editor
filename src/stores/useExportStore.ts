import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Photo } from "@/features/library/types";
import type {
  BatchExportResult,
  ExportResult,
  ExportSettings,
} from "@/types/edits";
import { DEFAULT_EXPORT_SETTINGS } from "@/types/edits";

interface ExportProgress {
  current: number;
  total: number;
  currentFile: string | null;
}

interface ExportState {
  settings: ExportSettings;
  workingSetPhotos: Photo[];
  selectedPhotoIds: number[];
  isExporting: boolean;
  progress: ExportProgress;
  lastOutputFolder: string | null;
  error: string | null;
  setSettings: (patch: Partial<ExportSettings>) => void;
  addToWorkingSet: (photos: Photo[]) => void;
  removeFromWorkingSet: (id: number) => void;
  clearWorkingSet: () => void;
  setSelectedPhotoIds: (ids: number[]) => void;
  togglePhoto: (id: number) => void;
  pickOutputFolder: () => Promise<void>;
  exportPhoto: (photoId: number) => Promise<ExportResult | null>;
  exportBatch: () => Promise<BatchExportResult | null>;
  openExportFolder: (path?: string) => Promise<void>;
  resetProgress: () => void;
}

function mergePhotos(existing: Photo[], incoming: Photo[]): Photo[] {
  const byId = new Map(existing.map((p) => [p.id, p]));
  for (const photo of incoming) {
    byId.set(photo.id, photo);
  }
  return Array.from(byId.values());
}

export const useExportStore = create<ExportState>((set, get) => ({
  settings: { ...DEFAULT_EXPORT_SETTINGS },
  workingSetPhotos: [],
  selectedPhotoIds: [],
  isExporting: false,
  progress: { current: 0, total: 0, currentFile: null },
  lastOutputFolder: null,
  error: null,

  setSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch }, error: null })),

  addToWorkingSet: (photos) => {
    if (photos.length === 0) return;
    set((s) => {
      const workingSetPhotos = mergePhotos(s.workingSetPhotos, photos);
      const newIds = photos.map((p) => p.id);
      const selectedPhotoIds = [
        ...new Set([...s.selectedPhotoIds, ...newIds]),
      ];
      return { workingSetPhotos, selectedPhotoIds, error: null };
    });
  },

  removeFromWorkingSet: (id) =>
    set((s) => ({
      workingSetPhotos: s.workingSetPhotos.filter((p) => p.id !== id),
      selectedPhotoIds: s.selectedPhotoIds.filter((x) => x !== id),
    })),

  clearWorkingSet: () => set({ workingSetPhotos: [], selectedPhotoIds: [] }),

  setSelectedPhotoIds: (ids) => set({ selectedPhotoIds: ids }),

  togglePhoto: (id) =>
    set((s) => ({
      selectedPhotoIds: s.selectedPhotoIds.includes(id)
        ? s.selectedPhotoIds.filter((x) => x !== id)
        : [...s.selectedPhotoIds, id],
    })),

  pickOutputFolder: async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Choose export folder",
    });
    if (typeof selected === "string") {
      set((s) => ({
        settings: { ...s.settings, output_folder: selected },
        lastOutputFolder: selected,
        error: null,
      }));
    }
  },

  exportPhoto: async (photoId) => {
    const { settings } = get();
    if (!settings.output_folder) {
      set({ error: "Choose an output folder first." });
      return null;
    }
    set({ isExporting: true, error: null, progress: { current: 0, total: 1, currentFile: null } });
    try {
      const result = await invoke<ExportResult>("export_photo_cmd", {
        photoId,
        settings,
      });
      set({
        progress: { current: 1, total: 1, currentFile: result.output_path },
        lastOutputFolder: settings.output_folder,
      });
      return result;
    } catch (error) {
      set({ error: String(error) });
      return null;
    } finally {
      set({ isExporting: false });
    }
  },

  exportBatch: async () => {
    const { settings, selectedPhotoIds } = get();
    if (!settings.output_folder) {
      set({ error: "Choose an output folder first." });
      return null;
    }
    if (selectedPhotoIds.length === 0) {
      set({ error: "Select at least one photo to export." });
      return null;
    }

    set({
      isExporting: true,
      error: null,
      progress: { current: 0, total: selectedPhotoIds.length, currentFile: null },
    });

    try {
      const result = await invoke<BatchExportResult>("export_batch_cmd", {
        photoIds: selectedPhotoIds,
        settings,
      });
      const lastSuccess = [...result.items]
        .reverse()
        .find((item) => item.result)?.result;
      set({
        progress: {
          current: selectedPhotoIds.length,
          total: selectedPhotoIds.length,
          currentFile: lastSuccess?.output_path ?? null,
        },
        lastOutputFolder: settings.output_folder,
      });
      if (result.failed > 0) {
        set({ error: `${result.failed} photo(s) failed to export.` });
      }
      return result;
    } catch (error) {
      set({ error: String(error) });
      return null;
    } finally {
      set({ isExporting: false });
    }
  },

  openExportFolder: async (path) => {
    const folder = path ?? get().lastOutputFolder ?? get().settings.output_folder;
    if (!folder) return;
    try {
      await invoke("open_export_folder", { path: folder });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  resetProgress: () =>
    set({ progress: { current: 0, total: 0, currentFile: null }, error: null }),
}));

/** Push library filmstrip selection into the export working set. */
export function syncLibrarySelectionToExportQueue(
  selectedIds: number[],
  libraryPhotos: Photo[],
) {
  const selected = libraryPhotos.filter((p) => selectedIds.includes(p.id));
  if (selected.length > 0) {
    useExportStore.getState().addToWorkingSet(selected);
  }
}
