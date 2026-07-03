use std::path::Path;
use std::sync::OnceLock;

use rayon::prelude::*;
use thiserror::Error;

pub mod embedded_jpeg;
pub mod jpeg_backend;
pub mod rawloader_backend;

#[derive(Debug, Clone)]
pub struct DecodedImage {
    pub width: u32,
    pub height: u32,
    pub data: Vec<f32>,
}

impl DecodedImage {
    pub fn new(width: u32, height: u32, data: Vec<f32>) -> Self {
        Self { width, height, data }
    }
}

#[derive(Debug, Error)]
pub enum DecodeError {
    #[error("{0}")]
    Msg(String),
}

pub fn all_supported_extensions() -> Vec<&'static str> {
    let mut exts = rawloader_backend::SUPPORTED.to_vec();
    exts.extend(jpeg_backend::SUPPORTED);
    exts.sort_unstable();
    exts.dedup();
    exts
}

pub fn list_supported_formats() -> Vec<String> {
    all_supported_extensions()
        .into_iter()
        .map(|s| s.to_string())
        .collect()
}

pub fn list_supported_raw_formats() -> Vec<String> {
    rawloader_backend::SUPPORTED
        .iter()
        .map(|s| s.to_ascii_uppercase())
        .collect()
}

/// Image decoders (especially RAW/TIFF) can exceed the default 1 MB main-thread stack on Windows.
const DECODE_STACK: usize = 8 * 1024 * 1024;

pub fn decode_image(path: &Path) -> Result<DecodedImage, DecodeError> {
    let ext = path
        .extension()
        .and_then(|v| v.to_str())
        .map(str::to_ascii_lowercase)
        .ok_or_else(|| DecodeError::Msg("no extension".into()))?;
    if rawloader_backend::SUPPORTED.contains(&ext.as_str()) {
        // Prefer embedded JPEG (matches Windows Explorer / camera preview).
        embedded_jpeg::decode(path)
            .and_then(|img| {
                if is_decoded_blank(&img) {
                    Err(DecodeError::Msg("blank embedded jpeg".into()))
                } else {
                    Ok(img)
                }
            })
            .or_else(|embedded_err| {
                rawloader_backend::decode(path)
                    .and_then(|img| {
                        if is_decoded_blank(&img) {
                            Err(DecodeError::Msg("blank raw decode".into()))
                        } else {
                            Ok(img)
                        }
                    })
                    .map_err(|_| embedded_err)
            })
    } else if jpeg_backend::SUPPORTED.contains(&ext.as_str()) {
        jpeg_backend::decode(path)
    } else {
        Err(DecodeError::Msg(format!("unsupported: {ext}")))
    }
}

pub fn decode_image_on_large_stack(path: &Path) -> Result<DecodedImage, DecodeError> {
    let path = path.to_path_buf();
    std::thread::Builder::new()
        .stack_size(DECODE_STACK)
        .spawn(move || decode_image(&path))
        .map_err(|e| DecodeError::Msg(e.to_string()))?
        .join()
        .map_err(|_| DecodeError::Msg("decode thread panicked".into()))?
}

/// Read image dimensions without full pixel decode.
pub fn read_dimensions(path: &Path) -> Result<(u32, u32), DecodeError> {
    let ext = path
        .extension()
        .and_then(|v| v.to_str())
        .map(str::to_ascii_lowercase)
        .ok_or_else(|| DecodeError::Msg("no extension".into()))?;
    if rawloader_backend::SUPPORTED.contains(&ext.as_str()) {
        embedded_jpeg::read_dimensions(path).or_else(|_| rawloader_backend::read_dimensions(path))
    } else if jpeg_backend::SUPPORTED.contains(&ext.as_str()) {
        jpeg_backend::read_dimensions(path)
    } else {
        Err(DecodeError::Msg(format!("no dimension reader for: {ext}")))
    }
}

pub fn is_decoded_blank(image: &DecodedImage) -> bool {
    if image.data.is_empty() {
        return true;
    }
    let step = (image.data.len() / 3000).max(3);
    image
        .data
        .iter()
        .step_by(step)
        .copied()
        .fold(0.0f32, f32::max)
        < 0.002
}

