pub mod converters;
pub mod graph;
pub mod inspector;

pub fn health_check() -> &'static str {
    "omniconvert_rust_core:ok"
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::converters::{validate_archive_entry, CancellationRegistry, ConverterError};
    use crate::graph::ConversionGraph;
    use crate::inspector::inspect_header_bytes;
    use std::sync::atomic::Ordering;

    #[test]
    fn detects_mismatched_png_disguised_as_jpg() {
        let png_header = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00];
        let res = inspect_header_bytes(&png_header, "holiday.jpg");
        assert_eq!(res.detected_format_id, "png");
        assert!(res.is_extension_mismatch);
        assert!(!res.is_encrypted);
    }

    #[test]
    fn detects_encrypted_pdf_header() {
        let pdf = b"%PDF-1.7\n1 0 obj << /Encrypt 2 0 R >> endobj";
        let res = inspect_header_bytes(pdf, "contract.pdf");
        assert_eq!(res.detected_format_id, "pdf");
        assert!(res.is_encrypted);
    }

    #[test]
    fn resolves_multi_hop_heic_to_pdf_locally() {
        let graph = ConversionGraph::default_registry();
        let plan = graph.plan("heic", "pdf", true).expect("local path exists");
        assert!(!plan.requires_cloud);
        assert_eq!(plan.steps.len(), 2);
        assert_eq!(plan.steps[0].target, "png");
        assert_eq!(plan.steps[1].target, "pdf");
    }

    #[test]
    fn prunes_tier_3_edges_when_offline_only() {
        let graph = ConversionGraph::default_registry();
        assert!(graph.plan("docx", "png", true).is_none());
        let cloud_plan = graph.plan("docx", "png", false).expect("hybrid path exists");
        assert!(cloud_plan.requires_cloud);
        assert_eq!(cloud_plan.steps.len(), 2);
    }

    #[test]
    fn rejects_zip_bomb_and_path_traversal() {
        let bomb = validate_archive_entry("huge.txt", 10_000, 5_000_000);
        assert!(matches!(bomb, Err(ConverterError::ZipBombRejected(_))));

        let traversal = validate_archive_entry("../../etc/passwd", 100, 100);
        assert!(matches!(traversal, Err(ConverterError::PathTraversal(_))));

        assert!(validate_archive_entry("docs/report.txt", 10_000, 40_000).is_ok());
    }

    #[test]
    fn supports_cooperative_job_cancellation() {
        let reg = CancellationRegistry::default();
        let token = reg.register("job-42");
        assert!(!token.load(Ordering::SeqCst));
        assert!(reg.cancel("job-42"));
        assert!(token.load(Ordering::SeqCst));
        reg.remove("job-42");
    }
}
