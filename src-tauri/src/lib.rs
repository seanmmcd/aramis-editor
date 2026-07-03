mod catalog;
mod editor;
mod edits;
mod export;
mod jpeg_encode;
mod history;
mod library;
mod metadata;
mod presets;
mod preview_worker;
mod raw;
mod settings;
mod snapshots;
mod upscale;
mod xmp;

use std::path::Path;
use std::sync::Arc;

use base64::{engine::general_purpose::STANDARD, Engine};
use catalog::{Catalog, FolderRow, PhotoRow};
use editor::{Editor, EditorError};
use edits::EditStack;
use export::{export_batch_prepared, export_photo, BatchExportResult, ExportResult, ExportSettings};
use history::HistoryEntry;
use library::{ImportResult, Library, LibraryError};
use presets::Preset;
use preview_worker::{PreviewCache, PreviewResponse, PreviewWorker};
use settings::AppSettings;
use snapshots::Snapshot;
use tauri::Manager;

struct AppState {
    library: std::sync::Mutex<Library>,
    settings: std::sync::Mutex<AppSettings>,
    settings_path: std::path::PathBuf,
    preview_cache: Arc<PreviewCache>,
    preview_worker: PreviewWorker,
}

impl AppState {
    fn with_library<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&Library) -> Result<T, LibraryError>,
    {
        let guard = self.library.lock().map_err(|e| e.to_string())?;
        f(&guard).map_err(|e| e.to_string())
    }

    fn with_editor<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&Editor<'_>) -> Result<T, EditorError>,
    {
        let library = self.library.lock().map_err(|e| e.to_string())?;
        f(&Editor::new(library.catalog())).map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn list_supported_raw_formats() -> Vec<String> {
    raw::list_supported_raw_formats()
}

#[tauri::command]
fn import_folder(state: tauri::State<'_, AppState>, path: String) -> Result<ImportResult, String> {
    state.with_library(|lib| lib.import_folder(path))
}

#[tauri::command]
fn list_photos(state: tauri::State<'_, AppState>, folder_id: Option<i64>) -> Result<Vec<PhotoRow>, String> {
    state.with_library(|lib| lib.list_photos(folder_id))
}

#[tauri::command]
fn get_folders(state: tauri::State<'_, AppState>) -> Result<Vec<FolderRow>, String> {
    state.with_library(|lib| lib.get_folders())
}

#[tauri::command]
fn remove_folder(state: tauri::State<'_, AppState>, folder_id: i64) -> Result<(), String> {
    state.with_library(|lib| lib.remove_folder(folder_id))
}

#[tauri::command]
fn remove_photo(state: tauri::State<'_, AppState>, photo_id: i64) -> Result<(), String> {
    state.with_library(|lib| lib.remove_photo(photo_id))
}

#[tauri::command]
fn search_photos(state: tauri::State<'_, AppState>, query: String) -> Result<Vec<PhotoRow>, String> {
    state.with_library(|lib| lib.search_photos(query))
}

#[tauri::command]
fn refresh_folder_thumbnails(state: tauri::State<'_, AppState>, folder_id: i64) -> Result<u32, String> {
    state.with_library(|lib| lib.refresh_folder_thumbnails(folder_id))
}

#[tauri::command]
fn generate_thumbnails(state: tauri::State<'_, AppState>, photo_ids: Vec<i64>) -> Result<u32, String> {
    state.with_library(|lib| lib.generate_thumbnails(photo_ids))
}

#[tauri::command]
fn get_photo_edits(state: tauri::State<'_, AppState>, photo_id: i64) -> Result<EditStack, String> {
    state.with_editor(|e| e.get_edits(photo_id))
}

#[tauri::command]
fn save_edits(state: tauri::State<'_, AppState>, photo_id: i64, edits: EditStack, label: Option<String>) -> Result<EditStack, String> {
    state.with_editor(|e| e.update_edits(photo_id, edits, label))
}

#[tauri::command]
fn create_preset(state: tauri::State<'_, AppState>, name: String, folder: String, edits: EditStack) -> Result<i64, String> {
    state.with_editor(|e| e.create_preset(&name, &folder, &edits))
}

#[tauri::command]
fn list_presets(state: tauri::State<'_, AppState>) -> Result<Vec<Preset>, String> {
    state.with_editor(|e| e.list_presets())
}

#[tauri::command]
fn delete_preset(state: tauri::State<'_, AppState>, preset_id: i64) -> Result<(), String> {
    state.with_editor(|e| e.delete_preset(preset_id))
}

#[tauri::command]
fn apply_preset(state: tauri::State<'_, AppState>, photo_id: i64, preset_id: i64) -> Result<EditStack, String> {
    state.with_editor(|e| e.apply_preset(photo_id, preset_id))
}

#[tauri::command]
fn list_history(state: tauri::State<'_, AppState>, photo_id: i64) -> Result<Vec<HistoryEntry>, String> {
    state.with_editor(|e| e.list_history(photo_id))
}

#[tauri::command]
fn restore_history(state: tauri::State<'_, AppState>, photo_id: i64, history_id: i64) -> Result<EditStack, String> {
    state.with_editor(|e| e.restore_history(photo_id, history_id))
}

#[tauri::command]
fn restore_original(state: tauri::State<'_, AppState>, photo_id: i64) -> Result<EditStack, String> {
    state.with_editor(|e| e.restore_original(photo_id))
}

#[tauri::command]
fn create_snapshot(state: tauri::State<'_, AppState>, photo_id: i64, name: String) -> Result<i64, String> {
    state.with_editor(|e| e.create_snapshot(photo_id, &name))
}

#[tauri::command]
fn list_snapshots(state: tauri::State<'_, AppState>, photo_id: i64) -> Result<Vec<Snapshot>, String> {
    state.with_editor(|e| e.list_snapshots(photo_id))
}

#[tauri::command]
fn restore_snapshot(state: tauri::State<'_, AppState>, photo_id: i64, snapshot_id: i64) -> Result<EditStack, String> {
    state.with_editor(|e| e.restore_snapshot(photo_id, snapshot_id))
}

#[tauri::command]
fn get_edits_for_path(path: String) -> Result<EditStack, String> {
    Ok(metadata::detect_edits_for_path(Path::new(&path)))
}

#[tauri::command]
fn get_photo_id_by_path(state: tauri::State<'_, AppState>, path: String) -> Result<Option<i64>, String> {
    state.with_library(|lib| {
        lib.catalog()
            .get_photo_id_by_path(&path)
            .map_err(LibraryError::from)
    })
}

#[tauri::command]
fn save_edits_for_path(
    state: tauri::State<'_, AppState>,
    path: String,
    edits: EditStack,
) -> Result<(), String> {
    state.with_editor(|e| e.save_edits_for_path(Path::new(&path), &edits))
}

fn encode_quick_preview(preview: &raw::DecodedImage, quality: preview_worker::PreviewQuality) -> Result<PreviewResponse, String> {
    let rgb = raw::linear_rgb_to_srgb_bytes(&preview.data);
    let mut buffer = Vec::new();
    jpeg_encode::write_srgb_jpeg(
        &mut buffer,
        &rgb,
        preview.width,
        preview.height,
        quality.jpeg_quality(),
    )?;
    Ok(PreviewResponse {
        width: preview.width,
        height: preview.height,
        png_base64: STANDARD.encode(buffer),
    })
}

#[tauri::command]
fn get_quick_preview(
    path: String,
    edits: EditStack,
    apply_crop: Option<bool>,
    state: tauri::State<'_, AppState>,
) -> Result<PreviewResponse, String> {
    let path = Path::new(&path);
    let quality = preview_worker::PreviewQuality::Draft;
    let base = state.preview_cache.get_interactive_base(path)?;
    let working = preview_worker::render_base_for_quality(base.as_ref(), quality);
    let rendered = if apply_crop.unwrap_or(true) {
        edits::apply_edit_stack_preview(working, &edits)
    } else {
        edits::apply_edit_stack_preview_skip_crop(working, &edits)
    };
    encode_quick_preview(&rendered, quality)
}

#[tauri::command]
fn warm_preview_cache(path: String, state: tauri::State<'_, AppState>) {
    let cache = Arc::clone(&state.preview_cache);
    let path = std::path::PathBuf::from(path);
    std::thread::Builder::new()
        .name("preview-warm".into())
        .spawn(move || cache.warm(&path))
        .ok();
}

#[tauri::command]
fn apply_edits(
    path: String,
    edits: EditStack,
    apply_crop: Option<bool>,
    draft: Option<bool>,
    state: tauri::State<'_, AppState>,
) -> Result<PreviewResponse, String> {
    let quality = preview_worker::PreviewQuality::from_draft_flag(draft.unwrap_or(false));
    state.preview_worker.submit(
        std::path::PathBuf::from(path),
        edits,
        apply_crop.unwrap_or(true),
        quality,
    )
}

#[tauri::command]
fn get_app_settings(state: tauri::State<'_, AppState>) -> Result<AppSettings, String> {
    state
        .settings
        .lock()
        .map(|s| s.clone())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn save_app_settings(
    state: tauri::State<'_, AppState>,
    settings: AppSettings,
) -> Result<AppSettings, String> {
    let mut guard = state.settings.lock().map_err(|e| e.to_string())?;
    *guard = settings;
    guard.save(&state.settings_path)?;
    Ok(guard.clone())
}

#[tauri::command]
async fn export_photo_cmd(
    state: tauri::State<'_, AppState>,
    photo_id: i64,
    settings: ExportSettings,
) -> Result<ExportResult, String> {
    let (path, edits) = {
        let library = state.library.lock().map_err(|e| e.to_string())?;
        let editor = Editor::new(library.catalog());
        let path = editor.get_photo_path(photo_id).map_err(|e| e.to_string())?;
        let edits = editor.get_edits(photo_id).map_err(|e| e.to_string())?;
        (path, edits)
    };
    tauri::async_runtime::spawn_blocking(move || {
        export_photo(Path::new(&path), &edits, &settings)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn export_batch_cmd(
    state: tauri::State<'_, AppState>,
    photo_ids: Vec<i64>,
    settings: ExportSettings,
) -> Result<BatchExportResult, String> {
    let thread_count = state
        .settings
        .lock()
        .map_err(|e| e.to_string())?
        .effective_export_threads();
    let prepared = {
        let library = state.library.lock().map_err(|e| e.to_string())?;
        let editor = Editor::new(library.catalog());
        let mut work: Vec<(i64, Result<(String, EditStack), String>)> =
            Vec::with_capacity(photo_ids.len());
        for &photo_id in &photo_ids {
            let item = match editor.get_photo_path(photo_id) {
                Ok(path) => match editor.get_edits(photo_id) {
                    Ok(edits) => Ok((path, edits)),
                    Err(e) => Err(e.to_string()),
                },
                Err(e) => Err(e.to_string()),
            };
            work.push((photo_id, item));
        }
        work
    };
    tauri::async_runtime::spawn_blocking(move || {
        export_batch_prepared(&prepared, &settings, thread_count)
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn open_export_folder(path: String) -> Result<(), String> {
    tauri_plugin_opener::open_path(path, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
fn reveal_file_in_explorer(path: String) -> Result<(), String> {
    tauri_plugin_opener::reveal_item_in_dir(path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data = app.path().app_data_dir().expect("app data");
            std::fs::create_dir_all(&app_data).ok();
            let settings_path = app_data.join("settings.json");
            let settings = AppSettings::load(&settings_path);
            let catalog_path = app_data.join("catalog.db");
            let catalog = Catalog::open(&catalog_path).expect("catalog");
            let library =
                Library::new(catalog, catalog_path, app_data.join("thumbnails")).expect("library");
            let preview_cache = Arc::new(PreviewCache::new());
            let preview_worker = PreviewWorker::spawn(Arc::clone(&preview_cache));
            app.manage(AppState {
                library: std::sync::Mutex::new(library),
                settings: std::sync::Mutex::new(settings),
                settings_path,
                preview_cache,
                preview_worker,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            get_app_settings,
            save_app_settings,
            list_supported_raw_formats,
            import_folder, list_photos, get_folders, remove_folder, remove_photo, search_photos,
            refresh_folder_thumbnails, generate_thumbnails,
            get_photo_edits, get_edits_for_path, get_photo_id_by_path, save_edits, save_edits_for_path,
            create_preset, list_presets, delete_preset, apply_preset,
            list_history, restore_history, restore_original,
            create_snapshot, list_snapshots, restore_snapshot,
            apply_edits,
            warm_preview_cache,
            get_quick_preview,
            export_photo_cmd,
            export_batch_cmd,
            open_export_folder,
            reveal_file_in_explorer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
