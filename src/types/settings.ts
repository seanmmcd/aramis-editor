import type { ExportSettings } from "@/types/edits";
import { DEFAULT_EXPORT_SETTINGS } from "@/types/edits";
import type { ThemeMode } from "@/lib/theme";
import { DEFAULT_HIGHLIGHT_COLOR } from "@/lib/theme";

export interface AppSettings {
  export_thread_count: number;
  export_defaults: ExportSettings;
  theme_mode: ThemeMode;
  highlight_color: string;
  /** Custom primary text color (hex). Empty string uses theme default. */
  text_color: string;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  export_thread_count: 0,
  export_defaults: { ...DEFAULT_EXPORT_SETTINGS },
  theme_mode: "dark",
  highlight_color: DEFAULT_HIGHLIGHT_COLOR,
  text_color: "",
};
