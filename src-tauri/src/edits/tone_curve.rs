use serde::{Deserialize, Serialize};

use super::util::{clamp01, lerp};
use super::EDIT_STRENGTH;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ParametricCurve {
    pub shadows: f32,
    pub darks: f32,
    pub lights: f32,
    pub highlights: f32,
    pub shadow_split: f32,
    pub midtone_split: f32,
    pub highlight_split: f32,
}

impl Default for ParametricCurve {
    fn default() -> Self {
        Self {
            shadows: 0.0,
            darks: 0.0,
            lights: 0.0,
            highlights: 0.0,
            shadow_split: 0.25,
            midtone_split: 0.5,
            highlight_split: 0.75,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToneCurveEdits {
    pub mode: String,
    pub parametric: ParametricCurve,
    pub points: Vec<[f32; 2]>,
}

impl Default for ToneCurveEdits {
    fn default() -> Self {
        Self {
            mode: "parametric".into(),
            parametric: ParametricCurve::default(),
            points: vec![[0.0, 0.0], [1.0, 1.0]],
        }
    }
}

pub fn apply_tone_curve(data: &mut [f32], edits: &ToneCurveEdits) {
    if is_identity_tone_curve(edits) {
        return;
    }
    let lut = if edits.mode == "point" {
        build_point_lut(&edits.points)
    } else {
        build_parametric_lut(&edits.parametric)
    };
    for c in data.iter_mut() {
        let idx = (clamp01(*c) * 255.0).round() as usize;
        *c = lut[idx.min(255)];
    }
}

fn is_identity_tone_curve(edits: &ToneCurveEdits) -> bool {
    if edits.mode == "point" {
        edits.points.len() == 2
            && (edits.points[0][0] - edits.points[0][1]).abs() < f32::EPSILON
            && (edits.points[1][0] - edits.points[1][1]).abs() < f32::EPSILON
            && edits.points[0][0].abs() < f32::EPSILON
            && (edits.points[1][0] - 1.0).abs() < f32::EPSILON
    } else {
        let p = &edits.parametric;
        p.shadows.abs() < 0.01
            && p.darks.abs() < 0.01
            && p.lights.abs() < 0.01
            && p.highlights.abs() < 0.01
    }
}

fn build_parametric_lut(edits: &ParametricCurve) -> [f32; 256] {
    let mut lut = [0.0_f32; 256];
    for i in 0..256 {
        let x = i as f32 / 255.0;
        let mut y = x;
        if x < edits.shadow_split {
            y += edits.shadows / 100.0 * EDIT_STRENGTH * (edits.shadow_split - x);
        } else if x < edits.midtone_split {
            y += edits.darks / 100.0 * EDIT_STRENGTH * (x - edits.shadow_split);
        } else if x < edits.highlight_split {
            y += edits.lights / 100.0 * EDIT_STRENGTH * (x - edits.midtone_split);
        } else {
            y += edits.highlights / 100.0 * EDIT_STRENGTH * (x - edits.highlight_split);
        }
        lut[i] = clamp01(y);
    }
    lut
}

fn build_point_lut(points: &[[f32; 2]]) -> [f32; 256] {
    let mut sorted = points.to_vec();
    sorted.sort_by(|a, b| a[0].partial_cmp(&b[0]).unwrap());
    if sorted.is_empty() {
        sorted = vec![[0.0, 0.0], [1.0, 1.0]];
    }
    let mut lut = [0.0_f32; 256];
    for i in 0..256 {
        let x = i as f32 / 255.0;
        let mut j = 0;
        while j + 1 < sorted.len() && sorted[j + 1][0] < x {
            j += 1;
        }
        lut[i] = clamp01(if j + 1 >= sorted.len() {
            sorted.last().map(|p| p[1]).unwrap_or(x)
        } else {
            let (x0, y0) = (sorted[j][0], sorted[j][1]);
            let (x1, y1) = (sorted[j + 1][0], sorted[j + 1][1]);
            if (x1 - x0).abs() < 1e-6 {
                y0
            } else {
                lerp(y0, y1, (x - x0) / (x1 - x0))
            }
        });
    }
    lut
}