pub fn linear_to_srgb_u8(v: f32) -> u8 {
    let s = if v <= 0.0031308 {
        v * 12.92
    } else {
        1.055 * v.powf(1.0 / 2.4) - 0.055
    };
    (s.clamp(0.0, 1.0) * 255.0).round() as u8
}

pub fn linear_to_srgb_u8_buffer(data: &[f32], width: u32, height: u32) -> Vec<u8> {
    let _ = (width, height);
    let mut out = Vec::with_capacity(data.len());
    for &v in data {
        out.push(linear_to_srgb_u8(v));
    }
    out
}

pub fn linear_to_srgb_buffer(data: &[f32], width: u32, height: u32) -> Vec<u8> {
    linear_to_srgb_u8_buffer(data, width, height)
}

pub fn linear_rgb_to_srgb_bytes(data: &[f32]) -> Vec<u8> {
    let lut = srgb_lut_16();
    data.par_iter()
        .map(|&v| {
            if v <= 1.0 {
                let idx = (v * 65535.0).round() as usize;
                lut[idx.min(65535)]
            } else {
                linear_to_srgb_u8(v)
            }
        })
        .collect()
}

fn srgb_lut_16() -> &'static [u8; 65536] {
    static LUT: OnceLock<[u8; 65536]> = OnceLock::new();
    LUT.get_or_init(|| {
        let mut lut = [0u8; 65536];
        for (i, slot) in lut.iter_mut().enumerate() {
            *slot = linear_to_srgb_u8(i as f32 / 65535.0);
        }
        lut
    })
}

/// Fast downscale for export when the output is much smaller than the source.
pub fn resize_for_export(image: DecodedImage, nw: u32, nh: u32) -> DecodedImage {
    if image.width == nw && image.height == nh {
        return image;
    }
    let longest = image.width.max(image.height);
    let target_longest = nw.max(nh);
    if nw < image.width && nh < image.height && longest > target_longest * 2 {
        let mut current = image;
        while current.width > nw * 2 && current.height > nh * 2 {
            current = half_downsample(&current);
        }
        return resize_to(&current, nw, nh);
    }
    resize_to(&image, nw, nh)
}

pub fn resize_for_preview(image: &DecodedImage, max_dim: u32) -> DecodedImage {
    resize_for_preview_fast(image, max_dim)
}

/// Fast downscale for library thumbnails (box + bilinear, no Lanczos).
pub fn resize_for_thumbnail(image: &DecodedImage, max_dim: u32) -> DecodedImage {
    let longest = image.width.max(image.height);
    if longest <= max_dim {
        return image.clone();
    }
    let mut current = image.clone();
    loop {
        let longest = current.width.max(current.height);
        if longest <= max_dim {
            return current;
        }
        if longest > max_dim * 2 {
            current = half_downsample(&current);
        } else {
            let scale = max_dim as f32 / longest as f32;
            let nw = ((current.width as f32 * scale).round() as u32).max(1);
            let nh = ((current.height as f32 * scale).round() as u32).max(1);
            return resize_to(&current, nw, nh);
        }
    }
}

/// Rotate decoded pixels to match EXIF orientation (sensor-aligned RAW export).
pub fn apply_exif_orientation(mut image: DecodedImage, orientation: u32) -> DecodedImage {
    match orientation {
        3 => rotate_180(&mut image),
        6 => rotate_90_cw(&mut image),
        8 => rotate_90_ccw(&mut image),
        _ => {}
    }
    image
}

/// Apply rawloader orientation (flip then transpose per lib docs).
pub fn apply_rawloader_orientation(mut image: DecodedImage, orientation: rawloader::Orientation) -> DecodedImage {
    let (transpose, flip_h, flip_v) = orientation.to_flips();
    if flip_h {
        flip_horizontal(&mut image);
    }
    if flip_v {
        flip_vertical(&mut image);
    }
    if transpose {
        transpose_in_place(&mut image);
    }
    image
}

/// Discrete 90° steps; swaps width/height so aspect ratio is preserved.
pub fn rotate_decoded_by_degrees(image: DecodedImage, degrees: f32) -> DecodedImage {
    let d = ((degrees.round() as i32 % 360) + 360) % 360;
    match d {
        0 => image,
        90 => apply_exif_orientation(image, 6),
        180 => apply_exif_orientation(image, 3),
        270 => apply_exif_orientation(image, 8),
        _ => image,
    }
}

