use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Arc, Mutex, OnceLock};

use chrono::Utc;
use exif::{In, Reader, Tag};
use thiserror::Error;
use walkdir::WalkDir;

use crate::catalog::{Catalog, FolderRow, PhotoRow};
use crate::raw::{embedded_jpeg, jpeg_backend, rawloader_backend};

const THUMB_MAX: u32 = 200;
const THUMB_JPEG_QUALITY: u8 = 65;
const THUMB_WORKERS: usize = 4;

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
        init_thumbnail_workers(catalog_db_path.clone());
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
        import_folder(&self.catalog, &path).map_err(Into::into)
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

    pub fn generate_thumbnails(&self, photo_ids: Vec<i64>) -> Result<u32, LibraryError> {
        Ok(enqueue_thumbnails(
            &self.catalog,
            &self.catalog_db_path,
            photo_ids,
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

/// Fast sRGB thumbnail: embedded JPEG for RAW, direct decode for JPEG; no linear pipeline.
fn write_thumbnail_file(source: &Path, out_path: &Path) -> anyhow::Result<()> {
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
    crate::jpeg_encode::write_srgb_jpeg(
        &mut buffer,
        rgb.as_raw(),
        rgb.width(),
        rgb.height(),
        THUMB_JPEG_QUALITY,
    )
    .map_err(|e| anyhow::anyhow!(e))?;
    fs::write(out_path, buffer)?;
    Ok(())
}

pub fn generate_thumbnail(photo_id: i64, source: &Path, out_dir: &Path) -> anyhow::Result<String> {
    fs::create_dir_all(out_dir)?;
    let out_path = out_dir.join(format!("{photo_id}.jpg"));
    write_thumbnail_file(source, &out_path)?;
    Ok(out_path.to_string_lossy().into_owned())
}

static THUMB_QUEUE: OnceLock<mpsc::Sender<(PathBuf, i64, PathBuf)>> = OnceLock::new();

fn init_thumbnail_workers(_catalog_db_path: PathBuf) {
    THUMB_QUEUE.get_or_init(|| {
        let (tx, rx) = mpsc::channel::<(PathBuf, i64, PathBuf)>();
        let rx = Arc::new(Mutex::new(rx));
        let thumb_dir = thumbnails_dir();
        let _ = fs::create_dir_all(&thumb_dir);

        for i in 0..THUMB_WORKERS {
            let rx = Arc::clone(&rx);
            let out = thumb_dir.clone();
            std::thread::Builder::new()
                .name(format!("thumb-worker-{i}"))
                .spawn(move || loop {
                    let job = {
                        let guard = rx.lock().unwrap();
                        guard.recv().ok()
                    };
                    let Some((db_path, photo_id, source)) = job else {
                        break;
                    };
                    if let Ok(catalog) = Catalog::open(&db_path) {
                        if let Ok(thumb) = generate_thumbnail(photo_id, &source, &out) {
                            let _ = catalog.set_thumbnail(photo_id, &thumb);
                        }
                    }
                })
                .ok();
        }
        tx
    });
}

fn enqueue_thumbnail_jobs(catalog_db_path: &Path, jobs: Vec<(i64, PathBuf)>) -> u32 {
    if jobs.is_empty() {
        return 0;
    }
    init_thumbnail_workers(catalog_db_path.to_path_buf());
    let tx = THUMB_QUEUE.get().expect("thumbnail workers initialized");
    let db_path = catalog_db_path.to_path_buf();
    let count = jobs.len() as u32;
    for (photo_id, source) in jobs {
        let _ = tx.send((db_path.clone(), photo_id, source));
    }
    count
}

fn enqueue_thumbnails(
    catalog: &Catalog,
    catalog_db_path: &Path,
    photo_ids: Vec<i64>,
) -> anyhow::Result<u32> {
    let jobs: Vec<(i64, PathBuf)> = catalog
        .photos_missing_thumbnails(&photo_ids)?
        .into_iter()
        .map(|(id, path)| (id, PathBuf::from(path)))
        .collect();
    Ok(enqueue_thumbnail_jobs(catalog_db_path, jobs))
}

fn refresh_folder_thumbnails(
    catalog: &Catalog,
    catalog_db_path: &Path,
    folder_id: i64,
) -> anyhow::Result<u32> {
    let photo_ids: Vec<i64> = catalog
        .list_photos(Some(folder_id))?
        .into_iter()
        .filter(|p| p.thumbnail_path.is_none())
        .map(|p| p.id)
        .collect();
    enqueue_thumbnails(catalog, catalog_db_path, photo_ids)
}

fn parent_folder_id(catalog: &Catalog, dir_path: &Path, root: &Path) -> anyhow::Result<Option<i64>> {
    if dir_path == root {
        return Ok(None);
    }
    let parent_path = dir_path
        .parent()
        .ok_or_else(|| anyhow::anyhow!("directory has no parent: {}", dir_path.display()))?
        .to_string_lossy()
        .into_owned();
    catalog
        .get_folder_id_by_path(&parent_path)?
        .ok_or_else(|| anyhow::anyhow!("parent folder not indexed: {parent_path}"))
        .map(Some)
}

fn import_files_in_dir(
    catalog: &Catalog,
    folder_id: i64,
    dir_path: &Path,
    now: &str,
) -> anyhow::Result<(u32, u32)> {
    let mut imported = 0u32;
    let mut skipped = 0u32;

    for entry in fs::read_dir(dir_path)? {
        let entry = entry?;
        let entry_path = entry.path();
        if !entry_path.is_file() || !is_supported(&entry_path) {
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
        let file_size = entry.metadata().ok().map(|m| m.len() as i64);
        catalog.insert_photo(
            folder_id,
            &file_path,
            &file_name,
            file_size,
            None,
            None,
            None,
            None,
            None,
            now,
        )?;
        imported += 1;
    }

    Ok((imported, skipped))
}

pub fn import_folder(catalog: &Catalog, folder_path: &str) -> anyhow::Result<ImportResult> {
    let root = PathBuf::from(folder_path);
    if !root.is_dir() {
        anyhow::bail!("not a directory: {folder_path}");
    }
    let now = Utc::now().to_rfc3339();
    let root_id = catalog.upsert_folder(folder_path, None, &now)?;
    let mut imported = 0u32;
    let mut skipped = 0u32;

    for entry in WalkDir::new(&root).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_dir() {
            continue;
        }
        let dir_path = entry.path();
        let dir_path_str = dir_path.to_string_lossy().into_owned();
        let parent_id = parent_folder_id(catalog, dir_path, &root)?;
        let folder_id = catalog.upsert_folder(&dir_path_str, parent_id, &now)?;
        let (dir_imported, dir_skipped) = import_files_in_dir(catalog, folder_id, dir_path, &now)?;
        imported += dir_imported;
        skipped += dir_skipped;
    }

    Ok(ImportResult {
        folder_id: root_id,
        imported,
        skipped,
    })
}
