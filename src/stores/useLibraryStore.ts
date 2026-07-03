import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { Folder, Photo } from "@/features/library/types";

type ImportResult = {
  folder_id: number;
  imported: number;
  skipped: number;
};

let photosRequestSeq = 0;
let searchRequestSeq = 0;

function photoListChanged(a: Photo[], b: Photo[]): boolean {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].thumbnail_path !== b[i].thumbnail_path) {
      return true;
    }
  }
  return false;
}

interface LibraryState {
  folders: Folder[];
  photos: Photo[];
  searchResults: Photo[] | null;
  searchQuery: string;
  selectedFolderId: number | null;
  foldersLoading: boolean;
  photosLoading: boolean;
  error: string | null;
  refreshFolders: () => Promise<void>;
  refreshPhotos: (folderId: number | null, options?: { silent?: boolean }) => Promise<void>;
  searchPhotos: (query: string, options?: { silent?: boolean }) => Promise<void>;
  clearSearch: () => void;
  importFolder: (path: string) => Promise<void>;
  removeFolder: (folderId: number) => Promise<void>;
  removePhoto: (photoId: number) => Promise<void>;
  refreshFolderThumbnails: (folderId: number) => Promise<number>;
  thumbnailCacheBust: number;
  bumpThumbnailCache: () => void;
  selectFolder: (folderId: number) => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  folders: [],
  photos: [],
  searchResults: null,
  searchQuery: "",
  selectedFolderId: null,
  foldersLoading: false,
  photosLoading: false,
  error: null,

  refreshFolders: async () => {
    set({ foldersLoading: true, error: null });
    try {
      const folders = await invoke<Folder[]>("get_folders");
      set({ folders, foldersLoading: false });
    } catch (error) {
      set({ error: String(error), foldersLoading: false });
    }
  },

  refreshPhotos: async (folderId, options) => {
    const silent = options?.silent ?? false;
    const requestSeq = ++photosRequestSeq;

    if (folderId == null) {
      set({ photos: [], ...(silent ? {} : { photosLoading: false }) });
      return;
    }

    if (!silent) {
      set({ photosLoading: true, error: null });
    }
    try {
      const photos = await invoke<Photo[]>("list_photos", { folderId });
      if (requestSeq !== photosRequestSeq || get().selectedFolderId !== folderId) {
        if (!silent) set({ photosLoading: false });
        return;
      }
      const prev = get().photos;
      if (!photoListChanged(prev, photos)) {
        if (!silent) set({ photosLoading: false });
        return;
      }
      set({ photos, ...(silent ? {} : { photosLoading: false }) });
    } catch (error) {
      if (requestSeq === photosRequestSeq) {
        set({ error: String(error), ...(silent ? {} : { photosLoading: false }) });
      }
    }
  },

  searchPhotos: async (query, options) => {
    const trimmed = query.trim();
    const silent = options?.silent ?? false;
    const requestSeq = ++searchRequestSeq;

    if (!silent) {
      set({ searchQuery: query, photosLoading: true, error: null });
    }
    if (!trimmed) {
      if (!silent) set({ searchResults: null, photosLoading: false });
      else set({ searchResults: null });
      return;
    }
    try {
      const searchResults = await invoke<Photo[]>("search_photos", { query: trimmed });
      if (requestSeq !== searchRequestSeq || get().searchQuery.trim() !== trimmed) {
        if (!silent) set({ photosLoading: false });
        return;
      }
      const prev = get().searchResults ?? [];
      if (!photoListChanged(prev, searchResults)) {
        if (!silent) set({ photosLoading: false });
        return;
      }
      set({
        ...(silent ? {} : { searchQuery: query }),
        searchResults,
        ...(silent ? {} : { photosLoading: false }),
      });
    } catch (error) {
      if (requestSeq === searchRequestSeq) {
        set({ error: String(error), ...(silent ? {} : { photosLoading: false }) });
      }
    }
  },

  clearSearch: () => set({ searchQuery: "", searchResults: null }),

  importFolder: async (path) => {
    set({ foldersLoading: true, error: null });
    try {
      const result = await invoke<ImportResult>("import_folder", { path });
      await get().refreshFolders();
      set({ selectedFolderId: result.folder_id, photos: [] });
      await get().refreshPhotos(result.folder_id);
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ foldersLoading: false });
    }
  },

  removeFolder: async (folderId) => {
    set({ foldersLoading: true, error: null });
    try {
      await invoke("remove_folder", { folderId });
      const { selectedFolderId } = get();
      await get().refreshFolders();
      if (selectedFolderId === folderId) {
        set({ selectedFolderId: null, photos: [] });
      }
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ foldersLoading: false });
    }
  },

  removePhoto: async (photoId) => {
    set({ error: null });
    try {
      await invoke("remove_photo", { photoId });
      const { selectedFolderId, searchQuery } = get();
      if (searchQuery.trim()) {
        await get().searchPhotos(searchQuery);
      } else if (selectedFolderId != null) {
        await get().refreshPhotos(selectedFolderId);
      }
      await get().refreshFolders();
    } catch (error) {
      set({ error: String(error) });
    }
  },

  refreshFolderThumbnails: async (folderId) => {
    set({ error: null });
    try {
      const count = await invoke<number>("refresh_folder_thumbnails", { folderId });
      get().bumpThumbnailCache();
      await get().refreshPhotos(folderId, { silent: true });
      return count;
    } catch (error) {
      set({ error: String(error) });
      return 0;
    }
  },

  thumbnailCacheBust: 0,
  bumpThumbnailCache: () => set({ thumbnailCacheBust: Date.now() }),

  selectFolder: (folderId) => {
    get().clearSearch();
    set({ selectedFolderId: folderId, photos: [] });
  },
}));
