import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  BasicEdits,
  CalibrationEdits,
  CropEdits,
  DetailEdits,
  EditStack,
  EffectsEdits,
  HslEdits,
  LensEdits,
  ParametricCurve,
  TransformEdits,
} from "@/types/edits";
import {
  DEFAULT_EDIT_STACK,
  maskEditsForPreview,
  type DisabledSections,
  type EditSectionId,
  type HealSpot,
} from "@/types/edits";
import { notifyDevelopPersist } from "@/stores/editsEvents";
import { useUIStore } from "@/stores/useUIStore";

export type BasicEditKey = keyof BasicEdits;
export type EffectsEditKey = keyof EffectsEdits;

export type DevelopQueueItem = {
  id: number;
  path: string;
  file_name?: string;
  thumbnail_path?: string | null;
};

interface PreviewResponse {
  width: number;
  height: number;
  png_base64: string;
}

interface DevelopState {
  photoPath: string | null;
  photoId: number | null;
  developQueue: DevelopQueueItem[];
  edits: EditStack;
  previewDataUrl: string | null;
  previewDimensions: { width: number; height: number } | null;
  isPreviewLoading: boolean;
  previewError: string | null;
  setPhoto: (path: string | null, photoId?: number | null) => Promise<void>;
  setDevelopQueue: (items: DevelopQueueItem[]) => void;
  openDevelopQueue: (items: DevelopQueueItem[]) => Promise<void>;
  selectQueuePhoto: (id: number) => Promise<void>;
  removeFromDevelopQueue: (id: number) => Promise<void>;
  setEdits: (edits: EditStack) => void;
  setBasicEdit: (key: BasicEditKey, value: number) => void;
  setEffectsEdit: (key: EffectsEditKey, value: number) => void;
  setCrop: (patch: Partial<CropEdits>) => void;
  setTransform: (key: keyof TransformEdits, value: number) => void;
  setLens: (patch: Partial<LensEdits>) => void;
  setDetailEdit: (key: keyof DetailEdits, value: number) => void;
  setToneCurveParametric: (key: keyof ParametricCurve, value: number) => void;
  setHslChannel: (channel: keyof HslEdits, index: number, value: number) => void;
  setCalibration: (key: keyof CalibrationEdits, value: number) => void;
  addHealSpot: (spot: Omit<HealSpot, "id"> & { id?: string }) => void;
  updateHealSpot: (id: string, patch: Partial<HealSpot>) => void;
  removeHealSpot: (id: string) => void;
  clearHealSpots: () => void;
  setPreviewDataUrl: (url: string | null) => void;
  setPreviewDimensions: (dimensions: { width: number; height: number } | null) => void;
  setPreviewLoading: (loading: boolean) => void;
  setPreviewError: (error: string | null) => void;
  allEditsEnabled: boolean;
  disabledSections: DisabledSections;
  isSectionEnabled: (section: EditSectionId) => boolean;
  toggleSectionEdits: (section: EditSectionId) => void;
  toggleAllEdits: () => void;
  resetEditToggles: () => void;
}

