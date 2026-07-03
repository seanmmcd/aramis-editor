import { create } from "zustand";

import { schedulePreviewRefresh, useDevelopStore } from "@/stores/useDevelopStore";
import type { CropEdits } from "@/types/edits";

export type ActiveModule = "library" | "develop" | "export";

export type PendingCrop = Pick<CropEdits, "x" | "y" | "width" | "height" | "aspect_ratio">;

interface UIState {
  activeModule: ActiveModule;
  exportDialogOpen: boolean;
  rightPanelWidth: number;
  cropMode: boolean;
  pendingCrop: PendingCrop | null;
  collapsedSections: Record<string, boolean>;
  setActiveModule: (module: ActiveModule) => void;
  setExportDialogOpen: (open: boolean) => void;
  toggleCropMode: () => void;
  setPendingCrop: (patch: Partial<PendingCrop>) => void;
  confirmCrop: () => void;
  cancelCrop: () => void;
  isSectionCollapsed: (sectionId: string) => boolean;
  toggleSection: (sectionId: string) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activeModule: "library",
  exportDialogOpen: false,
  rightPanelWidth: 280,
  cropMode: false,
  pendingCrop: null,
  collapsedSections: {
    "right-hsl-color": true,
    "right-calibration": true,
    "right-crop": true,
    "right-transform": true,
    "right-lens-corrections": true,
    "right-detail": true,
    "right-effects": true,
    "right-basic": false,
    "right-tone-curve": false,
  },

  setActiveModule: (module) => set({ activeModule: module }),
  setExportDialogOpen: (open) => set({ exportDialogOpen: open }),

  toggleCropMode: () => {
    const { cropMode } = get();
    if (cropMode) return;

    const crop = useDevelopStore.getState().edits.crop;
    set({
      cropMode: true,
      pendingCrop: {
        x: crop.x,
        y: crop.y,
        width: crop.width,
        height: crop.height,
        aspect_ratio: crop.aspect_ratio,
      },
    });
    schedulePreviewRefresh();
  },

  setPendingCrop: (patch) =>
    set((s) => ({
      pendingCrop: s.pendingCrop ? { ...s.pendingCrop, ...patch } : null,
    })),

  confirmCrop: () => {
    const { pendingCrop } = get();
    if (!pendingCrop) return;

    useDevelopStore.getState().setCrop({ ...pendingCrop, enabled: true });
    schedulePreviewRefresh();
    set({ cropMode: false, pendingCrop: null });
  },

  cancelCrop: () => {
    set({ cropMode: false, pendingCrop: null });
    schedulePreviewRefresh();
  },

  isSectionCollapsed: (sectionId) => get().collapsedSections[sectionId] ?? false,

  toggleSection: (sectionId) =>
    set((s) => ({
      collapsedSections: {
        ...s.collapsedSections,
        [sectionId]: !s.isSectionCollapsed(sectionId),
      },
    })),
}));
