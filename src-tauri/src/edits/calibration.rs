use serde::{Deserialize, Serialize};

use super::util::{clamp01, hsl_to_rgb, map_pixels_display_space, rgb_to_hsl};
use super::EDIT_STRENGTH;

const PRIMARY_HUE_STRENGTH: f32 = 0.045;
const PRIMARY_SAT_STRENGTH: f32 = 0.28;
const SHADOW_TINT_STRENGTH: f32 = 0.02;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct CalibrationEdits {
    pub shadow_tint: f32,
    pub red_primary_hue: f32,
    pub red_primary_sat: f32,
    pub green_primary_hue: f32,
    pub green_primary_sat: f32,
    pub blue_primary_hue: f32,
    pub blue_primary_sat: f32,
}

pub fn apply_calibration(data: &mut [f32], edits: &CalibrationEdits) {
    if edits.shadow_tint.abs() < 0.01
        && edits.red_primary_hue.abs() < 0.01
        && edits.red_primary_sat.abs() < 0.01
        && edits.green_primary_hue.abs() < 0.01
        && edits.green_primary_sat.abs() < 0.01
        && edits.blue_primary_hue.abs() < 0.01
        && edits.blue_primary_sat.abs() < 0.01
    {
        return;
    }
    map_pixels_display_space(data, |r, g, b| {
        let (mut h, mut s, l) = rgb_to_hsl(r, g, b);
        if l < 0.35 {
            h = (h + edits.shadow_tint / 100.0 * SHADOW_TINT_STRENGTH * EDIT_STRENGTH).rem_euclid(1.0);
        }
        for (center, dh, ds) in [
            (0.0, edits.red_primary_hue, edits.red_primary_sat),
            (0.33, edits.green_primary_hue, edits.green_primary_sat),
            (0.66, edits.blue_primary_hue, edits.blue_primary_sat),
        ] {
            let dist = (h - center).abs().min(1.0 - (h - center).abs());
            if dist < 0.16 {
                let w = 1.0 - dist / 0.16;
                h = (h + dh / 100.0 * PRIMARY_HUE_STRENGTH * w * EDIT_STRENGTH).rem_euclid(1.0);
                s = (s * (1.0 + ds / 100.0 * PRIMARY_SAT_STRENGTH * w * EDIT_STRENGTH)).clamp(0.0, 1.0);
            }
        }
        let (r, g, b) = hsl_to_rgb(h, s, l);
        (clamp01(r), clamp01(g), clamp01(b))
    });
}
