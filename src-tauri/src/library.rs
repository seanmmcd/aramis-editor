use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use chrono::Utc;
use exif::{In, Reader, Tag};
use thiserror::Error;
use walkdir::WalkDir;

use crate::catalog::{Catalog, FolderRow, PhotoRow};
use crate::raw::{embedded_jpeg, jpeg_backend, rawloader_backend, read_dimensions};

const THUMB_MAX: u32 = 200;
const THUMB_JPEG_QUALITY: u8 = 65;
const THUMB_WORKERS: usize = 8;

#[derive(Debug, Error)]
pub enum LibraryError {
    #[error("{0}")]
    Msg(String),
}

impl From<anyhow::Error> for LibraryError {
    fn from(value: anyhow::Error) -> Self {
        LibraryError::Msg(value.to_string())
    }
}

impl From<rusqlite::Error> for LibraryError {
    fn from(value: rusqlite::Error) -> Self {
        LibraryError::Msg(value.to_string())
    }
}

impl From<std::io::Error> for LibraryError {
    fn from(value: std::io::Error) -> Self {
        LibraryError::Msg(value.to_string())
    }
}

pub struct Library {
    catalog: Catalog,
    catalog_db_path: PathBuf,
    _thumb_dir: PathBuf,
}

impl Library {
    pub fn new(
        catalog: Catalog,
        catalog_db_path: PathBuf,
        thumb_dir: PathBuf,
    ) -> Result<Self, LibraryError> {
        fs::create_dir_all(&thumb_dir)?;
        Ok(Self {
            catalog,
            catalog_db_path,
            _thumb_dir: thumb_dir,
        })
    }

    pub fn catalog(&self) -> &Catalog {
        &self.catalog
    }

    pub fn import_folder(&self, path: String) -> Result<ImportResult, LibraryError> {
        import_folder(&self.catalog, &self.catalog_db_path, &path).map_err(Into::into)
    }

    pub fn list_photos(&self, folder_id: Option<i64>) -> Result<Vec<PhotoRow>, LibraryError> {
        Ok(self.catalog.list_photos(folder_id)?)
    }

    pub fn get_folders(&self) -> Result<Vec<FolderRow>, LibraryError> {
        Ok(self.catalog.list_folders()?)
    }

    pub fn remove_folder(&self, folder_id: i64) -> Result<(), LibraryError> {
        Ok(self.catalog.remove_folder(folder_id)?)
    }

    pub fn remove_photo(&self, photo_id: i64) -> Result<(), LibraryError> {
        Ok(self.catalog.remove_photo(photo_id)?)
    }

    pub fn search_photos(&self, query: String) -> Result<Vec<PhotoRow>, LibraryError> {
        Ok(self.catalog.search_photos(&query)?)
    }

    pub fn refresh_folder_thumbnails(&self, folder_id: i64) -> Result<u32, LibraryError> {
        Ok(refresh_folder_thumbnails(
            &self.catalog,
            &self.catalog_db_path,
            folder_id,
        )?)
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ImportResult {
    pub folder_id: i64,
    pub imported: u32,
    pub skipped: u32,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ExifMetadata {
    pub capture_date: Option<String>,
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub width: Option<i32>,
    pub height: Option<i32>,
}

pub fn cache_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("aramis-editor")
        .join("cache")
}

pub fn thumbnails_dir() -> PathBuf {
    cache_dir().join("thumbnails")
}

pub fn read_exif(path: &Path) -> ExifMetadata {
    let mut meta = ExifMetadata {
        capture_date: None,
        camera_make: None,
        camera_model: None,
        width: None,
        height: None,
    };
    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return meta,
    };
    let mut buf = std::io::BufReader::new(file);
    let exif = match Reader::new().read_from_container(&mut buf) {
        Ok(e) => e,
        Err(_) => return meta,
    };
    if let Some(field) = exif.get_field(Tag::DateTimeOriginal, In::PRIMARY) {
        meta.capture_date = field.display_value().to_string().into();
    }
    if let Some(field) = exif.get_field(Tag::Make, In::PRIMARY) {
        meta.camera_make = field.display_value().to_string().into();
    }
    if let Some(field) = exif.get_field(Tag::Model, In::PRIMARY) {
        meta.camera_model = field.display_value().to_string().into();
    }
    for (tag, slot) in [
        (Tag::PixelXDimension, &mut meta.width),
        (Tag::PixelYDimension, &mut meta.height),
    ] {
        if slot.is_none() {
            if let Some(field) = exif.get_field(tag, In::PRIMARY) {
                *slot = field.value.get_uint(0).map(|v| v as i32);
            }
        }
    }
    meta
}

fn is_supported(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase)
        .map(|ext| {
            rawloader_backend::SUPPORTED.contains(&ext.as_str())
                || jpeg_backend::SUPPORTED.contains(&ext.as_str())
        })
        .unwrap_or(false)
}

