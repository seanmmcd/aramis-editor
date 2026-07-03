use fast_image_resize as fir;
use fast_image_resize::images::Image;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::raw::{linear_to_srgb_u8, DecodedImage};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum UpscaleFactor {
    #[default]
    X1,
    #[serde(rename = "x1_5")]
    X1_5,
    X2,
    X4,
}

impl UpscaleFactor {
    pub fn multiplier(self) -> f32 {
        match self {
            Self::X1 => 1.0,
            Self::X1_5 => 1.5,
            Self::X2 => 2.0,
            Self::X4 => 4.0,
        }
    }
}

#[derive(Debug, Error)]
pub enum UpscaleError {
    #[error("{0}")]
    Msg(String),
}

pub fn upscale_image(image: &DecodedImage, factor: UpscaleFactor) -> Result<DecodedImage, UpscaleError> {
    let scale = factor.multiplier();
    if scale <= 1.001 {
        return Ok(image.clone());
    }

    let dst_w = ((image.width as f32 * scale).round() as u32).max(1);
    let dst_h = ((image.height as f32 * scale).round() as u32).max(1);

    let mut src_bytes = Vec::with_capacity((image.width * image.height * 3) as usize);
    for px in image.data.chunks_exact(3) {
        src_bytes.push(linear_to_srgb_u8(px[0]));
        src_bytes.push(linear_to_srgb_u8(px[1]));
        src_bytes.push(linear_to_srgb_u8(px[2]));
    }

    let src_image = Image::from_vec_u8(
        image.width,
        image.height,
        src_bytes,
        fir::PixelType::U8x3,
    )
    .map_err(|e| UpscaleError::Msg(e.to_string()))?;

    let mut dst_image = Image::new(dst_w, dst_h, fir::PixelType::U8x3);
    let mut resizer = fir::Resizer::new();
    let options = fir::ResizeOptions::new().resize_alg(fir::ResizeAlg::Convolution(
        fir::FilterType::Lanczos3,
    ));
    resizer
        .resize(&src_image, &mut dst_image, &options)
        .map_err(|e| UpscaleError::Msg(e.to_string()))?;

    let dst_bytes = dst_image.into_vec();
    let mut data = Vec::with_capacity(dst_bytes.len());
    for &v in &dst_bytes {
        data.push(srgb_u8_to_linear(v));
    }

    Ok(DecodedImage::new(dst_w, dst_h, data))
}

fn srgb_u8_to_linear(v: u8) -> f32 {
    let s = v as f32 / 255.0;
    if s <= 0.04045 {
        s / 12.92
    } else {
        ((s + 0.055) / 1.055).powf(2.4)
    }
}
