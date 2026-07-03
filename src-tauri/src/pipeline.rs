use std::path::Path;
use base64::{engine::general_purpose::STANDARD, Engine};
use png::{BitDepth, ColorType, Encoder};
use serde::Serialize;
use crate::edits::{apply_edit_stack, EditStack};
use crate::raw::{decode_image_on_large_stack, linear_to_srgb_u8, resize_for_preview, DecodedImage, DecodeError};

#[derive(Debug, Clone, Serialize)] pub struct PreviewResult { pub width: u32, pub height: u32, pub png_base64: String }
#[derive(Debug, Clone, Serialize)] pub struct ImageInfo { pub width: u32, pub height: u32, pub format: String }

pub fn render_full(path: &Path, stack: &EditStack) -> Result<DecodedImage, DecodeError> {
    Ok(apply_edit_stack(decode_image_on_large_stack(path)?, stack))
}

pub fn apply_edits_preview(path: &Path, stack: &EditStack, max_size: u32) -> Result<PreviewResult, String> {
    let preview = resize_for_preview(&render_full(path, stack).map_err(|e| e.to_string())?, max_size);
    Ok(PreviewResult { width: preview.width, height: preview.height, png_base64: STANDARD.encode(render_to_png_bytes(&preview)?) })
}

pub fn get_image_info(path: &Path) -> Result<ImageInfo, String> {
    let d = decode_image_on_large_stack(path).map_err(|e| e.to_string())?;
    Ok(ImageInfo { width: d.width, height: d.height, format: path.extension().and_then(|e| e.to_str()).unwrap_or("unknown").to_ascii_lowercase() })
}

pub fn render_to_png_bytes(image: &DecodedImage) -> Result<Vec<u8>, String> {
    let mut rgba = Vec::with_capacity(image.data.len() / 3 * 4);
    for c in image.data.chunks_exact(3) { rgba.extend([linear_to_srgb_u8(c[0]), linear_to_srgb_u8(c[1]), linear_to_srgb_u8(c[2]), 255]); }
    let mut buffer = Vec::new();
    let mut encoder = Encoder::new(&mut buffer, image.width, image.height);
    encoder.set_color(ColorType::Rgba); encoder.set_depth(BitDepth::Eight);
    encoder.write_header().map_err(|e| e.to_string())?.write_image_data(&rgba).map_err(|e| e.to_string())?;
    Ok(buffer)
}
