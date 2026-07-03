use std::path::Path;
use crate::catalog::Catalog;
use crate::edits::EditStack;
use crate::history::HistoryEntry;
use crate::metadata;
use crate::presets::Preset;
use crate::snapshots::Snapshot;
use crate::xmp;
use thiserror::Error;

#[derive(Debug, Error)] pub enum EditorError {
    #[error("db: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
}
pub struct Editor<'a> { catalog: &'a Catalog }
impl<'a> Editor<'a> {
    pub fn new(catalog: &'a Catalog) -> Self { Self { catalog } }
    pub fn get_photo_path(&self, photo_id: i64) -> Result<String, EditorError> {
        Ok(self.catalog.get_photo_path(photo_id)?)
    }

    pub fn get_edits(&self, photo_id: i64) -> Result<EditStack, EditorError> {
        let mut edits = self.catalog.get_photo_edits(photo_id)?;
        if let Ok(path) = self.catalog.get_photo_path(photo_id) {
            metadata::enrich_from_metadata(&mut edits, Path::new(&path));
        }
        Ok(edits)
    }
    pub fn update_edits(&self, photo_id: i64, edits: EditStack, label: Option<String>) -> Result<EditStack, EditorError> {
        let prev = self.catalog.get_photo_edits(photo_id)?;
        let lbl = label.unwrap_or_else(|| EditStack::describe_change(&prev, &edits));
        self.catalog.set_photo_edits(photo_id, &edits)?;
        if prev != edits { self.catalog.push_history(photo_id, &lbl, &edits)?; }
        if let Ok(p) = self.catalog.get_photo_path(photo_id) { let _ = xmp::write_xmp(Path::new(&p), &edits); }
        Ok(edits)
    }
    pub fn create_preset(&self, name: &str, folder: &str, edits: &EditStack) -> Result<i64, EditorError> { Ok(self.catalog.create_preset(name, folder, edits)?) }
    pub fn list_presets(&self) -> Result<Vec<Preset>, EditorError> { Ok(self.catalog.list_presets()?) }
    pub fn delete_preset(&self, preset_id: i64) -> Result<(), EditorError> { Ok(self.catalog.delete_preset(preset_id)?) }
    pub fn apply_preset(&self, photo_id: i64, preset_id: i64) -> Result<EditStack, EditorError> {
        let prev = self.catalog.get_photo_edits(photo_id)?; let edits = self.catalog.apply_preset(photo_id, preset_id)?;
        let name = self.catalog.get_preset(preset_id)?.name;
        if prev != edits { self.catalog.push_history(photo_id, &format!("Preset: {name}"), &edits)?; }
        if let Ok(p) = self.catalog.get_photo_path(photo_id) { let _ = xmp::write_xmp(Path::new(&p), &edits); }
        Ok(edits)
    }
    pub fn list_history(&self, photo_id: i64) -> Result<Vec<HistoryEntry>, EditorError> { Ok(self.catalog.list_history(photo_id)?) }
    pub fn restore_history(&self, photo_id: i64, history_id: i64) -> Result<EditStack, EditorError> {
        let edits = self.catalog.restore_history(photo_id, history_id)?;
        if let Ok(p) = self.catalog.get_photo_path(photo_id) { let _ = xmp::write_xmp(Path::new(&p), &edits); }
        Ok(edits)
    }
    pub fn restore_original(&self, photo_id: i64) -> Result<EditStack, EditorError> {
        let edits = self.catalog.restore_original(photo_id)?;
        if let Ok(p) = self.catalog.get_photo_path(photo_id) { let _ = xmp::write_xmp(Path::new(&p), &edits); }
        Ok(edits)
    }
    pub fn create_snapshot(&self, photo_id: i64, name: &str) -> Result<i64, EditorError> { let e = self.catalog.get_photo_edits(photo_id)?; Ok(self.catalog.create_snapshot(photo_id, name, &e)?) }
    pub fn list_snapshots(&self, photo_id: i64) -> Result<Vec<Snapshot>, EditorError> { Ok(self.catalog.list_snapshots(photo_id)?) }
    pub fn restore_snapshot(&self, photo_id: i64, snapshot_id: i64) -> Result<EditStack, EditorError> {
        let edits = self.catalog.restore_snapshot(photo_id, snapshot_id)?;
        if let Ok(p) = self.catalog.get_photo_path(photo_id) { let _ = xmp::write_xmp(Path::new(&p), &edits); }
        Ok(edits)
    }

    /// Persist edits to an XMP sidecar; sync catalog row when the file is imported.
    pub fn save_edits_for_path(&self, path: &Path, edits: &EditStack) -> Result<(), EditorError> {
        xmp::write_xmp(path, edits)?;
        if let Ok(Some(photo_id)) = self
            .catalog
            .get_photo_id_by_path(&path.to_string_lossy())
        {
            self.catalog.set_photo_edits(photo_id, edits)?;
        }
        Ok(())
    }
}
