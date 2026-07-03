export interface BasicEdits {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  temp: number;
  tint: number;
  /** WB reference baked into decoded image (6500/0 neutral RAW; as-shot for embedded JPEG). */
  wb_baseline_temp: number;
  wb_baseline_tint: number;
  vibrance: number;
  saturation: number;
}

export interface ParametricCurve {
  shadows: number;
  darks: number;
  lights: number;
  highlights: number;
  shadow_split: number;
  midtone_split: number;
  highlight_split: number;
}

export interface ToneCurveEdits {
  mode: string;
  parametric: ParametricCurve;
  points: [number, number][];
}

export interface HslEdits {
  hue: number[];
  saturation: number[];
  luminance: number[];
}

export interface ColorGradeZone {
  hue: number;
  saturation: number;
  luminance: number;
}

export interface ColorGradingEdits {
  shadows: ColorGradeZone;
  midtones: ColorGradeZone;
  highlights: ColorGradeZone;
}

export interface CalibrationEdits {
  shadow_tint: number;
  red_primary_hue: number;
  red_primary_sat: number;
  green_primary_hue: number;
  green_primary_sat: number;
  blue_primary_hue: number;
  blue_primary_sat: number;
}

export interface EffectsEdits {
  post_crop_vignette_amount: number;
  post_crop_vignette_midpoint: number;
  post_crop_vignette_roundness: number;
  post_crop_vignette_feather: number;
  grain_amount: number;
  grain_size: number;
  grain_roughness: number;
}

export type AspectRatio = [number, number];

export interface CropEdits {
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  straighten: number;
  aspect_ratio: AspectRatio | null;
}

export function cropAspectTarget(ratio: AspectRatio | null): number | null {
  if (!ratio || ratio[0] <= 0 || ratio[1] <= 0) return null;
  return ratio[0] / ratio[1];
}

export function isFullCrop(crop: Pick<CropEdits, "x" | "y" | "width" | "height">) {
  return crop.x === 0 && crop.y === 0 && crop.width === 1 && crop.height === 1;
}

export function fitCropToAspect(
  crop: Pick<CropEdits, "x" | "y" | "width" | "height">,
  ratio: AspectRatio,
): Pick<CropEdits, "x" | "y" | "width" | "height"> {
  const target = cropAspectTarget(ratio);
  if (target === null) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  let { x, y, width, height } = crop;
  const cx = x + width / 2;
  const cy = y + height / 2;

  if (width / height > target) {
    width = height * target;
  } else {
    height = width / target;
  }

  x = cx - width / 2;
  y = cy - height / 2;
  x = Math.max(0, Math.min(x, 1 - width));
  y = Math.max(0, Math.min(y, 1 - height));

  return { x, y, width, height };
}

export type CropSettings = CropEdits;

export interface TransformEdits {
  rotate: number;
  vertical: number;
  horizontal: number;
  aspect: number;
  scale: number;
  x_offset: number;
  y_offset: number;
}

export interface LensEdits {
  enable_profile: boolean;
  profile_name: string;
  distortion: number;
  vignette: number;
  chromatic_aberration: number;
  defringe: number;
}

export interface DetailEdits {
  sharpening_amount: number;
  sharpening_radius: number;
  sharpening_detail: number;
  sharpening_masking: number;
  noise_reduction_luminance: number;
  noise_reduction_detail: number;
  noise_reduction_contrast: number;
  noise_reduction_color: number;
}

export type SpotHealMode = "heal" | "clone";

export interface HealSpot {
  id: string;
  dest_x: number;
  dest_y: number;
  source_x: number;
  source_y: number;
  /** Radius as a fraction of min(image width, image height). */
  radius: number;
  mode: SpotHealMode;
}

export interface SpotHealEdits {
  spots: HealSpot[];
}

export interface EditStack {
  lens: LensEdits;
  transform: TransformEdits;
  crop: CropEdits;
  basic: BasicEdits;
  tone_curve: ToneCurveEdits;
  hsl: HslEdits;
  color_grading: ColorGradingEdits;
  calibration: CalibrationEdits;
  detail: DetailEdits;
  effects: EffectsEdits;
  spot_heal: SpotHealEdits;
}

export type ExportFormat = "jpeg" | "tiff" | "png" | "original";
export type ColorSpace = "srgb" | "rgb1998" | "pro_photo";
export type ResizeMode = "original" | "long_edge" | "dimensions";
export type UpscaleFactor = "x1" | "x1_5" | "x2" | "x4";

export interface ExportSettings {
  format: ExportFormat;
  quality: number;
  color_space: ColorSpace;
  resize_mode: ResizeMode;
  long_edge: number;
  width: number;
  height: number;
  upscale_factor: UpscaleFactor;
  output_folder: string;
  filename_template: string;
}

export interface ExportResult {
  output_path: string;
  width: number;
  height: number;
}

export interface BatchExportItem {
  photo_id: number;
  result: ExportResult | null;
  error: string | null;
}

export interface BatchExportResult {
  items: BatchExportItem[];
  succeeded: number;
  failed: number;
}

export interface Preset {
  id: number;
  name: string;
  folder: string;
  edits: EditStack;
}

export interface HistoryEntry {
  id: number;
  photo_id: number;
  label: string;
  edits: EditStack;
  timestamp: string;
}

export interface Snapshot {
  id: number;
  photo_id: number;
  name: string;
  edits: EditStack;
  created_at: string;
}

