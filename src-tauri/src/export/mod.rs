use std::fs;
use std::path::{Path, PathBuf};

use image::{ImageFormat, RgbImage};
use rayon::prelude::*;
use rayon::ThreadPoolBuilder;

use crate::jpeg_encode;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::editor::Editor;
use crate::edits::{apply_geometry_edits, apply_pixel_edits, apply_spot_heal, EditStack};
use crate::metadata::enrich_from_metadata;
use crate::raw::{
    decode_image_on_large_stack, linear_rgb_to_srgb_bytes, resize_for_export,
    resize_for_preview_fast, DecodedImage,
};
use crate::upscale::{upscale_image, UpscaleFactor};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    #[default]
    Jpeg,
    Tiff,
    Png,
    Original,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum ColorSpace {
    #[default]
    Srgb,
    Rgb1998,
    ProPhoto,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum ResizeMode {
    #[default]
    Original,
    LongEdge,
    Dimensions,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct ExportSettings {
    pub format: ExportFormat,
    pub quality: u8,
    pub color_space: ColorSpace,
    pub resize_mode: ResizeMode,
    pub long_edge: u32,
    pub width: u32,
    pub height: u32,
    pub upscale_factor: UpscaleFactor,
    pub output_folder: String,
    pub filename_template: String,
}

impl Default for ExportSettings {
    fn default() -> Self {
        Self {
            format: ExportFormat::default(),
            quality: 90,
            color_space: ColorSpace::default(),
            resize_mode: ResizeMode::default(),
            long_edge: 2048,
            width: 1920,
            height: 1080,
            upscale_factor: UpscaleFactor::default(),
            output_folder: String::new(),
            filename_template: "{filename}_edited".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ExportResult {
    pub output_path: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct BatchExportItem {
    pub photo_id: i64,
    pub result: Option<ExportResult>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BatchExportResult {
    pub items: Vec<BatchExportItem>,
    pub succeeded: u32,
    pub failed: u32,
}

#[derive(Debug, Error)]
pub enum ExportError {
    #[error("{0}")]
    Msg(String),
}

pub fn export_photo(
    path: &Path,
    edits: &EditStack,
    settings: &ExportSettings,
) -> Result<ExportResult, String> {
    export_photo_with_mode(path, edits, settings, true)
}

fn export_photo_with_mode(
    path: &Path,
    edits: &EditStack,
    settings: &ExportSettings,
    single_photo: bool,
) -> Result<ExportResult, String> {
    let decoded = decode_image_on_large_stack(path).map_err(|e| e.to_string())?;
    let mut edits = edits.clone();
    enrich_from_metadata(&mut edits, path);

    let mut working = apply_geometry_edits(decoded, &edits);
    if let Some((nw, nh)) = export_work_dimensions(&working, settings) {
        working = downscale_for_export(working, nw, nh, settings);
    }
    let rendered = apply_spot_heal(apply_pixel_edits(working, &edits), &edits.spot_heal);
    let upscaled = upscale_image(&rendered, settings.upscale_factor).map_err(|e| e.to_string())?;
    let output_path = build_output_path(path, settings, single_photo)?;
    write_image(&upscaled, &output_path, path, settings)?;
    Ok(ExportResult {
        output_path: output_path.to_string_lossy().into_owned(),
        width: upscaled.width,
        height: upscaled.height,
    })
}

fn export_thread_pool(thread_count: usize) -> rayon::ThreadPool {
    ThreadPoolBuilder::new()
        .num_threads(thread_count.max(1))
        .thread_name(|i| format!("export-{i}"))
        .build()
        .unwrap_or_else(|_| ThreadPoolBuilder::new().build().expect("export thread pool"))
}

pub fn export_batch(
    editor: &Editor,
    photo_ids: &[i64],
    settings: &ExportSettings,
    thread_count: usize,
) -> BatchExportResult {
    let mut prepared: Vec<(i64, Result<(String, EditStack), String>)> =
        Vec::with_capacity(photo_ids.len());

    for &photo_id in photo_ids {
        let item = match editor.get_photo_path(photo_id) {
            Ok(path) => match editor.get_edits(photo_id) {
                Ok(edits) => Ok((path, edits)),
                Err(e) => Err(e.to_string()),
            },
            Err(e) => Err(e.to_string()),
        };
        prepared.push((photo_id, item));
    }

    export_batch_prepared(&prepared, settings, thread_count)
}

pub fn export_batch_prepared(
    prepared: &[(i64, Result<(String, EditStack), String>)],
    settings: &ExportSettings,
    thread_count: usize,
) -> BatchExportResult {
    let single_photo = prepared.len() == 1;
    let settings = settings.clone();
    let pool = export_thread_pool(thread_count);
    let items: Vec<BatchExportItem> = pool.install(|| {
        prepared
            .par_iter()
            .map(|(photo_id, prepared)| match prepared {
                Ok((path, edits)) => match export_photo_with_mode(
                    Path::new(path),
                    edits,
                    &settings,
                    single_photo,
                ) {
                    Ok(result) => BatchExportItem {
                        photo_id: *photo_id,
                        result: Some(result),
                        error: None,
                    },
                    Err(e) => BatchExportItem {
                        photo_id: *photo_id,
                        result: None,
                        error: Some(e),
                    },
                },
                Err(e) => BatchExportItem {
                    photo_id: *photo_id,
                    result: None,
                    error: Some(e.clone()),
                },
            })
            .collect()
    });

    let mut succeeded = 0u32;
    let mut failed = 0u32;
    for item in &items {
        if item.result.is_some() {
            succeeded += 1;
        } else {
            failed += 1;
        }
    }

    BatchExportResult {
        items,
        succeeded,
        failed,
    }
}

fn export_work_dimensions(image: &DecodedImage, settings: &ExportSettings) -> Option<(u32, u32)> {
    let (nw, nh) = match settings.resize_mode {
        ResizeMode::Original => (image.width, image.height),
        ResizeMode::LongEdge => {
            if settings.long_edge == 0 {
                return None;
            }
            let max_dim = image.width.max(image.height);
            if max_dim <= settings.long_edge {
                return None;
            }
            let scale = settings.long_edge as f32 / max_dim as f32;
            (
                ((image.width as f32 * scale).round() as u32).max(1),
                ((image.height as f32 * scale).round() as u32).max(1),
            )
        }
        ResizeMode::Dimensions => {
            if settings.width == 0 || settings.height == 0 {
                return None;
            }
            (settings.width, settings.height)
        }
    };
    if nw < image.width || nh < image.height {
        Some((nw, nh))
    } else {
        None
    }
}

fn downscale_for_export(
    image: DecodedImage,
    nw: u32,
    nh: u32,
    settings: &ExportSettings,
) -> DecodedImage {
    match settings.resize_mode {
        ResizeMode::LongEdge => resize_for_preview_fast(&image, nw.max(nh)),
        _ => resize_for_export(image, nw, nh),
    }
}

fn build_output_path(
    source: &Path,
    settings: &ExportSettings,
    single_photo: bool,
) -> Result<PathBuf, String> {
    let output_dir = if single_photo {
        let parent = source
            .parent()
            .ok_or_else(|| "source image has no parent folder".to_string())?;
        parent.join("Exports")
    } else if settings.output_folder.is_empty() {
        return Err("output folder is required for batch export".into());
    } else {
        PathBuf::from(&settings.output_folder)
    };

    fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;
    let stem = source
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("photo");
    let name = settings
        .filename_template
        .replace("{filename}", stem)
        .replace("{original}", stem);
    let ext = output_extension(source, settings.format);
    Ok(output_dir.join(format!("{name}.{ext}")))
}

fn output_extension(source: &Path, format: ExportFormat) -> String {
    match format {
        ExportFormat::Jpeg => "jpg".into(),
        ExportFormat::Tiff => "tif".into(),
        ExportFormat::Png => "png".into(),
        ExportFormat::Original => match source.extension().and_then(|e| e.to_str()) {
            Some(ext) if ext.eq_ignore_ascii_case("jpeg") => "jpg".into(),
            Some(ext) if ext.eq_ignore_ascii_case("png") => "png".into(),
            Some(ext) if ext.eq_ignore_ascii_case("tif") || ext.eq_ignore_ascii_case("tiff") => "tif".into(),
            Some(ext) => ext.to_ascii_lowercase(),
            None => "jpg".into(),
        },
    }
}

fn write_image(
    image: &DecodedImage,
    output: &Path,
    source: &Path,
    settings: &ExportSettings,
) -> Result<(), String> {
    let mut rgb = linear_rgb_to_srgb_bytes(&image.data);
    apply_color_space(&mut rgb, settings.color_space);
    let img = RgbImage::from_raw(image.width, image.height, rgb)
        .ok_or_else(|| "invalid export buffer".to_string())?;

    let format = match settings.format {
        ExportFormat::Original => match source.extension().and_then(|e| e.to_str()) {
            Some(ext) if ext.eq_ignore_ascii_case("png") => ImageFormat::Png,
            Some(ext) if ext.eq_ignore_ascii_case("tif") || ext.eq_ignore_ascii_case("tiff") => {
                ImageFormat::Tiff
            }
            _ => ImageFormat::Jpeg,
        },
        ExportFormat::Jpeg => ImageFormat::Jpeg,
        ExportFormat::Tiff => ImageFormat::Tiff,
        ExportFormat::Png => ImageFormat::Png,
    };

    match format {
        ImageFormat::Jpeg => {
            let mut file = fs::File::create(output).map_err(|e| e.to_string())?;
            jpeg_encode::write_srgb_jpeg(
                &mut file,
                img.as_raw(),
                image.width,
                image.height,
                settings.quality,
            )?;
        }
        _ => img.save_with_format(output, format).map_err(|e| e.to_string())?,
    }
    Ok(())
}

fn apply_color_space(rgb: &mut [u8], space: ColorSpace) {
    if matches!(space, ColorSpace::Srgb) {
        return;
    }
    rgb.par_chunks_exact_mut(3).for_each(|px| {
        let (r, g, b) = (
            px[0] as f32 / 255.0,
            px[1] as f32 / 255.0,
            px[2] as f32 / 255.0,
        );
        let (nr, ng, nb) = match space {
            ColorSpace::Rgb1998 => (
                0.5767309 * r + 0.1855540 * g + 0.1881852 * b,
                0.2973769 * r + 0.6273491 * g + 0.0752741 * b,
                0.0270343 * r + 0.0706872 * g + 0.9911085 * b,
            ),
            ColorSpace::ProPhoto => (
                0.7995492 * r + 0.0898742 * g + 0.1105766 * b,
                0.2826909 * r + 0.8134398 * g - 0.0961307 * b,
                0.0250540 * r - 0.0978957 * g + 1.0728417 * b,
            ),
            ColorSpace::Srgb => (r, g, b),
        };
        px[0] = (nr.clamp(0.0, 1.0) * 255.0).round() as u8;
        px[1] = (ng.clamp(0.0, 1.0) * 255.0).round() as u8;
        px[2] = (nb.clamp(0.0, 1.0) * 255.0).round() as u8;
    });
}