fn rotate_180(image: &mut DecodedImage) {
    let n = image.data.len() / 3;
    for i in 0..n / 2 {
        let a = i * 3;
        let b = (n - 1 - i) * 3;
        for c in 0..3 {
            image.data.swap(a + c, b + c);
        }
    }
}

fn rotate_90_cw(image: &mut DecodedImage) {
    let w = image.width;
    let h = image.height;
    let mut out = vec![0.0f32; image.data.len()];
    for y in 0..h {
        for x in 0..w {
            let dst_x = h - 1 - y;
            let dst_y = x;
            let src = ((y * w + x) * 3) as usize;
            let dst = ((dst_y * h + dst_x) * 3) as usize;
            out[dst..dst + 3].copy_from_slice(&image.data[src..src + 3]);
        }
    }
    image.width = h;
    image.height = w;
    image.data = out;
}

fn rotate_90_ccw(image: &mut DecodedImage) {
    let w = image.width;
    let h = image.height;
    let mut out = vec![0.0f32; image.data.len()];
    for y in 0..h {
        for x in 0..w {
            let dst_x = y;
            let dst_y = w - 1 - x;
            let src = ((y * w + x) * 3) as usize;
            let dst = ((dst_y * h + dst_x) * 3) as usize;
            out[dst..dst + 3].copy_from_slice(&image.data[src..src + 3]);
        }
    }
    image.width = h;
    image.height = w;
    image.data = out;
}

fn flip_horizontal(image: &mut DecodedImage) {
    let w = image.width;
    let h = image.height;
    for y in 0..h {
        for x in 0..(w / 2) {
            let a = ((y * w + x) * 3) as usize;
            let b = ((y * w + (w - 1 - x)) * 3) as usize;
            for c in 0..3 {
                image.data.swap(a + c, b + c);
            }
        }
    }
}

fn flip_vertical(image: &mut DecodedImage) {
    let w = image.width;
    let h = image.height;
    for y in 0..(h / 2) {
        for x in 0..w {
            let a = ((y * w + x) * 3) as usize;
            let b = (((h - 1 - y) * w + x) * 3) as usize;
            for c in 0..3 {
                image.data.swap(a + c, b + c);
            }
        }
    }
}

fn transpose_in_place(image: &mut DecodedImage) {
    let w = image.width;
    let h = image.height;
    let mut out = vec![0.0f32; image.data.len()];
    for y in 0..h {
        for x in 0..w {
            let src = ((y * w + x) * 3) as usize;
            let dst = ((x * h + y) * 3) as usize;
            out[dst..dst + 3].copy_from_slice(&image.data[src..src + 3]);
        }
    }
    image.width = h;
    image.height = w;
    image.data = out;
}

/// Multi-pass box downsample for large RAW → preview resizes (much faster than single-pass bilinear).
pub fn resize_for_preview_fast(image: &DecodedImage, max_dim: u32) -> DecodedImage {
    let longest = image.width.max(image.height);
    if longest <= max_dim {
        return image.clone();
    }
    let mut current = image.clone();
    loop {
        let longest = current.width.max(current.height);
        if longest <= max_dim {
            return current;
        }
        if longest > max_dim * 2 {
            current = half_downsample(&current);
        } else {
            let scale = max_dim as f32 / longest as f32;
            let nw = ((current.width as f32 * scale).round() as u32).max(1);
            let nh = ((current.height as f32 * scale).round() as u32).max(1);
            return resize_to_lanczos3(&current, nw, nh);
        }
    }
}

