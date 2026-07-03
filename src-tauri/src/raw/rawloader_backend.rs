use std::path::Path;

use rawloader::{RawImage, RawImageData};

use crate::edits::white_balance_multipliers;

use super::jpeg_backend;
use super::{DecodeError, DecodedImage};

pub const SUPPORTED: &[&str] = &[
    "nef", "nrw", "cr2", "cr3", "arw", "dng", "raf", "orf", "rw2", "pef",
];

pub fn read_dimensions(path: &Path) -> Result<(u32, u32), DecodeError> {
    let raw = rawloader::decode_file(path).map_err(|e| DecodeError::Msg(e.to_string()))?;
    let [top, right, bottom, left] = raw.crops;
    let w = raw.width.saturating_sub(left + right);
    let h = raw.height.saturating_sub(top + bottom);
    if w == 0 || h == 0 {
        return Err(DecodeError::Msg("invalid crop".into()));
    }
    Ok((w as u32, h as u32))
}

pub fn decode(path: &Path) -> Result<DecodedImage, DecodeError> {
    let raw = rawloader::decode_file(path).map_err(|e| DecodeError::Msg(e.to_string()))?;
    let [top, right, bottom, left] = raw.crops;
    let w = raw.width.saturating_sub(left + right);
    let h = raw.height.saturating_sub(top + bottom);
    if w == 0 || h == 0 {
        return Err(DecodeError::Msg("invalid crop".into()));
    }
    let wb = wb_multipliers_for_decode(&raw);
    let cam_to_xyz = raw.cam_to_xyz_normalized();
    let mut rgb = if raw.cpp == 3 {
        let mut rgb = rgb3(&raw, top, left, w, h, &wb)?;
        gamma_encoded_to_linear(&mut rgb);
        rgb
    } else if raw.cpp == 1 {
        bayer(&raw, top, left, w, h, &wb)?
    } else {
        return Err(DecodeError::Msg(format!("cpp {}", raw.cpp)));
    };
    apply_camera_to_linear_srgb(&mut rgb, &cam_to_xyz);
    let mut image = DecodedImage::new(w as u32, h as u32, rgb);
    image = super::apply_rawloader_orientation(image, raw.orientation);
    Ok(image)
}

fn wb_multipliers_for_decode(raw: &RawImage) -> [f32; 4] {
    let coeffs = raw.wb_coeffs;
    if coeffs[0] > 0.0
        && coeffs[1] > 0.0
        && coeffs[2] > 0.0
        && coeffs[0].is_finite()
        && coeffs[1].is_finite()
        && coeffs[2].is_finite()
    {
        let g = coeffs[1].max(1e-6);
        return [coeffs[0] / g, 1.0, coeffs[2] / g, coeffs[3] / g];
    }
    let neutral = raw.neutralwb();
    [neutral[0], neutral[1], neutral[2], neutral[3]]
}

/// Map as-shot white balance coefficients to develop Temp/Tint sliders.
pub fn wb_coeffs_to_temp_tint(coeffs: [f64; 4]) -> Option<(f32, f32)> {
    if !coeffs[0].is_finite()
        || !coeffs[1].is_finite()
        || !coeffs[2].is_finite()
        || coeffs[0] <= 0.0
        || coeffs[1] <= 0.0
        || coeffs[2] <= 0.0
    {
        return None;
    }
    let r_mul = (coeffs[0] / coeffs[1]) as f32;
    let b_mul = (coeffs[2] / coeffs[1]) as f32;
    if !r_mul.is_finite() || !b_mul.is_finite() || r_mul <= 0.0 || b_mul <= 0.0 {
        return None;
    }

    let mut best_temp = 6500.0f32;
    let mut best_tint = 0.0f32;
    let mut best_err = f32::MAX;

    let mut temp = 2000.0f32;
    while temp <= 50_000.0 {
        let mut tint = -150.0f32;
        while tint <= 150.0 {
            let m = white_balance_multipliers(temp, tint);
            let err = (m[0] - r_mul).powi(2) + (m[2] - b_mul).powi(2);
            if err < best_err {
                best_err = err;
                best_temp = temp;
                best_tint = tint;
            }
            tint += 5.0;
        }
        temp += 100.0;
    }

    // Refine around the coarse best fit.
    let mut temp = (best_temp - 200.0).max(2000.0);
    while temp <= (best_temp + 200.0).min(50_000.0) {
        let mut tint = (best_tint - 10.0).max(-150.0);
        while tint <= (best_tint + 10.0).min(150.0) {
            let m = white_balance_multipliers(temp, tint);
            let err = (m[0] - r_mul).powi(2) + (m[2] - b_mul).powi(2);
            if err < best_err {
                best_err = err;
                best_temp = temp;
                best_tint = tint;
            }
            tint += 1.0;
        }
        temp += 25.0;
    }

    if best_err > 0.05 {
        return None;
    }
    Some((best_temp.round(), best_tint.round()))
}