export const useDevelopStore = create<DevelopState>((set, get) => ({
  photoPath: null,
  photoId: null,
  developQueue: [],
  edits: structuredClone(DEFAULT_EDIT_STACK),
  previewDataUrl: null,
  previewDimensions: null,
  isPreviewLoading: false,
  previewError: null,
  allEditsEnabled: true,
  disabledSections: {},

  setPhoto: async (path, photoId = null) => {
    let resolvedPhotoId = photoId;
    if (path && photoId == null) {
      try {
        const catalogId = await invoke<number | null>("get_photo_id_by_path", { path });
        if (catalogId != null) {
          resolvedPhotoId = catalogId;
        }
      } catch {
        // Path-only develop is fine when the file is not in the catalog.
      }
    }

    set({
      photoPath: path,
      photoId: resolvedPhotoId,
      previewDataUrl: null,
      previewDimensions: null,
      previewError: null,
      allEditsEnabled: true,
      disabledSections: {},
    });
    if (path) {
      void invoke("warm_preview_cache", { path });
    }
    // Catalog/sidecar edits take priority; otherwise backend auto-detects from RAW/XMP/EXIF metadata.
    if (resolvedPhotoId != null) {
      try {
        const edits = await invoke<EditStack>("get_photo_edits", { photoId: resolvedPhotoId });
        set({ edits: structuredClone(edits) });
      } catch {
        set({ edits: structuredClone(DEFAULT_EDIT_STACK) });
      }
    } else if (path) {
      try {
        const edits = await invoke<EditStack>("get_edits_for_path", { path });
        set({ edits: structuredClone(edits) });
      } catch {
        set({ edits: structuredClone(DEFAULT_EDIT_STACK) });
      }
    } else {
      set({ edits: structuredClone(DEFAULT_EDIT_STACK) });
    }

    if (path) {
      schedulePreviewRefresh({ final: true, skipSave: true });
    }
  },

  setDevelopQueue: (items) => set({ developQueue: items }),

  openDevelopQueue: async (items) => {
    if (items.length === 0) return;
    set({ developQueue: items });
    const first = items[0];
    await get().setPhoto(first.path, first.id);
  },

  selectQueuePhoto: async (id) => {
    const item = get().developQueue.find((q) => q.id === id);
    if (!item) return;
    await get().setPhoto(item.path, item.id);
  },

  removeFromDevelopQueue: async (id) => {
    const { developQueue, photoId } = get();
    const index = developQueue.findIndex((q) => q.id === id);
    if (index === -1) return;

    const newQueue = developQueue.filter((q) => q.id !== id);
    if (newQueue.length === 0) {
      set({
        developQueue: [],
        photoPath: null,
        photoId: null,
        previewDataUrl: null,
        previewDimensions: null,
        previewError: null,
        edits: structuredClone(DEFAULT_EDIT_STACK),
      });
      return;
    }

    set({ developQueue: newQueue });
    if (photoId === id) {
      const next = newQueue[Math.min(index, newQueue.length - 1)];
      await get().setPhoto(next.path, next.id);
    }
  },

  setEdits: (edits) => set({ edits: structuredClone(edits) }),
  setBasicEdit: (key, value) =>
    set((s) => ({
      edits: { ...s.edits, basic: { ...s.edits.basic, [key]: value } },
    })),
  setEffectsEdit: (key, value) =>
    set((s) => ({
      edits: { ...s.edits, effects: { ...s.edits.effects, [key]: value } },
    })),
  setCrop: (patch) =>
    set((s) => ({ edits: { ...s.edits, crop: { ...s.edits.crop, ...patch } } })),
  setTransform: (key, value) =>
    set((s) => ({
      edits: { ...s.edits, transform: { ...s.edits.transform, [key]: value } },
    })),
  setLens: (patch) =>
    set((s) => ({ edits: { ...s.edits, lens: { ...s.edits.lens, ...patch } } })),
  setDetailEdit: (key, value) =>
    set((s) => ({
      edits: { ...s.edits, detail: { ...s.edits.detail, [key]: value } },
    })),
  setToneCurveParametric: (key, value) =>
    set((s) => ({
      edits: {
        ...s.edits,
        tone_curve: {
          ...s.edits.tone_curve,
          parametric: { ...s.edits.tone_curve.parametric, [key]: value },
        },
      },
    })),
  setHslChannel: (channel, index, value) =>
    set((s) => {
      const values = [...s.edits.hsl[channel]];
      values[index] = value;
      return { edits: { ...s.edits, hsl: { ...s.edits.hsl, [channel]: values } } };
    }),
  setCalibration: (key, value) =>
    set((s) => ({
      edits: { ...s.edits, calibration: { ...s.edits.calibration, [key]: value } },
    })),
  addHealSpot: (spot) => {
    const id = spot.id ?? crypto.randomUUID();
    const next: HealSpot = {
      id,
      dest_x: spot.dest_x,
      dest_y: spot.dest_y,
      source_x: spot.source_x,
      source_y: spot.source_y,
      radius: spot.radius,
      mode: spot.mode,
    };
    set((s) => ({
      edits: {
        ...s.edits,
        spot_heal: { spots: [...s.edits.spot_heal.spots, next] },
      },
    }));
    useUIStore.getState().setSelectedHealSpotId(id);
    schedulePreviewRefresh();
  },
  updateHealSpot: (id, patch) => {
    set((s) => ({
      edits: {
        ...s.edits,
        spot_heal: {
          spots: s.edits.spot_heal.spots.map((spot) =>
            spot.id === id ? { ...spot, ...patch } : spot,
          ),
        },
      },
    }));
    schedulePreviewRefresh();
  },
  removeHealSpot: (id) => {
    set((s) => ({
      edits: {
        ...s.edits,
        spot_heal: {
          spots: s.edits.spot_heal.spots.filter((spot) => spot.id !== id),
        },
      },
    }));
    const selected = useUIStore.getState().selectedHealSpotId;
    if (selected === id) {
      useUIStore.getState().setSelectedHealSpotId(null);
    }
    schedulePreviewRefresh();
  },
  clearHealSpots: () => {
    set((s) => ({
      edits: { ...s.edits, spot_heal: { spots: [] } },
    }));
    useUIStore.getState().setSelectedHealSpotId(null);
    schedulePreviewRefresh();
  },
  setPreviewDataUrl: (url) => set({ previewDataUrl: url }),
  setPreviewDimensions: (dimensions) => set({ previewDimensions: dimensions }),
  setPreviewLoading: (loading) => set({ isPreviewLoading: loading }),
  setPreviewError: (error) => set({ previewError: error }),

  isSectionEnabled: (section) => {
    const { allEditsEnabled, disabledSections } = get();
    return allEditsEnabled && !disabledSections[section];
  },

  toggleSectionEdits: (section) => {
    set((s) => ({
      disabledSections: {
        ...s.disabledSections,
        [section]: !s.disabledSections[section],
      },
    }));
    schedulePreviewRefresh();
  },

  toggleAllEdits: () => {
    set((s) => ({ allEditsEnabled: !s.allEditsEnabled }));
    schedulePreviewRefresh();
  },

  resetEditToggles: () => set({ allEditsEnabled: true, disabledSections: {} }),
}));

