use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use thiserror::Error;

pub const MAX_ZIP_EXPANSION_RATIO: f64 = 100.0;
pub const MAX_UNCOMPRESSED_BYTES: u64 = 256 * 1024 * 1024;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ConverterError {
    #[error("Zip-bomb guard triggered: {0}")]
    ZipBombRejected(String),
    #[error("Unsafe archive path rejected: {0}")]
    PathTraversal(String),
    #[error("Job cancelled cooperatively")]
    Cancelled,
}

/// Validates archive decompression ratios and entry paths to prevent OOM & path-traversal attacks.
pub fn validate_archive_entry(
    entry_path: &str,
    compressed_bytes: u64,
    uncompressed_bytes: u64,
) -> Result<(), ConverterError> {
    if entry_path.contains("..") || entry_path.starts_with('/') || entry_path.starts_with('\\') {
        return Err(ConverterError::PathTraversal(entry_path.to_string()));
    }
    if uncompressed_bytes > MAX_UNCOMPRESSED_BYTES {
        return Err(ConverterError::ZipBombRejected(
            "Uncompressed size cap exceeded".to_string(),
        ));
    }
    let ratio = (uncompressed_bytes as f64) / (compressed_bytes.max(1) as f64);
    if ratio > MAX_ZIP_EXPANSION_RATIO && uncompressed_bytes > 1_048_576 {
        return Err(ConverterError::ZipBombRejected(format!(
            "Ratio {:.1}:1 exceeds limit",
            ratio
        )));
    }
    Ok(())
}

/// Thread-safe cooperative cancellation token registry keyed by job_id.
#[derive(Default)]
pub struct CancellationRegistry {
    tokens: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl CancellationRegistry {
    pub fn register(&self, job_id: &str) -> Arc<AtomicBool> {
        let token = Arc::new(AtomicBool::new(false));
        self.tokens
            .lock()
            .unwrap()
            .insert(job_id.to_string(), Arc::clone(&token));
        token
    }

    pub fn cancel(&self, job_id: &str) -> bool {
        if let Some(token) = self.tokens.lock().unwrap().get(job_id) {
            token.store(true, Ordering::SeqCst);
            return true;
        }
        false
    }

    pub fn remove(&self, job_id: &str) {
        self.tokens.lock().unwrap().remove(job_id);
    }
}
