use serde::{Deserialize, Serialize};

use super::util::{clamp01, hsl_to_rgb, luminance, rgb_to_hsl};
use super::EDIT_STRENGTH;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct ColorGradeZone {
    pub hue: f32,
    pub saturation: f32,
    pub luminance: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct ColorGradingEdits {
    pub shadows: ColorGradeZone,
    pub midtones: ColorGradeZone,
    pub highlights: ColorGradeZone,
}

fn zone_is_default(zone: &ColorGradeZone) -> bool {
    zone.hue.abs() < 0.01 && zone.saturation.abs() < 0.01 && zone.luminance.abs() < 0.01
}

pub fn apply_color_grading(data: &mut [f32], edits: &ColorGradingEdits) {
    if zone_is_default(&edits.shadows)
        && zone_is_default(&edits.midtones)
        && zone_is_default(&edits.highlights)
    {
        return;
    }
    for px in data.chunks_exact_mut(3) {
        let mut arr = [px[0], px[1], px[2]];
        let lum = luminance(arr[0], arr[1], arr[2]);
        let sh_w = (1.0 - lum * 2.0).max(0.0);
        let hi_w = ((lum - 0.5) * 2.0).max(0.0);
        let mid_w = 1.0 - (sh_w + hi_w).min(1.0);
        for (w, zone) in [
            (sh_w, &edits.shadows),
            (mid_w, &edits.midtones),
            (hi_w, &edits.highlights),
        ] {
            if w <= 0.0 {
                continue;
            }
            let (h, s, l) = rgb_to_hsl(arr[0], arr[1], arr[2]);
            let nh = (h + zone.hue / 360.0 * w * EDIT_STRENGTH).rem_euclid(1.0);
            let ns = (s + zone.saturation / 100.0 * w * EDIT_STRENGTH).clamp(0.0, 1.0);
            let nl = (l + zone.luminance / 100.0 * w * EDIT_STRENGTH).clamp(0.0, 1.0);
            let (r, g, b) = hsl_to_rgb(nh, ns, nl);
            arr = [clamp01(r), clamp01(g), clamp01(b)];
        }
        px.copy_from_slice(&arr);
    }
}
