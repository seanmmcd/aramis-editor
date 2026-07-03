use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::export::ExportSettings;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum ThemeMode {
    #[default]
    Dark,
    Light,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct AppSettings {
    /// Number of parallel export workers. 0 = use all logical CPUs.
    pub export_thread_count: u32,
    pub export_defaults: ExportSettings,
    pub theme_mode: ThemeMode,
    /// UI highlight / accent color (hex, e.g. #2d8ceb).
    pub highlight_color: String,
    /// Custom primary text color (hex). Empty string uses theme default.
    pub text_color: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            export_thread_count: 0,
            export_defaults: ExportSettings::default(),
            theme_mode: ThemeMode::default(),
            highlight_color: "#2d8ceb".into(),
            text_color: String::new(),
        }
    }
}

impl AppSettings {
    pub fn load(path: &Path) -> Self {
        match fs::read_to_string(path) {
            Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
            Err(_) => Self::default(),
        }
    }

    pub fn save(&self, path: &Path) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let raw = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(path, raw).map_err(|e| e.to_string())
    }

    pub fn effective_export_threads(&self) -> usize {
        if self.export_thread_count == 0 {
            std::thread::available_parallelism()
                .map(|p| p.get())
                .unwrap_or(4)
                .max(1)
        } else {
            self.export_thread_count as usize
        }
    }
}