export const DEFAULT_BASIC_EDITS: BasicEdits = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temp: 6500,
  tint: 0,
  wb_baseline_temp: 6500,
  wb_baseline_tint: 0,
  vibrance: 0,
  saturation: 0,
};

export const DEFAULT_EDIT_STACK: EditStack = {
  lens: {
    enable_profile: false,
    profile_name: "",
    distortion: 0,
    vignette: 0,
    chromatic_aberration: 0,
    defringe: 0,
  },
  transform: {
    rotate: 0,
    vertical: 0,
    horizontal: 0,
    aspect: 0,
    scale: 0,
    x_offset: 0,
    y_offset: 0,
  },
  crop: {
    enabled: false,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    angle: 0,
    straighten: 0,
    aspect_ratio: null,
  },
  basic: { ...DEFAULT_BASIC_EDITS },
  tone_curve: {
    mode: "parametric",
    parametric: {
      shadows: 0,
      darks: 0,
      lights: 0,
      highlights: 0,
      shadow_split: 0.25,
      midtone_split: 0.5,
      highlight_split: 0.75,
    },
    points: [
      [0, 0],
      [1, 1],
    ],
  },
  hsl: {
    hue: Array(8).fill(0),
    saturation: Array(8).fill(0),
    luminance: Array(8).fill(0),
  },
  color_grading: {
    shadows: { hue: 0, saturation: 0, luminance: 0 },
    midtones: { hue: 0, saturation: 0, luminance: 0 },
    highlights: { hue: 0, saturation: 0, luminance: 0 },
  },
  calibration: {
    shadow_tint: 0,
    red_primary_hue: 0,
    red_primary_sat: 0,
    green_primary_hue: 0,
    green_primary_sat: 0,
    blue_primary_hue: 0,
    blue_primary_sat: 0,
  },
  detail: {
    sharpening_amount: 0,
    sharpening_radius: 1,
    sharpening_detail: 25,
    sharpening_masking: 0,
    noise_reduction_luminance: 0,
    noise_reduction_detail: 50,
    noise_reduction_contrast: 0,
    noise_reduction_color: 0,
  },
  effects: {
    post_crop_vignette_amount: 0,
    post_crop_vignette_midpoint: 50,
    post_crop_vignette_roundness: 0,
    post_crop_vignette_feather: 50,
    grain_amount: 0,
    grain_size: 25,
    grain_roughness: 50,
  },
  spot_heal: {
    spots: [],
  },
};

export type EditSectionId =
  | "basic"
  | "tone_curve"
  | "hsl"
  | "calibration"
  | "color_grading"
  | "crop"
  | "transform"
  | "lens"
  | "detail"
  | "effects"
  | "spot_heal";

export const EDIT_SECTION_IDS: EditSectionId[] = [
  "basic",
  "tone_curve",
  "hsl",
  "calibration",
  "color_grading",
  "crop",
  "transform",
  "lens",
  "detail",
  "effects",
  "spot_heal",
];

export type DisabledSections = Partial<Record<EditSectionId, boolean>>;

/** Build preview edits by substituting defaults for disabled sections (UI values unchanged). */
export function maskEditsForPreview(
  edits: EditStack,
  disabledSections: DisabledSections,
  allEditsEnabled: boolean,
): EditStack {
  const isDisabled = (section: EditSectionId) => !allEditsEnabled || !!disabledSections[section];

  const masked = structuredClone(edits);

  if (isDisabled("basic")) {
    masked.basic = {
      ...DEFAULT_BASIC_EDITS,
      wb_baseline_temp: edits.basic.wb_baseline_temp,
      wb_baseline_tint: edits.basic.wb_baseline_tint,
    };
  }
  if (isDisabled("tone_curve")) {
    masked.tone_curve = structuredClone(DEFAULT_EDIT_STACK.tone_curve);
  }
  if (isDisabled("hsl")) {
    masked.hsl = structuredClone(DEFAULT_EDIT_STACK.hsl);
  }
  if (isDisabled("calibration")) {
    masked.calibration = structuredClone(DEFAULT_EDIT_STACK.calibration);
  }
  if (isDisabled("color_grading")) {
    masked.color_grading = structuredClone(DEFAULT_EDIT_STACK.color_grading);
  }
  if (isDisabled("crop")) {
    masked.crop = structuredClone(DEFAULT_EDIT_STACK.crop);
  }
  if (isDisabled("transform")) {
    masked.transform = structuredClone(DEFAULT_EDIT_STACK.transform);
  }
  if (isDisabled("lens")) {
    masked.lens = structuredClone(DEFAULT_EDIT_STACK.lens);
  }
  if (isDisabled("detail")) {
    masked.detail = structuredClone(DEFAULT_EDIT_STACK.detail);
  }
  if (isDisabled("effects")) {
    masked.effects = structuredClone(DEFAULT_EDIT_STACK.effects);
  }
  if (isDisabled("spot_heal")) {
    masked.spot_heal = structuredClone(DEFAULT_EDIT_STACK.spot_heal);
  }

  return masked;
}

export const DEFAULT_HEAL_SPOT_RADIUS = 0.018;
export const DEFAULT_HEAL_SOURCE_OFFSET = 0.04;

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: "jpeg",
  quality: 90,
  color_space: "srgb",
  resize_mode: "original",
  long_edge: 2048,
  width: 1920,
  height: 1080,
  upscale_factor: "x1",
  output_folder: "",
  filename_template: "{filename}_edited",
};
