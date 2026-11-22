use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FileInspectionResult {
    pub file_name: String,
    pub claimed_extension: String,
    pub detected_format_id: String,
    pub is_extension_mismatch: bool,
    pub is_encrypted: bool,
    pub has_drm: bool,
}

fn ascii_lossy(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|&b| if (32..=126).contains(&b) { b as char } else { ' ' })
        .collect()
}

fn extract_ext(file_name: &str) -> String {
    let lower = file_name.to_ascii_lowercase();
    if lower.ends_with(".tar.gz") {
        return "tgz".to_string();
    }
    match lower.rsplit_once('.') {
        Some((_, ext)) if !ext.is_empty() => match ext {
            "jpeg" | "jpe" => "jpg".to_string(),
            "tif" => "tiff".to_string(),
            "yml" => "yaml".to_string(),
            other => other.to_string(),
        },
        _ => String::new(),
    }
}

/// Inspects up to the first 64 KB of a file to identify its true format by magic bytes,
/// peeking into ZIP headers for DOCX/XLSX/PPTX/EPUB/ODT/3MF, encrypted flags, and DRM.
pub fn inspect_header_bytes(header: &[u8], file_name: &str) -> FileInspectionResult {
    let claimed = extract_ext(file_name);
    let mut detected = String::new();
    let mut is_encrypted = false;
    let mut has_drm = false;
    let mut extension_fallback = false;

    if header.starts_with(b"%PDF-") {
        detected = "pdf".to_string();
        if ascii_lossy(header).contains("/Encrypt") {
            is_encrypted = true;
        }
    } else if header.starts_with(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) {
        detected = "png".to_string();
    } else if header.starts_with(&[0xFF, 0xD8, 0xFF]) {
        detected = "jpg".to_string();
    } else if header.starts_with(b"GIF87a") || header.starts_with(b"GIF89a") {
        detected = "gif".to_string();
    } else if header.len() >= 12 && header.starts_with(b"RIFF") {
        match &header[8..12] {
            b"WEBP" => detected = "webp".to_string(),
            b"WAVE" => detected = "wav".to_string(),
            b"AVI " => detected = "avi".to_string(),
            _ => {}
        }
    } else if header.len() >= 12 && &header[4..8] == b"ftyp" {
        let brand = ascii_lossy(&header[8..12]).trim().to_string();
        let text = ascii_lossy(&header[..header.len().min(4096)]);
        detected = match brand.as_str() {
            "heic" | "heix" | "hevc" | "hevx" => "heic".to_string(),
            "mif1" | "msf1" | "heif" => "heif".to_string(),
            "avif" | "avis" => "avif".to_string(),
            "qt" => "mov".to_string(),
            "M4A" => "m4a".to_string(),
            "M4P" => {
                has_drm = true;
                "m4p".to_string()
            }
            _ => {
                if text.contains("drms") || text.contains("sinf") {
                    has_drm = true;
                    "m4p".to_string()
                } else {
                    "mp4".to_string()
                }
            }
        };
    } else if header.starts_with(&[0x50, 0x4B, 0x03, 0x04]) {
        if header.len() >= 8 {
            let gp_flag = u16::from_le_bytes([header[6], header[7]]);
            if (gp_flag & 0x0001) != 0 {
                is_encrypted = true;
            }
        }
        let text = ascii_lossy(header);
        if text.contains("META-INF/rights.xml") {
            has_drm = true;
        }
        detected = if text.contains("application/epub+zip") {
            "epub"
        } else if text.contains("word/document.xml") || text.contains("word/") {
            "docx"
        } else if text.contains("xl/workbook.xml") || text.contains("xl/") {
            "xlsx"
        } else if text.contains("ppt/presentation.xml") || text.contains("ppt/") {
            "pptx"
        } else if text.contains("3D/3dmodel.model") {
            "3mf"
        } else {
            "zip"
        }
        .to_string();
    } else if header.starts_with(&[0x1F, 0x8B]) {
        detected = if claimed == "tgz" { "tgz" } else { "gz" }.to_string();
    } else if header.starts_with(&[0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]) {
        detected = "7z".to_string();
    } else if header.starts_with(&[0xEA, 0x44, 0x52, 0x4D]) || claimed == "kfx" {
        detected = "kfx".to_string();
        has_drm = true;
    } else {
        extension_fallback = true;
        detected = if claimed.is_empty() { "txt".to_string() } else { claimed.clone() };
    }

    let is_extension_mismatch = !extension_fallback && !claimed.is_empty() && claimed != detected;

    FileInspectionResult {
        file_name: file_name.to_string(),
        claimed_extension: claimed,
        detected_format_id: detected,
        is_extension_mismatch,
        is_encrypted,
        has_drm,
    }
}
