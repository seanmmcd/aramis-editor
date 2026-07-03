import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { applyAppearance } from "@/lib/theme";
import type { ThemeMode } from "@/lib/theme";
import type { AppSettings } from "@/types/settings";
import { DEFAULT_APP_SETTINGS } from "@/types/settings";
import type { ExportSettings } from "@/types/edits";
import { useExportStore } from "@/stores/useExportStore";

interface AppSettingsState {
  settings: AppSettings;
  loaded: boolean;
  saving: boolean;
  error: string | null;
  loadSettings: () => Promise<void>;
  setExportThreadCount: (count: number) => void;
  setExportDefaults: (patch: Partial<ExportSettings>) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setHighlightColor: (color: string) => void;
  setTextColor: (color: string) => void;
  saveSettings: () => Promise<boolean>;
}

function syncAppearance(settings: AppSettings) {
  applyAppearance(settings);
}

export const useAppSettingsStore = create<AppSettingsState>((set, get) => ({
  settings: { ...DEFAULT_APP_SETTINGS },
  loaded: false,
  saving: false,
  error: null,

  loadSettings: async () => {
    try {
      const settings = await invoke<AppSettings>("get_app_settings");
      syncAppearance(settings);
      set({ settings, loaded: true, error: null });
      useExportStore.getState().applyDefaults(settings.export_defaults);
    } catch (error) {
      syncAppearance(DEFAULT_APP_SETTINGS);
      set({ error: String(error), loaded: true });
    }
  },

  setExportThreadCount: (count) =>
    set((s) => ({
      settings: {
        ...s.settings,
        export_thread_count: Math.max(0, Math.round(count)),
      },
      error: null,
    })),

  setExportDefaults: (patch) =>
    set((s) => ({
      settings: {
        ...s.settings,
        export_defaults: { ...s.settings.export_defaults, ...patch },
      },
      error: null,
    })),

  setThemeMode: (mode) =>
    set((s) => {
      const settings = { ...s.settings, theme_mode: mode };
      syncAppearance(settings);
      return { settings, error: null };
    }),

  setHighlightColor: (color) =>
    set((s) => {
      const settings = { ...s.settings, highlight_color: color };
      syncAppearance(settings);
      return { settings, error: null };
    }),

  setTextColor: (color) =>
    set((s) => {
      const settings = { ...s.settings, text_color: color };
      syncAppearance(settings);
      return { settings, error: null };
    }),

  saveSettings: async () => {
    const { settings } = get();
    set({ saving: true, error: null });
    try {
      const saved = await invoke<AppSettings>("save_app_settings", { settings });
      syncAppearance(saved);
      set({ settings: saved, saving: false });
      useExportStore.getState().applyDefaults(saved.export_defaults);
      return true;
    } catch (error) {
      set({ saving: false, error: String(error) });
      return false;
    }
  },
}));
