use std::fs;
use std::path::Path;

use exif::{In, Reader, Tag};

use crate::edits::{BasicEdits, CropEdits, DetailEdits, EditStack};
use crate::raw::{embedded_jpeg, rawloader_backend};
use crate::xmp;

/// Baseline develop settings before user edits (metadata defaults only, no sidecar stack).
pub fn original_edits_for_path(path: &Path) -> EditStack {
    let mut edits = EditStack::default();
    enrich_from_metadata(&mut edits, path);
    edits
}

/// Resolve develop edits for a file with no catalog row: XMP sidecar, then metadata gaps.
pub fn detect_edits_for_path(path: &Path) -> EditStack {
    if xmp::has_sidecar(path) {
        if xmp::has_aramis_saved_edits(path) {
            return xmp::read_xmp(path).unwrap_or_default();
        }
        let mut edits = xmp::read_xmp(path).unwrap_or_default();
        enrich_from_metadata(&mut edits, path);
        return edits;
    }

    let mut edits = EditStack::default();
    enrich_from_metadata(&mut edits, path);
    edits
}

/// Fill default edit fields from file metadata (RAW WB, default sharpen, crop sanity).
pub fn enrich_from_metadata(stack: &mut EditStack, path: &Path) {
    if let Some((as_shot_temp, as_shot_tint)) = read_as_shot_white_balance(path) {
        if is_default_wb(&stack.basic) {
            stack.basic.temp = as_shot_temp;
            stack.basic.tint = as_shot_tint;
        }
        let (bt, bti) = wb_baseline_for_decode(path, as_shot_temp, as_shot_tint);
        stack.basic.wb_baseline_temp = bt;
        stack.basic.wb_baseline_tint = bti;
    }
    // Do not auto-apply EXIF orientation to transform.rotate — embedded JPEG / image
    // decoders already produce display-oriented pixels; applying rotate again inverts/flips.
    apply_default_sharpening(stack, path);
    sanitize_crop(stack);
}

/// Reset invalid or disabled crop rectangles so stale values cannot affect preview.
fn sanitize_crop(stack: &mut EditStack) {
    let crop = &mut stack.crop;
    let degenerate = crop.width < 0.02
        || crop.height < 0.02
        || crop.x + crop.width > 1.01
        || crop.y + crop.height > 1.01;

    if crop.enabled && degenerate {
        *crop = CropEdits::default();
        return;
    }

    if !crop.enabled && !is_default_crop(crop) {
        crop.x = 0.0;
        crop.y = 0.0;
        crop.width = 1.0;
        crop.height = 1.0;
        crop.angle = 0.0;
        crop.straighten = 0.0;
        crop.aspect_ratio = None;
    }
}

fn is_default_wb(basic: &BasicEdits) -> bool {
    (basic.temp - 6500.0).abs() < 1.0 && basic.tint.abs() < 0.01
}

/// WB baseline matches decode path: embedded JPEG has as-shot WB baked in; neutral RAW uses 6500K.
fn wb_baseline_for_decode(path: &Path, as_shot_temp: f32, as_shot_tint: f32) -> (f32, f32) {
    if has_embedded_jpeg(path) {
        (as_shot_temp, as_shot_tint)
    } else {
        (6500.0, 0.0)
    }
}

fn has_embedded_jpeg(path: &Path) -> bool {
    fs::read(path)
        .ok()
        .and_then(|data| embedded_jpeg::extract_largest_jpeg(&data))
        .is_some()
}

fn is_default_detail(detail: &DetailEdits) -> bool {
    detail.sharpening_amount < 0.01
        && detail.noise_reduction_luminance < 0.01
        && detail.noise_reduction_color < 0.01
}

/// RAW files benefit from a modest default sharpen amount when no sidecar/detail edits exist.
fn apply_default_sharpening(stack: &mut EditStack, path: &Path) {
    if !is_default_detail(&stack.detail) {
        return;
    }
    let ext = path
        .extension()
        .and_then(|v| v.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();
    if rawloader_backend::SUPPORTED.contains(&ext.as_str()) {
        stack.detail.sharpening_amount = 40.0;
        stack.detail.sharpening_radius = 1.0;
        stack.detail.sharpening_detail = 25.0;
    }
}

pub fn read_as_shot_white_balance(path: &Path) -> Option<(f32, f32)> {
    let ext = path
        .extension()
        .and_then(|v| v.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();
    if !rawloader_backend::SUPPORTED.contains(&ext.as_str()) {
        return None;
    }
    rawloader_backend::read_as_shot_white_balance(path)
}

pub fn read_exif_orientation_tag(path: &Path) -> Option<u32> {
    let file = fs::File::open(path).ok()?;
    let mut buf = std::io::BufReader::new(file);
    let exif = Reader::new().read_from_container(&mut buf).ok()?;
    exif.get_field(Tag::Orientation, In::PRIMARY)?
        .value
        .get_uint(0)
}

pub fn is_default_crop(crop: &CropEdits) -> bool {
    !crop.enabled
        && crop.x <= 0.001
        && crop.y <= 0.001
        && crop.width >= 0.999
        && crop.height >= 0.999
        && crop.angle.abs() < 0.01
        && crop.straighten.abs() < 0.01
        && crop.aspect_ratio.is_none()
}
