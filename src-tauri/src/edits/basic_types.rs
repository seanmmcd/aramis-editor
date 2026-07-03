use serde::{Deserialize, Serialize};

use super::basic::{
    apply_contrast, apply_exposure, apply_highlights_shadows, apply_vibrance_saturation,
    apply_white_balance, apply_whites_blacks,
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct BasicEdits {
    pub exposure: f32,
    pub contrast: f32,
    pub highlights: f32,
    pub shadows: f32,
    pub whites: f32,
    pub blacks: f32,
    pub temp: f32,
    pub tint: f32,
    /// WB reference baked into the decoded image (6500/0 for neutral RAW; as-shot for embedded JPEG).
    pub wb_baseline_temp: f32,
    pub wb_baseline_tint: f32,
    pub vibrance: f32,
    pub saturation: f32,
}

impl Default for BasicEdits {
    fn default() -> Self {
        Self {
            exposure: 0.0,
            contrast: 0.0,
            highlights: 0.0,
            shadows: 0.0,
            whites: 0.0,
            blacks: 0.0,
            temp: 6500.0,
            tint: 0.0,
            wb_baseline_temp: 6500.0,
            wb_baseline_tint: 0.0,
            vibrance: 0.0,
            saturation: 0.0,
        }
    }
}

pub fn apply_basic(data: &mut [f32], edits: &BasicEdits) {
    apply_white_balance(
        data,
        edits.temp,
        edits.tint,
        edits.wb_baseline_temp,
        edits.wb_baseline_tint,
    );
    apply_exposure(data, edits.exposure);
    apply_contrast(data, edits.contrast);
    apply_highlights_shadows(data, edits.highlights, edits.shadows);
    apply_whites_blacks(data, edits.whites, edits.blacks);
    apply_vibrance_saturation(data, edits.vibrance, edits.saturation);
}
