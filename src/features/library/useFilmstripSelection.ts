import { create } from "zustand";

interface SelectionState {
  selectedPhotoIds: number[];
  togglePhoto: (id: number) => void;
  deselectPhoto: (id: number) => void;
  setSelectedPhotoIds: (ids: number[]) => void;
  clearSelection: () => void;
}

export const useFilmstripSelection = create<SelectionState>((set, get) => ({
  selectedPhotoIds: [],
  togglePhoto: (id) => {
    const current = get().selectedPhotoIds;
    set({
      selectedPhotoIds: current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id],
    });
  },
  deselectPhoto: (id) =>
    set((s) => ({ selectedPhotoIds: s.selectedPhotoIds.filter((x) => x !== id) })),
  setSelectedPhotoIds: (ids) => set({ selectedPhotoIds: ids }),
  clearSelection: () => set({ selectedPhotoIds: [] }),
}));