/// Read as-shot white balance from a RAW file for develop slider initialization.
pub fn read_as_shot_white_balance(path: &Path) -> Option<(f32, f32)> {
    let raw = rawloader::decode_file(path).ok()?;
    let coeffs = raw.wb_coeffs;
    wb_coeffs_to_temp_tint([
        coeffs[0] as f64,
        coeffs[1] as f64,
        coeffs[2] as f64,
        coeffs[3] as f64,
    ]).or_else(|| {
        let neutral = raw.neutralwb();
        wb_coeffs_to_temp_tint([
            neutral[0] as f64,
            neutral[1] as f64,
            neutral[2] as f64,
            neutral[3] as f64,
        ])
    })
}

fn channel_range(raw: &RawImage, cfa_color: usize) -> (f32, f32) {
    let idx = cfa_color.min(3);
    let black = raw.blacklevels[idx] as f32;
    let white = raw.whitelevels[idx] as f32;
    (black, (white - black).max(1.0))
}

fn normalize_integer(raw: &RawImage, cfa_color: usize, value: u16) -> f32 {
    let (black, range) = channel_range(raw, cfa_color);
    (value as f32 - black) / range
}

fn rgb3(
    raw: &RawImage,
    top: usize,
    left: usize,
    w: usize,
    h: usize,
    wb: &[f32; 4],
) -> Result<Vec<f32>, DecodeError> {
    let mut out = vec![0.0; w * h * 3];
    match &raw.data {
        RawImageData::Integer(d) => {
            for y in 0..h {
                for x in 0..w {
                    let s = ((y + top) * raw.width + (x + left)) * 3;
                    let t = (y * w + x) * 3;
                    out[t] = normalize_integer(raw, 0, d[s]) * wb[0];
                    out[t + 1] = normalize_integer(raw, 1, d[s + 1]) * wb[1];
                    out[t + 2] = normalize_integer(raw, 2, d[s + 2]) * wb[2];
                }
            }
        }
        RawImageData::Float(d) => {
            for y in 0..h {
                for x in 0..w {
                    let s = ((y + top) * raw.width + (x + left)) * 3;
                    let t = (y * w + x) * 3;
                    out[t] = d[s].max(0.0) * wb[0];
                    out[t + 1] = d[s + 1].max(0.0) * wb[1];
                    out[t + 2] = d[s + 2].max(0.0) * wb[2];
                }
            }
        }
    }
    Ok(out)
}

fn bayer(
    raw: &RawImage,
    top: usize,
    left: usize,
    w: usize,
    h: usize,
    wb: &[f32; 4],
) -> Result<Vec<f32>, DecodeError> {
    let cfa = raw.cropped_cfa();
    let sample = |y: usize, x: usize| -> f32 {
        let i = (y + top) * raw.width + (x + left);
        let color = cfa.color_at(y, x);
        match &raw.data {
            RawImageData::Integer(d) => normalize_integer(raw, color, d[i]),
            RawImageData::Float(d) => d[i].max(0.0),
        }
    };
    let avg4 = |y0: usize, x0: usize, y1: usize, x1: usize| -> f32 {
        (sample(y0, x0) + sample(y0, x1) + sample(y1, x0) + sample(y1, x1)) * 0.25
    };
    let avg2h = |y: usize, x0: usize, x1: usize| -> f32 {
        (sample(y, x0) + sample(y, x1)) * 0.5
    };
    let avg2v = |y0: usize, y1: usize, x: usize| -> f32 {
        (sample(y0, x) + sample(y1, x)) * 0.5
    };
    let mut out = vec![0.0; w * h * 3];
    for y in 0..h {
        for x in 0..w {
            let y0 = y.saturating_sub(1);
            let y1 = (y + 1).min(h - 1);
            let x0 = x.saturating_sub(1);
            let x1 = (x + 1).min(w - 1);
            let (r, g, b) = match cfa.color_at(y, x) {
                0 => (
                    sample(y, x),
                    (sample(y0, x) + sample(y1, x) + sample(y, x0) + sample(y, x1)) * 0.25,
                    avg4(y0, x0, y1, x1),
                ),
                2 => (
                    avg4(y0, x0, y1, x1),
                    (sample(y0, x) + sample(y1, x) + sample(y, x0) + sample(y, x1)) * 0.25,
                    sample(y, x),
                ),
                // G on an R row: R is horizontal, B is vertically adjacent on the next B row.
                1 if cfa.color_at(y, x0) == 0 || cfa.color_at(y, x1) == 0 => (
                    avg2h(y, x0, x1),
                    sample(y, x),
                    sample(if y1 > y { y1 } else { y0 }, x),
                ),
                // G on a B row: B is horizontal, R is vertically adjacent on the next R row.
                1 => (
                    avg2v(y0, y1, x),
                    sample(y, x),
                    avg2h(y, x0, x1),
                ),
                _ => (sample(y, x), sample(y, x), sample(y, x)),
            };
            let t = (y * w + x) * 3;
            out[t] = r * wb[0];
            out[t + 1] = g * wb[1];
            out[t + 2] = b * wb[2];
        }
    }
    Ok(out)
}