let previewTimer: ReturnType<typeof setTimeout> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let previewGeneration = 0;
let interactiveEditCount = 0;

const PREVIEW_MIME = "image/jpeg";
const PREVIEW_DEBOUNCE_MS = 16;
const PREVIEW_FINAL_DEBOUNCE_MS = 50;
const SAVE_DEBOUNCE_MS = 500;

function toPreviewDataUrl(base64: string) {
  return `data:${PREVIEW_MIME};base64,${base64}`;
}

function getPreviewEdits(): EditStack {
  const { edits, disabledSections, allEditsEnabled } = useDevelopStore.getState();
  return maskEditsForPreview(edits, disabledSections, allEditsEnabled);
}

async function loadQuickPreview(path: string, applyCrop: boolean) {
  void invoke("warm_preview_cache", { path });
  try {
    const response = await invoke<PreviewResponse>("get_quick_preview", {
      path,
      edits: getPreviewEdits(),
      applyCrop,
    });
    const store = useDevelopStore.getState();
    store.setPreviewDataUrl(toPreviewDataUrl(response.png_base64));
    store.setPreviewDimensions({ width: response.width, height: response.height });
  } catch {
    // apply_edits preview will replace this when ready.
  }
}

async function persistEdits(
  photoId: number | null,
  photoPath: string | null,
  edits: EditStack,
) {
  try {
    if (photoId != null) {
      await invoke("save_edits", { photoId, edits });
      notifyDevelopPersist({ type: "edits-saved", photoId });
    } else if (photoPath) {
      await invoke("save_edits_for_path", { path: photoPath, edits });
    }
  } catch {
    // Persistence is best-effort during interactive editing.
  }
}

function scheduleSaveEdits(
  photoId: number | null,
  photoPath: string | null,
  edits: EditStack,
) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void persistEdits(photoId, photoPath, edits);
  }, SAVE_DEBOUNCE_MS);
}

export async function flushSaveEdits(): Promise<void> {
  const { photoId, photoPath, edits } = useDevelopStore.getState();
  if (photoId == null && !photoPath) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await persistEdits(photoId, photoPath, edits);
}

export function applyRestoredEdits(edits: EditStack) {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  useDevelopStore.getState().setEdits(edits);
  schedulePreviewRefresh({ skipSave: true });
}

export async function createCheckpoint(name: string): Promise<boolean> {
  const { photoId } = useDevelopStore.getState();
  if (photoId == null) return false;
  await flushSaveEdits();
  try {
    await invoke("create_snapshot", { photoId, name });
    notifyDevelopPersist({ type: "checkpoints-changed", photoId });
    return true;
  } catch {
    return false;
  }
}

export function scheduleSaveEditsFromStore() {
  const { photoId, photoPath, edits } = useDevelopStore.getState();
  if (photoId != null || photoPath) {
    scheduleSaveEdits(photoId, photoPath, edits);
  }
}

export function beginInteractiveEdit() {
  interactiveEditCount += 1;
}

export function endInteractiveEdit() {
  interactiveEditCount = Math.max(0, interactiveEditCount - 1);
  if (interactiveEditCount === 0) {
    schedulePreviewRefresh({ final: true });
  }
}

export function schedulePreviewRefresh(options?: { final?: boolean; skipSave?: boolean }) {
  const isFinal = options?.final === true || interactiveEditCount === 0;
  const debounceMs = isFinal ? PREVIEW_FINAL_DEBOUNCE_MS : PREVIEW_DEBOUNCE_MS;

  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    const { photoPath, edits, photoId, previewDataUrl } = useDevelopStore.getState();
    if (!photoPath) return;

    const previewEdits = getPreviewEdits();
    const draft = !isFinal && interactiveEditCount > 0;

    if (!options?.skipSave) {
      scheduleSaveEdits(photoId, photoPath, edits);
    }

    const generation = ++previewGeneration;
    const store = useDevelopStore.getState();
    const applyCrop = !useUIStore.getState().cropMode;
    if (!previewDataUrl || !draft) {
      store.setPreviewLoading(true);
    }
    store.setPreviewError(null);

    void (async () => {
      try {
        const response = await invoke<PreviewResponse>("apply_edits", {
          path: photoPath,
          edits: previewEdits,
          applyCrop,
          draft,
        });
        if (generation !== previewGeneration) return;
        store.setPreviewDataUrl(toPreviewDataUrl(response.png_base64));
        store.setPreviewDimensions({ width: response.width, height: response.height });
      } catch (error) {
        if (generation !== previewGeneration) return;
        const message = String(error);
        if (message.includes("superseded")) return;
        store.setPreviewError(message);
        if (!previewDataUrl) {
          store.setPreviewDataUrl(null);
        }
      } finally {
        if (generation === previewGeneration) {
          store.setPreviewLoading(false);
        }
      }
    })();
  }, debounceMs);
}

export function showQuickPreview(path: string) {
  const applyCrop = !useUIStore.getState().cropMode;
  void loadQuickPreview(path, applyCrop);
}
