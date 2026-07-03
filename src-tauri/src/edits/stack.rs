use crate::raw::DecodedImage;

use super::{
    apply_basic, apply_calibration, apply_color_grading, apply_crop, apply_detail,
    apply_detail_preview, apply_effects, apply_hsl, apply_lens, apply_tone_curve,
    apply_transform, EditStack,
};

/// Lens, transform, and crop — must run at full decode resolution.
pub fn apply_geometry_edits(mut image: DecodedImage, stack: &EditStack) -> DecodedImage {
    image = apply_lens(image, &stack.lens);
    image = apply_transform(image, &stack.transform);
    apply_crop(image, &stack.crop)
}

/// Color and detail adjustments — safe to run at export working resolution.
pub fn apply_pixel_edits(image: DecodedImage, stack: &EditStack) -> DecodedImage {
    let width = image.width;
    let height = image.height;
    let mut data = image.data;

    apply_basic(&mut data, &stack.basic);
    apply_tone_curve(&mut data, &stack.tone_curve);
    apply_hsl(&mut data, &stack.hsl);
    apply_color_grading(&mut data, &stack.color_grading);
    apply_calibration(&mut data, &stack.calibration);
    apply_detail(&mut data, width, height, &stack.detail);
    apply_effects(&mut data, width, height, &stack.effects);

    DecodedImage { width, height, data }
}

pub fn apply_edit_stack(mut image: DecodedImage, stack: &EditStack) -> DecodedImage {
    image = apply_geometry_edits(image, stack);
    apply_pixel_edits(image, stack)
}

/// Fast path for interactive preview — sharpening at preview resolution; skips noise reduction.
pub fn apply_edit_stack_preview(mut image: DecodedImage, stack: &EditStack) -> DecodedImage {
    image = apply_lens(image, &stack.lens);
    image = apply_transform(image, &stack.transform);
    image = apply_crop(image, &stack.crop);

    let width = image.width;
    let height = image.height;
    let mut data = image.data;

    apply_basic(&mut data, &stack.basic);
    apply_tone_curve(&mut data, &stack.tone_curve);
    apply_hsl(&mut data, &stack.hsl);
    apply_color_grading(&mut data, &stack.color_grading);
    apply_calibration(&mut data, &stack.calibration);
    apply_detail_preview(&mut data, width, height, &stack.detail);
    apply_effects(&mut data, width, height, &stack.effects);

    DecodedImage { width, height, data }
}

/// Full-quality develop preview without crop (crop overlay mode).
pub fn apply_edit_stack_skip_crop(mut image: DecodedImage, stack: &EditStack) -> DecodedImage {
    image = apply_lens(image, &stack.lens);
    image = apply_transform(image, &stack.transform);

    let width = image.width;
    let height = image.height;
    let mut data = image.data;

    apply_basic(&mut data, &stack.basic);
    apply_tone_curve(&mut data, &stack.tone_curve);
    apply_hsl(&mut data, &stack.hsl);
    apply_color_grading(&mut data, &stack.color_grading);
    apply_calibration(&mut data, &stack.calibration);
    apply_detail(&mut data, width, height, &stack.detail);
    apply_effects(&mut data, width, height, &stack.effects);

    DecodedImage { width, height, data }
}

/// Interactive preview while adjusting crop — same as preview path but leaves full frame visible.
pub fn apply_edit_stack_preview_skip_crop(mut image: DecodedImage, stack: &EditStack) -> DecodedImage {
    image = apply_lens(image, &stack.lens);
    image = apply_transform(image, &stack.transform);

    let width = image.width;
    let height = image.height;
    let mut data = image.data;

    apply_basic(&mut data, &stack.basic);
    apply_tone_curve(&mut data, &stack.tone_curve);
    apply_hsl(&mut data, &stack.hsl);
    apply_color_grading(&mut data, &stack.color_grading);
    apply_calibration(&mut data, &stack.calibration);
    apply_detail_preview(&mut data, width, height, &stack.detail);
    apply_effects(&mut data, width, height, &stack.effects);

    DecodedImage { width, height, data }
}
