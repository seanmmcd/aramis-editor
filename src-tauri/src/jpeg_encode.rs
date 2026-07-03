use std::io::Write;
use std::sync::OnceLock;

use image::codecs::jpeg::JpegEncoder;
use image::{ExtendedColorType, ImageEncoder};

/// Compact sRGB v4 ICC profile (IEC 61966-2.1), from saucecontrol/Compact-ICC-Profiles.
const SRGB_ICC_PROFILE: &[u8] = include_bytes!("../assets/sRGB.icc");

fn srgb_icc_profile() -> &'static Vec<u8> {
    static PROFILE: OnceLock<Vec<u8>> = OnceLock::new();
    PROFILE.get_or_init(|| SRGB_ICC_PROFILE.to_vec())
}

pub fn write_srgb_jpeg<W: Write>(
    writer: W,
    rgb: &[u8],
    width: u32,
    height: u32,
    quality: u8,
) -> Result<(), String> {
    let quality = quality.clamp(1, 100);
    let mut encoder = JpegEncoder::new_with_quality(writer, quality);
    encoder
        .set_icc_profile(srgb_icc_profile().clone())
        .map_err(|e| format!("icc profile not supported: {e}"))?;
    encoder
        .write_image(rgb, width, height, ExtendedColorType::Rgb8)
        .map_err(|e| e.to_string())
}