fn gamma_encoded_to_linear(data: &mut [f32]) {
    for v in data.iter_mut() {
        *v = jpeg_backend::srgb_encoded_to_linear(v.clamp(0.0, 1.0));
    }
}

/// Camera RGB → XYZ (D65) → linear sRGB. Matches embedded-JPEG color science for export.
fn apply_camera_to_linear_srgb(data: &mut [f32], cam_to_xyz: &[[f32; 4]; 3]) {
    for px in data.chunks_exact_mut(3) {
        let r = px[0];
        let g = px[1];
        let b = px[2];
        let x = r * cam_to_xyz[0][0] + g * cam_to_xyz[0][1] + b * cam_to_xyz[0][2];
        let y = r * cam_to_xyz[1][0] + g * cam_to_xyz[1][1] + b * cam_to_xyz[1][2];
        let z = r * cam_to_xyz[2][0] + g * cam_to_xyz[2][1] + b * cam_to_xyz[2][2];
        px[0] = (3.2404542 * x - 1.5371385 * y - 0.4985314 * z).max(0.0);
        px[1] = (-0.9692660 * x + 1.8760108 * y + 0.0415560 * z).max(0.0);
        px[2] = (0.0556434 * x - 0.2040259 * y + 1.0572252 * z).max(0.0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    fn mean_luminance(data: &[f32]) -> f32 {
        data.chunks_exact(3)
            .map(|c| 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2])
            .sum::<f32>()
            / (data.len() / 3) as f32
    }

    fn mean_rgb(data: &[f32]) -> [f32; 3] {
        let n = (data.len() / 3) as f32;
        let mut s = [0.0f32; 3];
        for c in data.chunks_exact(3) {
            s[0] += c[0];
            s[1] += c[1];
            s[2] += c[2];
        }
        [s[0] / n, s[1] / n, s[2] / n]
    }

    #[test]
    fn optional_nef_neutral_decode_is_usable() {
        let path = match std::env::var("ARAMIS_TEST_NEF") {
            Ok(p) => Path::new(&p).to_path_buf(),
            Err(_) => {
                eprintln!("skip: set ARAMIS_TEST_NEF to run RAW decode integration test");
                return;
            }
        };
        if !path.exists() {
            eprintln!("skip: {} not found", path.display());
            return;
        }

        let decoded = decode(&path).expect("raw decode");

        eprintln!(
            "neutral decode mean rgb=({:.4}, {:.4}, {:.4}) lum={:.4}",
            mean_rgb(&decoded.data)[0],
            mean_rgb(&decoded.data)[1],
            mean_rgb(&decoded.data)[2],
            mean_luminance(&decoded.data)
        );

        assert!(
            mean_luminance(&decoded.data) > 0.01,
            "neutral decode too dark"
        );
        let rgb = mean_rgb(&decoded.data);
        assert!(
            rgb[1] > rgb[2] * 0.5 && rgb[0] > 0.001,
            "channels collapsed: r={:.4} g={:.4} b={:.4}",
            rgb[0],
            rgb[1],
            rgb[2]
        );
    }
}

