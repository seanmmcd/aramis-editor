use serde::{Deserialize, Serialize};

use crate::raw::{rotate_decoded_by_degrees, DecodedImage};

use super::util::{sample_bilinear, Homography};
use super::EDIT_STRENGTH;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct TransformEdits {
    pub rotate: f32,
    pub vertical: f32,
    pub horizontal: f32,
    pub aspect: f32,
    pub scale: f32,
    pub x_offset: f32,
    pub y_offset: f32,
}

impl Default for TransformEdits {
    fn default() -> Self {
        Self {
            rotate: 0.0,
            vertical: 0.0,
            horizontal: 0.0,
            aspect: 0.0,
            scale: 0.0,
            x_offset: 0.0,
            y_offset: 0.0,
        }
    }
}

pub fn apply_transform(image: DecodedImage, edits: &TransformEdits) -> DecodedImage {
    let image = rotate_decoded_by_degrees(image, edits.rotate);

    if edits.vertical.abs() < 0.01
        && edits.horizontal.abs() < 0.01
        && edits.aspect.abs() < 0.01
        && edits.scale.abs() < 0.01
        && edits.x_offset.abs() < 0.01
        && edits.y_offset.abs() < 0.01
    {
        return image;
    }

    let w = image.width as f32;
    let h = image.height as f32;
    let dst = destination_corners(w, h, edits);
    let src = [[0.0, 0.0], [w, 0.0], [w, h], [0.0, h]];
    let homography = Homography::from_quad_to_quad(&dst, &src);
    let mut data = vec![0.0f32; image.data.len()];

    for y in 0..image.height {
        for x in 0..image.width {
            let (sx, sy) = homography.transform(x as f32 + 0.5, y as f32 + 0.5);
            let rgb = sample_bilinear(&image.data, image.width, image.height, sx, sy);
            let idx = ((y * image.width + x) * 3) as usize;
            data[idx..idx + 3].copy_from_slice(&rgb);
        }
    }

    DecodedImage {
        width: image.width,
        height: image.height,
        data,
    }
}

fn destination_corners(w: f32, h: f32, edits: &TransformEdits) -> [[f32; 2]; 4] {
    let v = edits.vertical / 100.0 * h * 0.2 * EDIT_STRENGTH;
    let hz = edits.horizontal / 100.0 * w * 0.2 * EDIT_STRENGTH;
    let scale = 1.0 + edits.scale / 100.0 * 0.3 * EDIT_STRENGTH;
    let aspect = 1.0 + edits.aspect / 100.0 * 0.15 * EDIT_STRENGTH;
    let ox = edits.x_offset / 100.0 * w * 0.1 * EDIT_STRENGTH;
    let oy = edits.y_offset / 100.0 * h * 0.1 * EDIT_STRENGTH;
    let cx = w * 0.5 + ox;
    let cy = h * 0.5 + oy;

    let mut corners = [[0.0, 0.0], [w, 0.0], [w, h], [0.0, h]];
    corners[0][1] -= v;
    corners[1][1] -= v;
    corners[0][0] -= hz;
    corners[3][0] -= hz;

    for corner in &mut corners {
        corner[0] = (corner[0] - cx) * scale * aspect + cx;
        corner[1] = (corner[1] - cy) * scale + cy;
    }
    corners
}
