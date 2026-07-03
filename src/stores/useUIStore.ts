import { create } from "zustand";

import { schedulePreviewRefresh, useDevelopStore } from "@/stores/useDevelopStore";
import type { CropEdits } from "@/types/edits";
import { DEFAULT_HEAL_SPOT_RADIUS, type SpotHealMode } from "@/types/edits";

export type ActiveModule = "library" | "develop" | "export";

export type PendingCrop = Pick<CropEdits, "x" | "y" | "width" | "height" | "aspect_ratio">;

interface UIState {
  activeModule: ActiveModule;
  exportDialogOpen: boolean;
  rightPanelWidth: number;
  cropMode: boolean;
  spotHealMode: boolean;
  selectedHealSpotId: string | null;
  healBrushRadius: number;
  healBrushMode: SpotHealMode;
  pendingCrop: PendingCrop | null;
  collapsedSections: Record<string, boolean>;
  developLeftPanelVisible: boolean;
  developRightPanelVisible: boolean;
  developFilmstripVisible: boolean;
  setActiveModule: (module: ActiveModule) => void;
  setExportDialogOpen: (open: boolean) => void;
  toggleCropMode: () => void;
  toggleSpotHealMode: () => void;
  setSelectedHealSpotId: (id: string | null) => void;
  setHealBrushRadius: (radius: number) => void;
  setHealBrushMode: (mode: SpotHealMode) => void;
  setPendingCrop: (patch: Partial<PendingCrop>) => void;
  confirmCrop: () => void;
  cancelCrop: () => void;
  isSectionCollapsed: (sectionId: string) => boolean;
  toggleSection: (sectionId: string) => void;
  toggleDevelopLeftPanel: () => void;
  toggleDevelopRightPanel: () => void;
  toggleDevelopFilmstrip: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activeModule: "library",
  exportDialogOpen: false,
  rightPanelWidth: 280,
  cropMode: false,
  spotHealMode: false,
  selectedHealSpotId: null,
  healBrushRadius: DEFAULT_HEAL_SPOT_RADIUS,
  healBrushMode: "heal",
  pendingCrop: null,
  collapsedSections: {
    "right-hsl-color": true,
    "right-calibration": true,
    "right-crop": true,
    "right-transform": true,
    "right-lens-corrections": true,
    "right-detail": true,
    "right-effects": true,
    "right-spot-heal": false,
    "right-basic": false,
    "right-tone-curve": true,
  },
  developLeftPanelVisible: true,
  developRightPanelVisible: true,
  developFilmstripVisible: true,

  setActiveModule: (module) => set({ activeModule: module }),
  setExportDialogOpen: (open) => set({ exportDialogOpen: open }),

  toggleCropMode: () => {
    const { cropMode } = get();
    if (cropMode) return;

    set({ spotHealMode: false, selectedHealSpotId: null });

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

  toggleSpotHealMode: () => {
    const { spotHealMode } = get();
    if (spotHealMode) {
      set({ spotHealMode: false, selectedHealSpotId: null });
      return;
    }

    set({ cropMode: false, pendingCrop: null, spotHealMode: true });
    schedulePreviewRefresh();
  },

  setSelectedHealSpotId: (id) => set({ selectedHealSpotId: id }),
  setHealBrushRadius: (radius) => set({ healBrushRadius: radius }),
  setHealBrushMode: (mode) => set({ healBrushMode: mode }),

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

  toggleDevelopLeftPanel: () =>
    set((s) => ({ developLeftPanelVisible: !s.developLeftPanelVisible })),

  toggleDevelopRightPanel: () =>
    set((s) => ({ developRightPanelVisible: !s.developRightPanelVisible })),

  toggleDevelopFilmstrip: () =>
    set((s) => ({ developFilmstripVisible: !s.developFilmstripVisible })),
}));
