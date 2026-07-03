use serde::{Deserialize, Serialize};

use super::util::{clamp01, luminance, smoothstep};
use super::EDIT_STRENGTH;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct EffectsEdits {
    pub post_crop_vignette_amount: f32,
    pub post_crop_vignette_midpoint: f32,
    pub post_crop_vignette_roundness: f32,
    pub post_crop_vignette_feather: f32,
    pub grain_amount: f32,
    pub grain_size: f32,
    pub grain_roughness: f32,
}

impl Default for EffectsEdits {
    fn default() -> Self {
        Self {
            post_crop_vignette_amount: 0.0,
            post_crop_vignette_midpoint: 50.0,
            post_crop_vignette_roundness: 0.0,
            post_crop_vignette_feather: 50.0,
            grain_amount: 0.0,
            grain_size: 25.0,
            grain_roughness: 50.0,
        }
    }
}

pub fn apply_effects(data: &mut [f32], width: u32, height: u32, edits: &EffectsEdits) {
    if edits.post_crop_vignette_amount.abs() > 0.01 {
        apply_post_crop_vignette(data, width, height, edits);
    }
    if edits.grain_amount > 0.01 {
        apply_grain(data, width, height, edits);
    }
}

fn apply_post_crop_vignette(data: &mut [f32], width: u32, height: u32, edits: &EffectsEdits) {
    let w = width as f32;
    let h = height as f32;
    let cx = w * 0.5;
    let cy = h * 0.5;
    // Normalize from image center using the shorter half-axis so roundness=0 is a true circle.
    let radius = cx.min(cy).max(1.0);
    let amount = edits.post_crop_vignette_amount / 100.0 * EDIT_STRENGTH;
    let midpoint = (edits.post_crop_vignette_midpoint / 100.0).clamp(0.05, 0.95);
    let roundness = (edits.post_crop_vignette_roundness / 100.0).clamp(-1.0, 1.0);
    let feather = (edits.post_crop_vignette_feather / 100.0).clamp(0.01, 1.0);

    let aspect = w / h.max(1.0);
    let round_scale_x = if roundness >= 0.0 {
        1.0 + roundness * (aspect - 1.0).max(0.0)
    } else {
        1.0
    };
    let round_scale_y = if roundness < 0.0 {
        1.0 + (-roundness) * (1.0 / aspect - 1.0).max(0.0)
    } else {
        1.0
    };

    for y in 0..height {
        for x in 0..width {
            let dx = (x as f32 + 0.5 - cx) / radius * round_scale_x;
            let dy = (y as f32 + 0.5 - cy) / radius * round_scale_y;
            let r = (dx * dx + dy * dy).sqrt().clamp(0.0, 1.5);
            let inner = midpoint * (1.0 - feather * 0.5);
            let outer = midpoint + (1.0 - midpoint) * feather;
            let falloff = smoothstep(inner, outer.max(inner + 0.001), r);
            let factor = if amount >= 0.0 {
                1.0 - amount * falloff
            } else {
                1.0 + (-amount) * falloff * 0.85
            };
            let idx = ((y * width + x) * 3) as usize;
            data[idx] = clamp01(data[idx] * factor);
            data[idx + 1] = clamp01(data[idx + 1] * factor);
            data[idx + 2] = clamp01(data[idx + 2] * factor);
        }
    }
}

fn apply_grain(data: &mut [f32], width: u32, height: u32, edits: &EffectsEdits) {
    let amount = edits.grain_amount / 100.0 * EDIT_STRENGTH;
    let size = (edits.grain_size / 100.0).clamp(0.05, 1.0);
    let roughness = (edits.grain_roughness / 100.0).clamp(0.0, 1.0);
    let cell = (size * 10.0).max(1.0) as u32;

    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 3) as usize;
            let lum = luminance(data[idx], data[idx + 1], data[idx + 2]);
            let lum_weight = (1.0 - (lum - 0.5).abs() * 2.0).clamp(0.15, 1.0);

            let fine = hash_noise(x / cell, y / cell);
            let coarse = hash_noise(x / (cell * 2 + 1), y / (cell * 2 + 1));
            let noise = fine * (1.0 - roughness * 0.6) + coarse * roughness * 0.6;
            let strength = noise * amount * 0.14 * lum_weight;

            data[idx] = clamp01(data[idx] + strength);
            data[idx + 1] = clamp01(data[idx + 1] + strength * 0.96);
            data[idx + 2] = clamp01(data[idx + 2] + strength * 0.92);
        }
    }
}

fn hash_noise(x: u32, y: u32) -> f32 {
    let mut h = x.wrapping_mul(374761393) ^ y.wrapping_mul(668265263);
    h = h.wrapping_mul(1274126177);
    (h % 10000) as f32 / 10000.0 - 0.5
}
