use std::io::Cursor;
use std::path::Path;

use image::{DynamicImage, GenericImageView};

use super::{DecodeError, DecodedImage};

pub const SUPPORTED: &[&str] = &["jpg", "jpeg", "png", "tif", "tiff"];

pub fn read_dimensions(path: &Path) -> Result<(u32, u32), DecodeError> {
    image::image_dimensions(path).map_err(|e| DecodeError::Msg(e.to_string()))
}

pub fn decode_from_memory(bytes: &[u8]) -> Result<DecodedImage, DecodeError> {
    let img = image::load_from_memory(bytes).map_err(|e| DecodeError::Msg(e.to_string()))?;
    Ok(rgb_image_to_decoded(&img))
}

pub fn decode(path: &Path) -> Result<DecodedImage, DecodeError> {
    let img = image::open(path).map_err(|e| DecodeError::Msg(e.to_string()))?;
    Ok(rgb_image_to_decoded(&img))
}

fn rgb_image_to_decoded(img: &DynamicImage) -> DecodedImage {
    let (w, h) = img.dimensions();
    let rgb = img.to_rgb8();
    let mut data = Vec::with_capacity((w * h * 3) as usize);
    for px in rgb.pixels() {
        data.push(srgb_to_linear(px[0] as f32 / 255.0));
        data.push(srgb_to_linear(px[1] as f32 / 255.0));
        data.push(srgb_to_linear(px[2] as f32 / 255.0));
    }
    DecodedImage::new(w, h, data)
}

pub fn dimensions_from_memory(bytes: &[u8]) -> Result<(u32, u32), DecodeError> {
    image::ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|e| DecodeError::Msg(e.to_string()))?
        .into_dimensions()
        .map_err(|e| DecodeError::Msg(e.to_string()))
}

pub(crate) fn srgb_encoded_to_linear(v: f32) -> f32 {
    if v <= 0.04045 {
        v / 12.92
    } else {
        ((v + 0.055) / 1.055).powf(2.4)
    }
}

fn srgb_to_linear(v: f32) -> f32 {
    srgb_encoded_to_linear(v)
}
