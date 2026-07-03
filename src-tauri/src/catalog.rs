use rusqlite::{params, Connection, Result as SqlResult};

use crate::edits::EditStack;

const MAX_HISTORY: i64 = 100;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FolderRow {
    pub id: i64,
    pub path: String,
    pub parent_id: Option<i64>,
    pub added_at: String,
    pub photo_count: i64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PhotoRow {
    pub id: i64,
    pub folder_id: i64,
    pub file_path: String,
    pub file_name: String,
    pub file_size: Option<i64>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub capture_date: Option<String>,
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub rating: i32,
    pub imported_at: String,
    pub thumbnail_path: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Preset {
    pub id: i64,
    pub name: String,
    pub folder: String,
    pub edits: EditStack,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct HistoryEntry {
    pub id: i64,
    pub photo_id: i64,
    pub label: String,
    pub edits: EditStack,
    pub timestamp: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Snapshot {
    pub id: i64,
    pub photo_id: i64,
    pub name: String,
    pub edits: EditStack,
    pub created_at: String,
}

pub struct Catalog {
    conn: Connection,
}

impl Catalog {
    pub(crate) fn conn(&self) -> &Connection {
        &self.conn
    }

    pub fn open(path: &std::path::Path) -> SqlResult<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        let conn = Connection::open(path)?;
        let catalog = Catalog { conn };
        catalog.init_schema()?;
        Ok(catalog)
    }

    fn init_schema(&self) -> SqlResult<()> {
        self.conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS folders (
              id INTEGER PRIMARY KEY, path TEXT UNIQUE NOT NULL, parent_id INTEGER,
              added_at TEXT NOT NULL, FOREIGN KEY (parent_id) REFERENCES folders(id)
            );
            CREATE TABLE IF NOT EXISTS photos (
              id INTEGER PRIMARY KEY, folder_id INTEGER NOT NULL, file_path TEXT UNIQUE NOT NULL,
              file_name TEXT NOT NULL, file_size INTEGER, width INTEGER, height INTEGER,
              capture_date TEXT, camera_make TEXT, camera_model TEXT, rating INTEGER DEFAULT 0,
              imported_at TEXT NOT NULL, FOREIGN KEY (folder_id) REFERENCES folders(id)
            );
            CREATE TABLE IF NOT EXISTS thumbnails (
              photo_id INTEGER PRIMARY KEY, cache_path TEXT NOT NULL,
              FOREIGN KEY (photo_id) REFERENCES photos(id)
            );
            CREATE TABLE IF NOT EXISTS edits (
              photo_id INTEGER PRIMARY KEY, edit_json TEXT NOT NULL, updated_at TEXT NOT NULL,
              FOREIGN KEY (photo_id) REFERENCES photos(id)
            );
            CREATE TABLE IF NOT EXISTS presets (
              id INTEGER PRIMARY KEY, name TEXT NOT NULL, folder TEXT NOT NULL DEFAULT 'User Presets',
              edit_json TEXT NOT NULL, created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS history (
              id INTEGER PRIMARY KEY, photo_id INTEGER NOT NULL, label TEXT NOT NULL,
              edit_json TEXT NOT NULL, timestamp TEXT NOT NULL,
              FOREIGN KEY (photo_id) REFERENCES photos(id)
            );
            CREATE TABLE IF NOT EXISTS snapshots (
              id INTEGER PRIMARY KEY, photo_id INTEGER NOT NULL, name TEXT NOT NULL,
              edit_json TEXT NOT NULL, created_at TEXT NOT NULL,
              FOREIGN KEY (photo_id) REFERENCES photos(id)
            );
            CREATE INDEX IF NOT EXISTS idx_history_photo ON history(photo_id, id DESC);
            "#,
        )?;
        let _ = self.conn.execute(
            "ALTER TABLE folders ADD COLUMN parent_id INTEGER REFERENCES folders(id)",
            [],
        );
        Ok(())
    }

    pub fn upsert_folder(
        &self,
        path: &str,
        parent_id: Option<i64>,
        added_at: &str,
    ) -> SqlResult<i64> {
        self.conn.execute(
            "INSERT INTO folders (path, parent_id, added_at) VALUES (?1,?2,?3) ON CONFLICT(path) DO NOTHING",
            params![path, parent_id, added_at],
        )?;
        self.conn.query_row(
            "SELECT id FROM folders WHERE path=?1",
            params![path],
            |r| r.get(0),
        )
    }

    pub fn get_folder_id_by_path(&self, path: &str) -> SqlResult<Option<i64>> {
        match self.conn.query_row(
            "SELECT id FROM folders WHERE path=?1",
            params![path],
            |r| r.get(0),
        ) {
            Ok(id) => Ok(Some(id)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn list_child_folder_ids(&self, folder_id: i64) -> SqlResult<Vec<i64>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id FROM folders WHERE parent_id=?1")?;
        let rows = stmt
            .query_map(params![folder_id], |r| r.get(0))?
            .collect();
        rows
    }

    pub fn list_folders(&self) -> SqlResult<Vec<FolderRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT f.id,f.path,f.parent_id,f.added_at,(SELECT COUNT(*) FROM photos p WHERE p.folder_id=f.id) FROM folders f ORDER BY f.path COLLATE NOCASE",
        )?;
        let rows = stmt
            .query_map([], |r| {
                Ok(FolderRow {
                    id: r.get(0)?,
                    path: r.get(1)?,
                    parent_id: r.get(2)?,
                    added_at: r.get(3)?,
                    photo_count: r.get(4)?,
                })
            })?
            .collect();
        rows
    }

    pub fn remove_folder(&self, folder_id: i64) -> SqlResult<()> {
        for child_id in self.list_child_folder_ids(folder_id)? {
            self.remove_folder(child_id)?;
        }
        for sql in [
            "DELETE FROM thumbnails WHERE photo_id IN (SELECT id FROM photos WHERE folder_id=?1)",
            "DELETE FROM history WHERE photo_id IN (SELECT id FROM photos WHERE folder_id=?1)",
            "DELETE FROM snapshots WHERE photo_id IN (SELECT id FROM photos WHERE folder_id=?1)",
            "DELETE FROM edits WHERE photo_id IN (SELECT id FROM photos WHERE folder_id=?1)",
            "DELETE FROM photos WHERE folder_id=?1",
            "DELETE FROM folders WHERE id=?1",
        ] {
            self.conn.execute(sql, params![folder_id])?;
        }
        Ok(())
    }

    pub fn remove_photo(&self, photo_id: i64) -> SqlResult<()> {
        for sql in [
            "DELETE FROM thumbnails WHERE photo_id=?1",
            "DELETE FROM history WHERE photo_id=?1",
            "DELETE FROM snapshots WHERE photo_id=?1",
            "DELETE FROM edits WHERE photo_id=?1",
            "DELETE FROM photos WHERE id=?1",
        ] {
            self.conn.execute(sql, params![photo_id])?;
        }
        Ok(())
    }

    pub fn search_photos(&self, query: &str) -> SqlResult<Vec<PhotoRow>> {
        let trimmed = query.trim();
        if trimmed.is_empty() {
            return self.list_photos(None);
        }
        let pattern = format!("%{}%", trimmed.replace('%', "\\%").replace('_', "\\_"));
        let base = "SELECT p.id,p.folder_id,p.file_path,p.file_name,p.file_size,p.width,p.height,p.capture_date,p.camera_make,p.camera_model,p.rating,p.imported_at,t.cache_path FROM photos p LEFT JOIN thumbnails t ON t.photo_id=p.id";
        let sql = format!("{base} WHERE p.file_name LIKE ?1 ESCAPE '\\' ORDER BY p.file_name COLLATE NOCASE");
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map(params![pattern], Self::map_photo)?.collect();
        rows
    }

    pub fn photo_exists(&self, file_path: &str) -> SqlResult<bool> {
        Ok(self.conn.query_row("SELECT COUNT(*) FROM photos WHERE file_path=?1", params![file_path], |r| r.get::<_, i64>(0))? > 0)
    }

    pub fn photos_missing_thumbnails(&self, photo_ids: &[i64]) -> SqlResult<Vec<(i64, String)>> {
        if photo_ids.is_empty() {
            return Ok(Vec::new());
        }
        let placeholders = photo_ids
            .iter()
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(",");
        let sql = format!(
            "SELECT p.id,p.file_path FROM photos p LEFT JOIN thumbnails t ON t.photo_id=p.id WHERE p.id IN ({placeholders}) AND t.photo_id IS NULL"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt
            .query_map(rusqlite::params_from_iter(photo_ids.iter()), |r| {
                Ok((r.get(0)?, r.get(1)?))
            })?
            .collect();
        rows
    }

    pub fn insert_photo(&self, folder_id: i64, file_path: &str, file_name: &str, file_size: Option<i64>, width: Option<i32>, height: Option<i32>, capture_date: Option<&str>, camera_make: Option<&str>, camera_model: Option<&str>, imported_at: &str) -> SqlResult<i64> {
        self.conn.execute(
            "INSERT INTO photos (folder_id,file_path,file_name,file_size,width,height,capture_date,camera_make,camera_model,imported_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            params![folder_id, file_path, file_name, file_size, width, height, capture_date, camera_make, camera_model, imported_at],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn set_thumbnail(&self, photo_id: i64, cache_path: &str) -> SqlResult<()> {
        self.conn.execute("INSERT INTO thumbnails (photo_id,cache_path) VALUES (?1,?2) ON CONFLICT(photo_id) DO UPDATE SET cache_path=excluded.cache_path", params![photo_id, cache_path])?;
        Ok(())
    }

    pub fn list_photos(&self, folder_id: Option<i64>) -> SqlResult<Vec<PhotoRow>> {
        let base = "SELECT p.id,p.folder_id,p.file_path,p.file_name,p.file_size,p.width,p.height,p.capture_date,p.camera_make,p.camera_model,p.rating,p.imported_at,t.cache_path FROM photos p LEFT JOIN thumbnails t ON t.photo_id=p.id";
        if let Some(fid) = folder_id {
            let mut stmt = self.conn.prepare(&format!("{base} WHERE p.folder_id=?1 ORDER BY p.file_name COLLATE NOCASE"))?;
            let rows = stmt.query_map(params![fid], Self::map_photo)?.collect();
            rows
        } else {
            let mut stmt = self.conn.prepare(&format!("{base} ORDER BY p.file_name COLLATE NOCASE"))?;
            let rows = stmt.query_map([], Self::map_photo)?.collect();
            rows
        }
    }

    fn map_photo(r: &rusqlite::Row<'_>) -> rusqlite::Result<PhotoRow> {
        Ok(PhotoRow { id: r.get(0)?, folder_id: r.get(1)?, file_path: r.get(2)?, file_name: r.get(3)?, file_size: r.get(4)?, width: r.get(5)?, height: r.get(6)?, capture_date: r.get(7)?, camera_make: r.get(8)?, camera_model: r.get(9)?, rating: r.get(10)?, imported_at: r.get(11)?, thumbnail_path: r.get(12)? })
    }

    pub fn get_photo_path(&self, photo_id: i64) -> SqlResult<String> {
        self.conn.query_row("SELECT file_path FROM photos WHERE id=?1", params![photo_id], |r| r.get(0))
    }

    pub fn get_photo_id_by_path(&self, file_path: &str) -> SqlResult<Option<i64>> {
        match self.conn.query_row(
            "SELECT id FROM photos WHERE file_path=?1",
            params![file_path],
            |r| r.get(0),
        ) {
            Ok(id) => Ok(Some(id)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn has_saved_edits(&self, photo_id: i64) -> SqlResult<bool> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM edits WHERE photo_id=?1",
            params![photo_id],
            |r| r.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn get_photo_edits(&self, photo_id: i64) -> SqlResult<EditStack> {
        if self.has_saved_edits(photo_id)? {
            let mut stmt = self.conn.prepare("SELECT edit_json FROM edits WHERE photo_id=?1")?;
            let json: String = stmt.query_row(params![photo_id], |r| r.get(0))?;
            return Ok(serde_json::from_str(&json).unwrap_or_default());
        }

        let path = self.get_photo_path(photo_id)?;
        Ok(crate::metadata::detect_edits_for_path(std::path::Path::new(&path)))
    }

    pub fn set_photo_edits(&self, photo_id: i64, edits: &EditStack) -> SqlResult<()> {
        let json = serde_json::to_string(edits).map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        self.conn.execute("INSERT INTO edits (photo_id,edit_json,updated_at) VALUES (?1,?2,?3) ON CONFLICT(photo_id) DO UPDATE SET edit_json=excluded.edit_json,updated_at=excluded.updated_at", params![photo_id, json, chrono::Utc::now().to_rfc3339()])?;
        Ok(())
    }

    pub fn create_preset(&self, name: &str, folder: &str, edits: &EditStack) -> SqlResult<i64> {
        let json = serde_json::to_string(edits).map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        self.conn().execute("INSERT INTO presets (name,folder,edit_json,created_at) VALUES (?1,?2,?3,?4)", params![name, folder, json, chrono::Utc::now().to_rfc3339()])?;
        Ok(self.conn().last_insert_rowid())
    }

    pub fn list_presets(&self) -> SqlResult<Vec<Preset>> {
        let mut stmt = self.conn().prepare("SELECT id,name,folder,edit_json FROM presets ORDER BY folder,name")?;
        let rows = stmt.query_map([], |r| { let j: String = r.get(3)?; Ok(Preset { id: r.get(0)?, name: r.get(1)?, folder: r.get(2)?, edits: serde_json::from_str(&j).unwrap_or_default() }) })?.collect();
        rows
    }

    pub fn delete_preset(&self, preset_id: i64) -> SqlResult<()> {
        self.conn().execute("DELETE FROM presets WHERE id=?1", params![preset_id])?; Ok(())
    }

    pub fn get_preset(&self, preset_id: i64) -> SqlResult<Preset> {
        self.conn().query_row("SELECT id,name,folder,edit_json FROM presets WHERE id=?1", params![preset_id], |r| {
            let j: String = r.get(3)?;
            Ok(Preset { id: r.get(0)?, name: r.get(1)?, folder: r.get(2)?, edits: serde_json::from_str(&j).unwrap_or_default() })
        })
    }

    pub fn apply_preset(&self, photo_id: i64, preset_id: i64) -> SqlResult<EditStack> {
        let p = self.get_preset(preset_id)?;
        self.set_photo_edits(photo_id, &p.edits)?;
        Ok(p.edits)
    }

    pub fn push_history(&self, photo_id: i64, label: &str, edits: &EditStack) -> SqlResult<i64> {
        let json = serde_json::to_string(edits).map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        self.conn().execute("INSERT INTO history (photo_id,label,edit_json,timestamp) VALUES (?1,?2,?3,?4)", params![photo_id, label, json, chrono::Utc::now().to_rfc3339()])?;
        let id = self.conn().last_insert_rowid();
        self.conn().execute("DELETE FROM history WHERE photo_id=?1 AND id NOT IN (SELECT id FROM history WHERE photo_id=?1 ORDER BY id DESC LIMIT ?2)", params![photo_id, MAX_HISTORY])?;
        Ok(id)
    }

    pub fn list_history(&self, photo_id: i64) -> SqlResult<Vec<HistoryEntry>> {
        let mut stmt = self.conn().prepare("SELECT id,photo_id,label,edit_json,timestamp FROM history WHERE photo_id=?1 ORDER BY id DESC")?;
        let rows = stmt.query_map(params![photo_id], |r| { let j: String = r.get(3)?; Ok(HistoryEntry { id: r.get(0)?, photo_id: r.get(1)?, label: r.get(2)?, edits: serde_json::from_str(&j).unwrap_or_default(), timestamp: r.get(4)? }) })?.collect();
        rows
    }

    pub fn get_history_entry(&self, history_id: i64) -> SqlResult<HistoryEntry> {
        self.conn().query_row("SELECT id,photo_id,label,edit_json,timestamp FROM history WHERE id=?1", params![history_id], |r| {
            let j: String = r.get(3)?;
            Ok(HistoryEntry { id: r.get(0)?, photo_id: r.get(1)?, label: r.get(2)?, edits: serde_json::from_str(&j).unwrap_or_default(), timestamp: r.get(4)? })
        })
    }

    pub fn restore_history(&self, photo_id: i64, history_id: i64) -> SqlResult<EditStack> {
        let e = self.get_history_entry(history_id)?;
        if e.photo_id != photo_id { return Err(rusqlite::Error::QueryReturnedNoRows); }
        self.set_photo_edits(photo_id, &e.edits)?;
        self.push_history(photo_id, &format!("Restore: {}", e.label), &e.edits)?;
        Ok(e.edits)
    }

    pub fn create_snapshot(&self, photo_id: i64, name: &str, edits: &EditStack) -> SqlResult<i64> {
        let json = serde_json::to_string(edits).map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        self.conn().execute("INSERT INTO snapshots (photo_id,name,edit_json,created_at) VALUES (?1,?2,?3,?4)", params![photo_id, name, json, chrono::Utc::now().to_rfc3339()])?;
        Ok(self.conn().last_insert_rowid())
    }

    pub fn list_snapshots(&self, photo_id: i64) -> SqlResult<Vec<Snapshot>> {
        let mut stmt = self.conn().prepare("SELECT id,photo_id,name,edit_json,created_at FROM snapshots WHERE photo_id=?1 ORDER BY created_at DESC")?;
        let rows = stmt.query_map(params![photo_id], |r| { let j: String = r.get(3)?; Ok(Snapshot { id: r.get(0)?, photo_id: r.get(1)?, name: r.get(2)?, edits: serde_json::from_str(&j).unwrap_or_default(), created_at: r.get(4)? }) })?.collect();
        rows
    }

    pub fn restore_snapshot(&self, photo_id: i64, snapshot_id: i64) -> SqlResult<EditStack> {
        let s: Snapshot = self.conn().query_row("SELECT id,photo_id,name,edit_json,created_at FROM snapshots WHERE id=?1", params![snapshot_id], |r| {
            let j: String = r.get(3)?;
            Ok(Snapshot { id: r.get(0)?, photo_id: r.get(1)?, name: r.get(2)?, edits: serde_json::from_str(&j).unwrap_or_default(), created_at: r.get(4)? })
        })?;
        if s.photo_id != photo_id { return Err(rusqlite::Error::QueryReturnedNoRows); }
        self.set_photo_edits(photo_id, &s.edits)?;
        self.push_history(photo_id, &format!("Restore snapshot: {}", s.name), &s.edits)?;
        Ok(s.edits)
    }

    pub fn delete_snapshot(&self, snapshot_id: i64) -> SqlResult<()> {
        self.conn()
            .execute("DELETE FROM snapshots WHERE id=?1", params![snapshot_id])?;
        Ok(())
    }
}
