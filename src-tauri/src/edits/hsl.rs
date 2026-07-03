use serde::{Deserialize, Serialize};

use super::util::{clamp01, hsl_to_rgb, map_pixels_display_space, rgb_to_hsl};
use super::EDIT_STRENGTH;

const BAND_CENTERS: [f32; 8] = [0.0, 0.04, 0.08, 0.17, 0.42, 0.58, 0.75, 0.88];
const BAND_SIGMA: f32 = 0.14;

fn band_weight(h: f32, center: f32) -> f32 {
    let d = (h - center).abs().min(1.0 - (h - center).abs());
    (-0.5 * (d / BAND_SIGMA).powi(2)).exp()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct HslEdits {
    pub hue: Vec<f32>,
    pub saturation: Vec<f32>,
    pub luminance: Vec<f32>,
}

impl Default for HslEdits {
    fn default() -> Self {
        Self {
            hue: vec![0.0; 8],
            saturation: vec![0.0; 8],
            luminance: vec![0.0; 8],
        }
    }
}

pub fn apply_hsl(data: &mut [f32], edits: &HslEdits) {
    if edits.hue.iter().all(|v| v.abs() < 0.01)
        && edits.saturation.iter().all(|v| v.abs() < 0.01)
        && edits.luminance.iter().all(|v| v.abs() < 0.01)
    {
        return;
    }
    map_pixels_display_space(data, |r, g, b| {
        let (mut h, mut s, mut l) = rgb_to_hsl(r, g, b);
        let mut dh = 0.0;
        let mut ds = 0.0;
        let mut dl = 0.0;
        let mut weight_sum = 0.0f32;
        for (i, center) in BAND_CENTERS.iter().enumerate() {
            let w = band_weight(h, *center);
            if w > 0.001 {
                dh += edits.hue.get(i).copied().unwrap_or(0.0) / 100.0 * 0.05 * w * EDIT_STRENGTH;
                ds += edits.saturation.get(i).copied().unwrap_or(0.0) / 100.0 * w * EDIT_STRENGTH;
                dl += edits.luminance.get(i).copied().unwrap_or(0.0) / 100.0 * w * EDIT_STRENGTH;
                weight_sum += w;
            }
        }
        if weight_sum > 0.0 {
            h = (h + dh).rem_euclid(1.0);
            s = (s + ds).clamp(0.0, 1.0);
            l = (l + dl).clamp(0.0, 1.0);
        }
        let (r, g, b) = hsl_to_rgb(h, s, l);
        (clamp01(r), clamp01(g), clamp01(b))
    });
}
