export type ThemeMode = "dark" | "light";

export const DEFAULT_HIGHLIGHT_COLOR = "#2d8ceb";
export const DEFAULT_TEXT_COLOR_DARK = "#d4d4d4";
export const DEFAULT_TEXT_COLOR_LIGHT = "#1e1e1e";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function normalizeHexColor(color: string): string | null {
  const trimmed = color.trim();
  if (HEX_COLOR.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return null;
}

export function normalizeHighlightColor(color: string): string {
  return normalizeHexColor(color) ?? DEFAULT_HIGHLIGHT_COLOR;
}

export function normalizeTextColor(color: string): string | null {
  return normalizeHexColor(color);
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.slice(1);
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function hexWithAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface AppearanceSettings {
  theme_mode: ThemeMode;
  highlight_color: string;
  text_color?: string;
}

export function applyAppearance(settings: AppearanceSettings) {
  const root = document.documentElement;
  const highlight = normalizeHighlightColor(settings.highlight_color);
  root.dataset.theme = settings.theme_mode;
  root.style.setProperty("--ae-highlight", highlight);
  root.style.setProperty("--ae-accent", highlight);
  root.style.setProperty("--ae-selection-bg", hexWithAlpha(highlight, 0.18));

  const text = settings.text_color ? normalizeTextColor(settings.text_color) : null;
  if (text) {
    root.style.setProperty("--ae-text-primary", text);
    root.style.setProperty("--ae-text", text);
  } else {
    root.style.removeProperty("--ae-text-primary");
    root.style.removeProperty("--ae-text");
  }
}