/// Fast sRGB thumbnail — embedded JPEG for RAW, direct decode for JPEG; no linear pipeline.
fn write_thumbnail_file(source: &Path, out_path: &Path) -> anyhow::Result<()> {
    use image::codecs::jpeg::JpegEncoder;
    use image::ExtendedColorType;

    let ext = source
        .extension()
        .and_then(|v| v.to_str())
        .map(str::to_ascii_lowercase);

    let dyn_img = if ext.as_deref().is_some_and(|e| rawloader_backend::SUPPORTED.contains(&e)) {
        let data = fs::read(source)?;
        let jpeg = embedded_jpeg::extract_largest_jpeg(&data)
            .ok_or_else(|| anyhow::anyhow!("no embedded jpeg in raw"))?;
        image::load_from_memory(&jpeg)?
    } else {
        image::open(source)?
    };

    let thumb = dyn_img.thumbnail(THUMB_MAX, THUMB_MAX);
    let rgb = thumb.to_rgb8();
    let mut buffer = Vec::new();
    let mut encoder = JpegEncoder::new_with_quality(&mut buffer, THUMB_JPEG_QUALITY);
    encoder.encode(
        rgb.as_raw(),
        rgb.width(),
        rgb.height(),
        ExtendedColorType::Rgb8,
    )?;
    fs::write(out_path, buffer)?;
    Ok(())
}

pub fn generate_thumbnail(photo_id: i64, source: &Path, out_dir: &Path) -> anyhow::Result<String> {
    fs::create_dir_all(out_dir)?;
    let out_path = out_dir.join(format!("{photo_id}.jpg"));
    write_thumbnail_file(source, &out_path)?;
    Ok(out_path.to_string_lossy().into_owned())
}

fn refresh_folder_thumbnails(
    catalog: &Catalog,
    catalog_db_path: &Path,
    folder_id: i64,
) -> anyhow::Result<u32> {
    let photos = catalog.list_photos(Some(folder_id))?;
    let jobs: Vec<(i64, PathBuf)> = photos
        .iter()
        .map(|p| (p.id, PathBuf::from(&p.file_path)))
        .collect();
    let count = jobs.len() as u32;
    spawn_thumbnail_jobs(catalog_db_path.to_path_buf(), jobs);
    Ok(count)
}

fn spawn_thumbnail_jobs(catalog_db_path: PathBuf, jobs: Vec<(i64, PathBuf)>) {
    if jobs.is_empty() {
        return;
    }
    let thumb_dir = thumbnails_dir();
    let _ = fs::create_dir_all(&thumb_dir);
    let worker_count = THUMB_WORKERS.min(jobs.len());
    let (job_tx, job_rx) = std::sync::mpsc::channel();
    for job in jobs {
        let _ = job_tx.send(job);
    }
    drop(job_tx);
    let job_rx = Arc::new(Mutex::new(job_rx));

    for i in 0..worker_count {
        let rx = Arc::clone(&job_rx);
        let db = catalog_db_path.clone();
        let out = thumb_dir.clone();
        std::thread::Builder::new()
            .name(format!("thumb-worker-{i}"))
            .spawn(move || {
                let catalog = match Catalog::open(&db) {
                    Ok(c) => c,
                    Err(_) => return,
                };
                loop {
                    let job = {
                        let guard = rx.lock().unwrap();
                        guard.recv().ok()
                    };
                    let Some((photo_id, source)) = job else {
                        break;
                    };
                    if let Ok(thumb) = generate_thumbnail(photo_id, &source, &out) {
                        let _ = catalog.set_thumbnail(photo_id, &thumb);
                    }
                }
            })
            .ok();
    }
}

pub fn import_folder(
    catalog: &Catalog,
    catalog_db_path: &Path,
    folder_path: &str,
) -> anyhow::Result<ImportResult> {
    let path = PathBuf::from(folder_path);
    if !path.is_dir() {
        anyhow::bail!("not a directory: {folder_path}");
    }
    let now = Utc::now().to_rfc3339();
    let folder_id = catalog.upsert_folder(folder_path, &now)?;
    let mut imported = 0u32;
    let mut skipped = 0u32;
    let mut pending_thumbs = Vec::new();
    for entry in WalkDir::new(&path).into_iter().filter_map(|e| e.ok()) {
        let entry_path = entry.path();
        if !entry_path.is_file() || !is_supported(entry_path) {
            continue;
        }
        let file_path = entry_path.to_string_lossy().into_owned();
        if catalog.photo_exists(&file_path)? {
            skipped += 1;
            continue;
        }
        let file_name = entry_path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        let file_size = fs::metadata(entry_path).ok().map(|m| m.len() as i64);
        let exif = read_exif(entry_path);
        let (width, height) = if let (Some(w), Some(h)) = (exif.width, exif.height) {
            (Some(w), Some(h))
        } else if let Ok((w, h)) = read_dimensions(entry_path) {
            (Some(w as i32), Some(h as i32))
        } else {
            (None, None)
        };
        let photo_id = catalog.insert_photo(
            folder_id,
            &file_path,
            &file_name,
            file_size,
            width,
            height,
            exif.capture_date.as_deref(),
            exif.camera_make.as_deref(),
            exif.camera_model.as_deref(),
            &now,
        )?;
        pending_thumbs.push((photo_id, entry_path.to_path_buf()));
        imported += 1;
    }
    spawn_thumbnail_jobs(catalog_db_path.to_path_buf(), pending_thumbs);
    Ok(ImportResult {
        folder_id,
        imported,
        skipped,
    })
}
