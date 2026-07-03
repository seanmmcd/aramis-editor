use serde::{Deserialize, Serialize};

use crate::raw::DecodedImage;

use super::util::{luminance, sample_bilinear};
use super::EDIT_STRENGTH;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct LensEdits {
    pub enable_profile: bool,
    pub profile_name: String,
    pub distortion: f32,
    pub vignette: f32,
    pub chromatic_aberration: f32,
    pub defringe: f32,
}

impl Default for LensEdits {
    fn default() -> Self {
        Self {
            enable_profile: false,
            profile_name: String::new(),
            distortion: 0.0,
            vignette: 0.0,
            chromatic_aberration: 0.0,
            defringe: 0.0,
        }
    }
}

pub fn apply_lens(image: DecodedImage, edits: &LensEdits) -> DecodedImage {
    if !edits.enable_profile
        && edits.distortion.abs() < 0.01
        && edits.vignette.abs() < 0.01
        && edits.chromatic_aberration.abs() < 0.01
        && edits.defringe.abs() < 0.01
    {
        return image;
    }

    let w = image.width;
    let h = image.height;
    let cx = w as f32 * 0.5;
    let cy = h as f32 * 0.5;
    let max_r = ((cx * cx + cy * cy).sqrt()).max(1.0);

    let mut distortion = edits.distortion;
    if edits.enable_profile {
        distortion -= 15.0;
    }

    let k1 = distortion / 100.0 * 0.35 * EDIT_STRENGTH;
    let k2 = k1 * 0.25;
    let vignette = edits.vignette / 100.0 * EDIT_STRENGTH;
    let ca = edits.chromatic_aberration / 100.0 * EDIT_STRENGTH;
    let defringe = edits.defringe / 100.0 * EDIT_STRENGTH;
    let mut out = vec![0.0f32; image.data.len()];

    for y in 0..h {
        for x in 0..w {
            let dx = (x as f32 + 0.5 - cx) / max_r;
            let dy = (y as f32 + 0.5 - cy) / max_r;
            let r = (dx * dx + dy * dy).sqrt();
            let r_dist = r * (1.0 + k1 * r * r + k2 * r.powi(4));
            let scale = if r > 1e-6 { r_dist / r } else { 1.0 };
            let sx = cx + dx * max_r * scale;
            let sy = cy + dy * max_r * scale;

            let mut rgb = sample_bilinear(&image.data, w, h, sx, sy);
            if ca.abs() > 0.01 {
                rgb[0] = sample_bilinear(&image.data, w, h, cx + dx * max_r * scale * (1.0 + ca * 0.02), sy)[0];
                rgb[2] = sample_bilinear(&image.data, w, h, sx, cy + dy * max_r * scale / (1.0 + ca * 0.02))[2];
            }

            let vf = 1.0 - vignette * r * r;
            rgb[0] *= vf;
            rgb[1] *= vf;
            rgb[2] *= vf;

            if defringe > 0.01 {
                let luma = luminance(rgb[0], rgb[1], rgb[2]);
                let sat = rgb[0].max(rgb[1]).max(rgb[2]) - rgb[0].min(rgb[1]).min(rgb[2]);
                if sat > 0.15 {
                    rgb[0] = rgb[0] * (1.0 - defringe) + luma * defringe;
                    rgb[1] = rgb[1] * (1.0 - defringe) + luma * defringe;
                    rgb[2] = rgb[2] * (1.0 - defringe) + luma * defringe;
                }
            }

            let idx = ((y * w + x) * 3) as usize;
            out[idx..idx + 3].copy_from_slice(&rgb);
        }
    }

    DecodedImage {
        width: w,
        height: h,
        data: out,
    }
}
