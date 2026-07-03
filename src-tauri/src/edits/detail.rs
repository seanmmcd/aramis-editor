use serde::{Deserialize, Serialize};

use super::util::{clamp01, gaussian_blur, luminance};
use super::EDIT_STRENGTH;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct DetailEdits {
    pub sharpening_amount: f32,
    pub sharpening_radius: f32,
    pub sharpening_detail: f32,
    pub sharpening_masking: f32,
    pub noise_reduction_luminance: f32,
    pub noise_reduction_detail: f32,
    pub noise_reduction_contrast: f32,
    pub noise_reduction_color: f32,
}

impl Default for DetailEdits {
    fn default() -> Self {
        Self {
            sharpening_amount: 0.0,
            sharpening_radius: 1.0,
            sharpening_detail: 25.0,
            sharpening_masking: 0.0,
            noise_reduction_luminance: 0.0,
            noise_reduction_detail: 50.0,
            noise_reduction_contrast: 0.0,
            noise_reduction_color: 0.0,
        }
    }
}

pub fn apply_detail(data: &mut [f32], width: u32, height: u32, edits: &DetailEdits) {
    if edits.noise_reduction_luminance > 0.01 || edits.noise_reduction_color > 0.01 {
        apply_luminance_nr(data, width, height, edits);
        apply_color_nr(data, width, height, edits);
    }
    if edits.sharpening_amount > 0.01 {
        apply_unsharp_mask(data, width, height, edits);
    }
}

/// Preview path: sharpening plus luminance noise reduction (skips color NR).
pub fn apply_detail_preview(data: &mut [f32], width: u32, height: u32, edits: &DetailEdits) {
    if edits.noise_reduction_luminance > 0.01 {
        apply_luminance_nr(data, width, height, edits);
    }
    if edits.sharpening_amount > 0.01 {
        apply_unsharp_mask(data, width, height, edits);
    }
}

/// Light unsharp mask when no user sharpening is set (compensates for preview downscale).
pub fn apply_preview_sharpen_compensation(data: &mut [f32], width: u32, height: u32, edits: &DetailEdits) {
    if edits.sharpening_amount > 0.01 {
        return;
    }
    let compensation = DetailEdits {
        sharpening_amount: 22.0,
        sharpening_radius: 0.8,
        sharpening_detail: 35.0,
        ..DetailEdits::default()
    };
    apply_unsharp_mask(data, width, height, &compensation);
}

fn apply_unsharp_mask(data: &mut [f32], width: u32, height: u32, edits: &DetailEdits) {
    let sigma = edits.sharpening_radius.clamp(0.5, 3.0);
    let blurred = gaussian_blur(data, width, height, sigma);
    let amount = edits.sharpening_amount / 45.0 * EDIT_STRENGTH;
    let detail_mix = 0.35 + edits.sharpening_detail / 100.0 * 0.65;
    let masking = edits.sharpening_masking / 100.0;

    for i in 0..data.len() / 3 {
        let idx = i * 3;
        let orig = [data[idx], data[idx + 1], data[idx + 2]];
        let blur = [blurred[idx], blurred[idx + 1], blurred[idx + 2]];
        let orig_l = luminance(orig[0], orig[1], orig[2]);
        let blur_l = luminance(blur[0], blur[1], blur[2]);
        let hp = orig_l - blur_l;
        if hp.abs() < masking * 0.02 {
            continue;
        }
        let edge = (hp.abs() / (hp.abs() + 0.012)).min(1.0);
        let w = edge * detail_mix;
        let new_l = clamp01(orig_l + hp * amount * w);
        if orig_l > 1e-6 {
            let s = new_l / orig_l;
            data[idx] = clamp01(orig[0] * s);
            data[idx + 1] = clamp01(orig[1] * s);
            data[idx + 2] = clamp01(orig[2] * s);
        }
    }
}

fn apply_luminance_nr(data: &mut [f32], width: u32, height: u32, edits: &DetailEdits) {
    let strength = edits.noise_reduction_luminance / 100.0 * EDIT_STRENGTH;
    if strength <= 0.01 {
        return;
    }
    let sigma = 1.0 + (1.0 - edits.noise_reduction_detail / 100.0) * 2.0;
    let blurred = gaussian_blur(data, width, height, sigma);
    let contrast = 1.0 - edits.noise_reduction_contrast / 100.0 * 0.5 * EDIT_STRENGTH;

    for i in 0..data.len() / 3 {
        let idx = i * 3;
        let orig_l = luminance(data[idx], data[idx + 1], data[idx + 2]);
        let blur_l = luminance(blurred[idx], blurred[idx + 1], blurred[idx + 2]);
        let target = orig_l * (1.0 - strength) + blur_l * strength;
        let new_l = orig_l + (target - orig_l) * contrast;
        if orig_l > 1e-6 {
            let s = new_l / orig_l;
            data[idx] = clamp01(data[idx] * s);
            data[idx + 1] = clamp01(data[idx + 1] * s);
            data[idx + 2] = clamp01(data[idx + 2] * s);
        }
    }
}

fn apply_color_nr(data: &mut [f32], width: u32, height: u32, edits: &DetailEdits) {
    let strength = edits.noise_reduction_color / 100.0 * EDIT_STRENGTH;
    if strength <= 0.01 {
        return;
    }
    let original = data.to_vec();
    for y in 0..height {
        for x in 0..width {
            let mut rs = [0.0f32; 9];
            let mut gs = [0.0f32; 9];
            let mut bs = [0.0f32; 9];
            let mut i = 0usize;
            for dy in -1i32..=1 {
                for dx in -1i32..=1 {
                    let sx = (x as i32 + dx).clamp(0, width as i32 - 1) as u32;
                    let sy = (y as i32 + dy).clamp(0, height as i32 - 1) as u32;
                    let idx = ((sy * width + sx) * 3) as usize;
                    rs[i] = original[idx];
                    gs[i] = original[idx + 1];
                    bs[i] = original[idx + 2];
                    i += 1;
                }
            }
            let idx = ((y * width + x) * 3) as usize;
            data[idx] = original[idx] * (1.0 - strength) + median9(rs) * strength;
            data[idx + 1] = original[idx + 1] * (1.0 - strength) + median9(gs) * strength;
            data[idx + 2] = original[idx + 2] * (1.0 - strength) + median9(bs) * strength;
        }
    }
}

fn median9(mut values: [f32; 9]) -> f32 {
    values.sort_unstable_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    values[4]
}
