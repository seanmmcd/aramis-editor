use serde::{Deserialize, Serialize};

use crate::raw::DecodedImage;

use super::util::sample_bilinear;

/// Normalized crop rectangle (0–1) plus rotation in degrees.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct CropEdits {
    pub enabled: bool,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub angle: f32,
    pub aspect_ratio: Option<(u32, u32)>,
    pub straighten: f32,
}

impl Default for CropEdits {
    fn default() -> Self {
        Self {
            enabled: false,
            x: 0.0,
            y: 0.0,
            width: 1.0,
            height: 1.0,
            angle: 0.0,
            aspect_ratio: None,
            straighten: 0.0,
        }
    }
}

pub type CropSettings = CropEdits;

pub fn apply_crop(image: DecodedImage, edits: &CropEdits) -> DecodedImage {
    if !edits.enabled {
        return image;
    }

    let total_angle = edits.angle + edits.straighten;
    let is_full = edits.x <= 0.001
        && edits.y <= 0.001
        && edits.width >= 0.999
        && edits.height >= 0.999
        && total_angle.abs() < 0.001;

    if is_full {
        return image;
    }

    let (cx, cy, cw, ch) = normalized_rect(edits);
    let src_w = image.width as f32;
    let src_h = image.height as f32;
    let out_w = (cw * src_w).round().max(1.0) as u32;
    let out_h = (ch * src_h).round().max(1.0) as u32;
    let center_x = (cx + cw * 0.5) * src_w;
    let center_y = (cy + ch * 0.5) * src_h;
    let rad = -total_angle.to_radians();
    let cos_a = rad.cos();
    let sin_a = rad.sin();
    let mut data = vec![0.0f32; (out_w * out_h * 3) as usize];

    for oy in 0..out_h {
        for ox in 0..out_w {
            let lx = (ox as f32 + 0.5) / out_w as f32 * cw * src_w - cw * src_w * 0.5;
            let ly = (oy as f32 + 0.5) / out_h as f32 * ch * src_h - ch * src_h * 0.5;
            let sx = lx * cos_a - ly * sin_a + center_x;
            let sy = lx * sin_a + ly * cos_a + center_y;
            let rgb = sample_bilinear(&image.data, image.width, image.height, sx, sy);
            let idx = ((oy * out_w + ox) * 3) as usize;
            data[idx..idx + 3].copy_from_slice(&rgb);
        }
    }

    DecodedImage {
        width: out_w,
        height: out_h,
        data,
    }
}

fn normalized_rect(edits: &CropEdits) -> (f32, f32, f32, f32) {
    let mut x = edits.x.clamp(0.0, 1.0);
    let mut y = edits.y.clamp(0.0, 1.0);
    let mut w = edits.width.clamp(0.01, 1.0);
    let mut h = edits.height.clamp(0.01, 1.0);

    if let Some((ar_w, ar_h)) = edits.aspect_ratio {
        if ar_w > 0 && ar_h > 0 {
            let target = ar_w as f32 / ar_h as f32;
            if w / h > target {
                w = h * target;
            } else {
                h = w / target;
            }
        }
    }

    if x + w > 1.0 {
        x = (1.0 - w).max(0.0);
    }
    if y + h > 1.0 {
        y = (1.0 - h).max(0.0);
    }
    (x, y, w, h)
}
