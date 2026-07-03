use serde::{Deserialize, Serialize};

use crate::raw::DecodedImage;

use super::util::sample_bilinear;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum SpotHealMode {
    #[default]
    Heal,
    Clone,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HealSpot {
    pub id: String,
    pub dest_x: f32,
    pub dest_y: f32,
    pub source_x: f32,
    pub source_y: f32,
    /// Radius as a fraction of min(image width, image height).
    pub radius: f32,
    pub mode: SpotHealMode,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(default)]
pub struct SpotHealEdits {
    pub spots: Vec<HealSpot>,
}

fn smoothstep(edge0: f32, edge1: f32, x: f32) -> f32 {
    if edge0 >= edge1 {
        return if x >= edge1 { 1.0 } else { 0.0 };
    }
    let t = ((x - edge0) / (edge1 - edge0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

fn ring_mean(
    data: &[f32],
    width: u32,
    height: u32,
    cx: f32,
    cy: f32,
    inner_r: f32,
    outer_r: f32,
) -> [f32; 3] {
    let mut sum = [0.0f32; 3];
    let mut count = 0.0f32;
    const SAMPLES: usize = 24;

    for i in 0..SAMPLES {
        let angle = (i as f32 / SAMPLES as f32) * std::f32::consts::TAU;
        let cos = angle.cos();
        let sin = angle.sin();
        for &r in &[inner_r, (inner_r + outer_r) * 0.5, outer_r] {
            let x = cx + cos * r;
            let y = cy + sin * r;
            if x < 0.0 || y < 0.0 || x >= width as f32 || y >= height as f32 {
                continue;
            }
            let sample = sample_bilinear(data, width, height, x, y);
            sum[0] += sample[0];
            sum[1] += sample[1];
            sum[2] += sample[2];
            count += 1.0;
        }
    }

    if count <= 0.0 {
        return sample_bilinear(data, width, height, cx, cy);
    }
    [sum[0] / count, sum[1] / count, sum[2] / count]
}

fn apply_spot(data: &mut [f32], width: u32, height: u32, spot: &HealSpot) {
    let min_dim = width.min(height) as f32;
    let radius = (spot.radius * min_dim).max(2.0);
    let dest_cx = spot.dest_x * width as f32;
    let dest_cy = spot.dest_y * height as f32;
    let offset_x = (spot.source_x - spot.dest_x) * width as f32;
    let offset_y = (spot.source_y - spot.dest_y) * height as f32;
    let source_cx = dest_cx + offset_x;
    let source_cy = dest_cy + offset_y;

    let color_delta = if spot.mode == SpotHealMode::Heal {
        let inner = radius * 0.82;
        let outer = radius * 0.98;
        let dest_mean = ring_mean(data, width, height, dest_cx, dest_cy, inner, outer);
        let src_mean = ring_mean(data, width, height, source_cx, source_cy, inner, outer);
        [
            dest_mean[0] - src_mean[0],
            dest_mean[1] - src_mean[1],
            dest_mean[2] - src_mean[2],
        ]
    } else {
        [0.0, 0.0, 0.0]
    };

    let x0 = (dest_cx - radius).floor().max(0.0) as u32;
    let y0 = (dest_cy - radius).floor().max(0.0) as u32;
    let x1 = (dest_cx + radius).ceil().min(width as f32 - 1.0) as u32;
    let y1 = (dest_cy + radius).ceil().min(height as f32 - 1.0) as u32;

    for y in y0..=y1 {
        for x in x0..=x1 {
            let px = x as f32 + 0.5;
            let py = y as f32 + 0.5;
            let dist = ((px - dest_cx).powi(2) + (py - dest_cy).powi(2)).sqrt();
            if dist > radius {
                continue;
            }

            let weight = 1.0 - smoothstep(radius * 0.72, radius, dist);
            if weight <= 0.0 {
                continue;
            }

            let src = sample_bilinear(data, width, height, px + offset_x, py + offset_y);
            let patched = [
                (src[0] + color_delta[0]).clamp(0.0, 1.0),
                (src[1] + color_delta[1]).clamp(0.0, 1.0),
                (src[2] + color_delta[2]).clamp(0.0, 1.0),
            ];

            let idx = ((y * width + x) * 3) as usize;
            let orig = [data[idx], data[idx + 1], data[idx + 2]];
            data[idx] = orig[0] * (1.0 - weight) + patched[0] * weight;
            data[idx + 1] = orig[1] * (1.0 - weight) + patched[1] * weight;
            data[idx + 2] = orig[2] * (1.0 - weight) + patched[2] * weight;
        }
    }
}

pub fn apply_spot_heal(mut image: DecodedImage, edits: &SpotHealEdits) -> DecodedImage {
    if edits.spots.is_empty() {
        return image;
    }

    let width = image.width;
    let height = image.height;
    for spot in &edits.spots {
        apply_spot(&mut image.data, width, height, spot);
    }
    image
}

#[cfg(test)]
mod tests {
    use super::*;

    fn solid_image(w: u32, h: u32, rgb: [f32; 3]) -> DecodedImage {
        let mut data = vec![0.0f32; (w * h * 3) as usize];
        for px in data.chunks_exact_mut(3) {
            px.copy_from_slice(&rgb);
        }
        DecodedImage { width: w, height: h, data }
    }

    #[test]
    fn clone_spot_copies_source_color() {
        let mut image = solid_image(100, 100, [0.2, 0.2, 0.2]);
        for x in 65..=75 {
            let idx = (50 * 100 + x) * 3;
            image.data[idx] = 0.9;
            image.data[idx + 1] = 0.1;
            image.data[idx + 2] = 0.1;
        }

        let spot = HealSpot {
            id: "test".into(),
            dest_x: 0.5,
            dest_y: 0.5,
            source_x: 0.7,
            source_y: 0.5,
            radius: 0.08,
            mode: SpotHealMode::Clone,
        };

        let result = apply_spot_heal(image, &SpotHealEdits { spots: vec![spot] });
        let center = (50 * 100 + 50) * 3;
        assert!(result.data[center] > 0.45, "red channel was {}", result.data[center]);
        assert!(result.data[center + 1] < 0.2);
    }
}
