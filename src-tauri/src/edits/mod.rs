/// Global multiplier for develop-slider effect strength (1.0 = full slider range).
pub const EDIT_STRENGTH: f32 = 1.0;

mod basic;
mod basic_types;
mod calibration;
mod color_grading;
mod crop;
mod detail;
mod effects;
mod hsl;
mod lens;
mod stack;
mod tone_curve;
mod transform;
mod util;

pub use basic::white_balance_multipliers;
pub use basic_types::{apply_basic, BasicEdits};
pub use calibration::{apply_calibration, CalibrationEdits};
pub use color_grading::{apply_color_grading, ColorGradeZone, ColorGradingEdits};
pub use crop::{apply_crop, CropEdits, CropSettings};
pub use detail::{apply_detail, apply_detail_preview, apply_preview_sharpen_compensation, DetailEdits};
pub use effects::{apply_effects, EffectsEdits};
pub use hsl::{apply_hsl, HslEdits};
pub use lens::{apply_lens, LensEdits};
pub use stack::{
    apply_edit_stack, apply_edit_stack_preview, apply_edit_stack_preview_skip_crop,
    apply_edit_stack_skip_crop, apply_geometry_edits, apply_pixel_edits,
};
pub use tone_curve::{apply_tone_curve, ParametricCurve, ToneCurveEdits};
pub use transform::{apply_transform, TransformEdits};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(default)]
pub struct EditStack {
    pub basic: BasicEdits,
    pub tone_curve: ToneCurveEdits,
    pub hsl: HslEdits,
    pub color_grading: ColorGradingEdits,
    pub calibration: CalibrationEdits,
    pub crop: CropEdits,
    pub transform: TransformEdits,
    pub lens: LensEdits,
    pub detail: DetailEdits,
    pub effects: EffectsEdits,
}

impl EditStack {
    pub fn describe_change(from: &Self, to: &Self) -> String {
        if from.crop != to.crop {
            return "Crop".into();
        }
        if from.transform != to.transform {
            return "Transform".into();
        }
        if from.lens != to.lens {
            return "Lens Corrections".into();
        }
        if from.detail != to.detail {
            return "Detail".into();
        }
        if (from.basic.exposure - to.basic.exposure).abs() > f32::EPSILON {
            return format!("Exposure {:+.2}", to.basic.exposure);
        }
        if (from.basic.contrast - to.basic.contrast).abs() > f32::EPSILON {
            return format!("Contrast {:+.0}", to.basic.contrast);
        }
        "Edit".into()
    }
}
