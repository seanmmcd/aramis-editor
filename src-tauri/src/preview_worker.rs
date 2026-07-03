use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::SystemTime;

use crate::edits::{
    apply_edit_stack, apply_edit_stack_preview, apply_edit_stack_preview_skip_crop,
    apply_edit_stack_skip_crop, EditStack,
};
use crate::raw::{self, DecodedImage};

pub const PREVIEW_CACHE_MAX: u32 = 2560;
pub const DRAFT_MAX_DIM: u32 = 1024;
pub const JPEG_QUALITY_FINAL: u8 = 88;
pub const JPEG_QUALITY_DRAFT: u8 = 78;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PreviewQuality {
    Draft,
    Final,
}

impl PreviewQuality {
    pub fn from_draft_flag(draft: bool) -> Self {
        if draft {
            Self::Draft
        } else {
            Self::Final
        }
    }

    fn max_dim(self) -> u32 {
        match self {
            Self::Draft => DRAFT_MAX_DIM,
            Self::Final => PREVIEW_CACHE_MAX,
        }
    }

    pub fn jpeg_quality(self) -> u8 {
        match self {
            Self::Draft => JPEG_QUALITY_DRAFT,
            Self::Final => JPEG_QUALITY_FINAL,
        }
    }
}

#[derive(serde::Serialize, Clone)]
pub struct PreviewResponse {
    pub width: u32,
    pub height: u32,
    pub png_base64: String,
}

struct PreviewCacheEntry {
    path: PathBuf,
    mtime: SystemTime,
    draft_base: Arc<DecodedImage>,
    final_base: Arc<DecodedImage>,
}

pub struct PreviewCache {
    inner: Mutex<Option<PreviewCacheEntry>>,
    /// Ensures only one thread decodes/resizes at a time (warm + apply_edits races).
    decode_lock: Mutex<()>,
}

impl PreviewCache {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
            decode_lock: Mutex::new(()),
        }
    }

    pub fn warm(&self, path: &Path) {
        let _ = self.get_base(path, PreviewQuality::Final);
    }

    pub fn get_base(&self, path: &Path, quality: PreviewQuality) -> Result<Arc<DecodedImage>, String> {
        let mtime = std::fs::metadata(path)
            .and_then(|m| m.modified())
            .map_err(|e| e.to_string())?;
        {
            let cache = self.inner.lock().map_err(|e| e.to_string())?;
            if let Some(entry) = cache.as_ref() {
                if entry.path == path && entry.mtime == mtime {
                    return Ok(match quality {
                        PreviewQuality::Draft => Arc::clone(&entry.draft_base),
                        PreviewQuality::Final => Arc::clone(&entry.final_base),
                    });
                }
            }
        }

        let _decode_guard = self.decode_lock.lock().map_err(|e| e.to_string())?;
        {
            let cache = self.inner.lock().map_err(|e| e.to_string())?;
            if let Some(entry) = cache.as_ref() {
                if entry.path == path && entry.mtime == mtime {
                    return Ok(match quality {
                        PreviewQuality::Draft => Arc::clone(&entry.draft_base),
                        PreviewQuality::Final => Arc::clone(&entry.final_base),
                    });
                }
            }
        }

        let decoded = raw::decode_image_on_large_stack(path).map_err(|e| e.to_string())?;
        let shared_base = Arc::new(raw::resize_for_preview_fast(&decoded, PREVIEW_CACHE_MAX));

        let mut cache = self.inner.lock().map_err(|e| e.to_string())?;
        *cache = Some(PreviewCacheEntry {
            path: path.to_path_buf(),
            mtime,
            draft_base: Arc::clone(&shared_base),
            final_base: Arc::clone(&shared_base),
        });
        Ok(shared_base)
    }

    /// Backward-compatible alias used by quick preview.
    pub fn get_interactive_base(&self, path: &Path) -> Result<Arc<DecodedImage>, String> {
        self.get_base(path, PreviewQuality::Draft)
    }
}

struct PreviewJob {
    path: PathBuf,
    edits: EditStack,
    apply_crop: bool,
    quality: PreviewQuality,
    result_tx: Sender<Result<PreviewResponse, String>>,
    cancel: Arc<AtomicBool>,
}

pub struct PreviewWorker {
    tx: Sender<PreviewJob>,
    _handle: JoinHandle<()>,
}

impl PreviewWorker {
    pub fn spawn(cache: Arc<PreviewCache>) -> Self {
        let (tx, rx) = mpsc::channel::<PreviewJob>();
        let handle = thread::Builder::new()
            .name("preview-worker".into())
            .spawn(move || worker_loop(cache, rx))
            .expect("preview worker thread");
        Self {
            tx,
            _handle: handle,
        }
    }

    pub fn submit(
        &self,
        path: PathBuf,
        edits: EditStack,
        apply_crop: bool,
        quality: PreviewQuality,
    ) -> Result<PreviewResponse, String> {
        let (result_tx, result_rx) = mpsc::channel();
        self.tx
            .send(PreviewJob {
                path,
                edits,
                apply_crop,
                quality,
                result_tx,
                cancel: Arc::new(AtomicBool::new(false)),
            })
            .map_err(|e| e.to_string())?;
        result_rx.recv().map_err(|e| e.to_string())?
    }
}

fn worker_loop(cache: Arc<PreviewCache>, rx: Receiver<PreviewJob>) {
    while let Ok(mut job) = rx.recv() {
        while let Ok(newer) = rx.try_recv() {
            job.cancel.store(true, Ordering::Relaxed);
            let _ = job.result_tx.send(Err("superseded".into()));
            job = newer;
        }
        let result = render_job(
            &cache,
            &job.path,
            &job.edits,
            job.apply_crop,
            job.quality,
            &job.cancel,
        );
        let _ = job.result_tx.send(result);
    }
}

pub fn render_base_for_quality(base: &DecodedImage, quality: PreviewQuality) -> DecodedImage {
    let max_dim = quality.max_dim();
    if base.width <= max_dim && base.height <= max_dim {
        base.clone()
    } else {
        raw::resize_for_preview_fast(base, max_dim)
    }
}

fn render_job(
    cache: &PreviewCache,
    path: &Path,
    edits: &EditStack,
    apply_crop: bool,
    quality: PreviewQuality,
    cancel: &AtomicBool,
) -> Result<PreviewResponse, String> {
    let base = cache.get_base(path, quality)?;
    if cancel.load(Ordering::Relaxed) {
        return Err("superseded".into());
    }
    let working = render_base_for_quality(base.as_ref(), quality);
    if cancel.load(Ordering::Relaxed) {
        return Err("superseded".into());
    }

    let rendered = if matches!(quality, PreviewQuality::Final) {
        if apply_crop {
            apply_edit_stack(working, edits)
        } else {
            apply_edit_stack_skip_crop(working, edits)
        }
    } else if apply_crop {
        apply_edit_stack_preview(working, edits)
    } else {
        apply_edit_stack_preview_skip_crop(working, edits)
    };

    encode_preview_image(&rendered, quality)
}

fn encode_preview_image(preview: &DecodedImage, quality: PreviewQuality) -> Result<PreviewResponse, String> {
    use base64::{engine::general_purpose::STANDARD, Engine};

    let rgb = raw::linear_rgb_to_srgb_bytes(&preview.data);
    let mut buffer = Vec::new();
    crate::jpeg_encode::write_srgb_jpeg(
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
