import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface ToastItem {
  id: string;
  message: string;
  folderPath?: string;
  expiresAt: number;
}

interface ToastState {
  toasts: ToastItem[];
  showToast: (options: {
    message: string;
    folderPath?: string;
    durationMs?: number;
  }) => void;
  dismissToast: (id: string) => void;
  openToastFolder: (folderPath: string) => Promise<void>;
}

let toastSeq = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  showToast: ({ message, folderPath, durationMs = 5000 }) => {
    const id = `toast-${++toastSeq}`;
    const expiresAt = Date.now() + durationMs;
    set((s) => ({
      toasts: [...s.toasts, { id, message, folderPath, expiresAt }],
    }));
    window.setTimeout(() => {
      get().dismissToast(id);
    }, durationMs);
  },

  dismissToast: (id) =>
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
    })),

  openToastFolder: async (folderPath) => {
    try {
      await invoke("open_export_folder", { path: folderPath });
    } catch (error) {
      console.error(error);
    }
  },
}));

export function folderFromOutputPath(outputPath: string): string {
  return outputPath.replace(/[\\/][^\\/]+$/, "");
}

export function notifyExportSuccess(outputFolder: string, photoCount = 1) {
  const message =
    photoCount > 1
      ? `${photoCount} photos exported successfully`
      : "Export complete";
  useToastStore.getState().showToast({
    message,
    folderPath: outputFolder,
    durationMs: 5000,
  });
}