fn half_downsample(image: &DecodedImage) -> DecodedImage {
    let nw = (image.width / 2).max(1);
    let nh = (image.height / 2).max(1);
    let mut out = vec![0.0f32; (nw * nh * 3) as usize];
    for y in 0..nh {
        for x in 0..nw {
            let mut r = 0.0f32;
            let mut g = 0.0f32;
            let mut b = 0.0f32;
            let mut n = 0.0f32;
            for dy in 0..2u32 {
                for dx in 0..2u32 {
                    let sx = (x * 2 + dx).min(image.width - 1);
                    let sy = (y * 2 + dy).min(image.height - 1);
                    let idx = ((sy * image.width + sx) * 3) as usize;
                    r += image.data[idx];
                    g += image.data[idx + 1];
                    b += image.data[idx + 2];
                    n += 1.0;
                }
            }
            let dst = ((y * nw + x) * 3) as usize;
            out[dst] = r / n;
            out[dst + 1] = g / n;
            out[dst + 2] = b / n;
        }
    }
    DecodedImage::new(nw, nh, out)
}

pub fn resize_to(image: &DecodedImage, nw: u32, nh: u32) -> DecodedImage {
    if image.width == nw && image.height == nh {
        return image.clone();
    }
    let sw = image.width as f32;
    let sh = image.height as f32;
    let mut out = vec![0.0f32; (nw * nh * 3) as usize];
    for y in 0..nh {
        for x in 0..nw {
            let sx = (x as f32 + 0.5) * sw / nw as f32 - 0.5;
            let sy = (y as f32 + 0.5) * sh / nh as f32 - 0.5;
            let x0 = sx.floor().clamp(0.0, sw - 1.0) as u32;
            let y0 = sy.floor().clamp(0.0, sh - 1.0) as u32;
            let x1 = (x0 + 1).min(image.width - 1);
            let y1 = (y0 + 1).min(image.height - 1);
            let fx = sx - x0 as f32;
            let fy = sy - y0 as f32;
            let dst = ((y * nw + x) * 3) as usize;
            for c in 0..3 {
                let p00 = sample(&image.data, image.width, x0, y0, c);
                let p10 = sample(&image.data, image.width, x1, y0, c);
                let p01 = sample(&image.data, image.width, x0, y1, c);
                let p11 = sample(&image.data, image.width, x1, y1, c);
                let top = p00 * (1.0 - fx) + p10 * fx;
                let bottom = p01 * (1.0 - fx) + p11 * fx;
                out[dst + c] = top * (1.0 - fy) + bottom * fy;
            }
        }
    }
    DecodedImage::new(nw, nh, out)
}

/// High-quality final downscale for preview path (Lanczos3 via fast_image_resize).
fn resize_to_lanczos3(image: &DecodedImage, nw: u32, nh: u32) -> DecodedImage {
    use fast_image_resize as fir;
    use fast_image_resize::images::Image;

    if image.width == nw && image.height == nh {
        return image.clone();
    }

    let mut src_bytes = Vec::with_capacity((image.width * image.height * 3) as usize);
    for px in image.data.chunks_exact(3) {
        src_bytes.push(linear_to_srgb_u8(px[0]));
        src_bytes.push(linear_to_srgb_u8(px[1]));
        src_bytes.push(linear_to_srgb_u8(px[2]));
    }

    let src_image = match Image::from_vec_u8(image.width, image.height, src_bytes, fir::PixelType::U8x3)
    {
        Ok(img) => img,
        Err(_) => return resize_to(image, nw, nh),
    };

    let mut dst_image = Image::new(nw, nh, fir::PixelType::U8x3);
    let mut resizer = fir::Resizer::new();
    let options = fir::ResizeOptions::new().resize_alg(fir::ResizeAlg::Convolution(
        fir::FilterType::Lanczos3,
    ));
    if resizer
        .resize(&src_image, &mut dst_image, &options)
        .is_err()
    {
        return resize_to(image, nw, nh);
    }

    let dst_bytes = dst_image.into_vec();
    let mut data = Vec::with_capacity(dst_bytes.len());
    for &v in &dst_bytes {
        data.push(srgb_u8_to_linear(v));
    }
    DecodedImage::new(nw, nh, data)
}

fn srgb_u8_to_linear(v: u8) -> f32 {
    let s = v as f32 / 255.0;
    if s <= 0.04045 {
        s / 12.92
    } else {
        ((s + 0.055) / 1.055).powf(2.4)
    }
}

fn sample(data: &[f32], width: u32, x: u32, y: u32, channel: usize) -> f32 {
    data[((y * width + x) * 3 + channel as u32) as usize]
}
