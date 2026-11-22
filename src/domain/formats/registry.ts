import type {
  ConversionEdge,
  ConversionTier,
  EngineId,
  FormatCategory,
  FormatDescriptor,
  WarningCode,
} from '../entities/format';

export const FORMAT_REGISTRY: readonly FormatDescriptor[] = [
  // ===================== IMAGES (Tier 1 / 2 / 3) =====================
  { id: 'heic', extension: 'heic', label: 'HEIC', mime: 'image/heic', category: 'image', description: 'Apple High Efficiency Image', defaultTier: 1, isLossy: true, popularTargets: ['jpg', 'png', 'webp', 'pdf'] },
  { id: 'heif', extension: 'heif', label: 'HEIF', mime: 'image/heif', category: 'image', description: 'High Efficiency Image Format', defaultTier: 1, isLossy: true, popularTargets: ['jpg', 'png', 'webp', 'pdf'] },
  { id: 'jpg', extension: 'jpg', label: 'JPEG / JPG', mime: 'image/jpeg', category: 'image', description: 'Joint Photographic Experts Group', defaultTier: 1, isLossy: true, popularTargets: ['png', 'webp', 'pdf', 'avif', 'txt'] },
  { id: 'png', extension: 'png', label: 'PNG', mime: 'image/png', category: 'image', description: 'Portable Network Graphics', defaultTier: 1, popularTargets: ['jpg', 'webp', 'pdf', 'ico', 'txt'] },
  { id: 'webp', extension: 'webp', label: 'WebP', mime: 'image/webp', category: 'image', description: 'Modern Web Image', defaultTier: 1, isLossy: true, popularTargets: ['png', 'jpg', 'pdf', 'gif'] },
  { id: 'gif', extension: 'gif', label: 'GIF', mime: 'image/gif', category: 'image', description: 'Graphics Interchange Format', defaultTier: 1, popularTargets: ['png', 'webp', 'mp4', 'jpg'] },
  { id: 'tiff', extension: 'tiff', label: 'TIFF', mime: 'image/tiff', category: 'image', description: 'Tagged Image File Format', defaultTier: 1, popularTargets: ['png', 'jpg', 'pdf', 'webp'] },
  { id: 'bmp', extension: 'bmp', label: 'BMP', mime: 'image/bmp', category: 'image', description: 'Bitmap Image', defaultTier: 1, popularTargets: ['png', 'jpg', 'webp', 'pdf'] },
  { id: 'ico', extension: 'ico', label: 'ICO', mime: 'image/x-icon', category: 'image', description: 'Icon Resource', defaultTier: 2, popularTargets: ['png', 'jpg', 'webp'] },
  { id: 'svg', extension: 'svg', label: 'SVG', mime: 'image/svg+xml', category: 'image', description: 'Scalable Vector Graphics', defaultTier: 2, isVector: true, isPlainText: true, popularTargets: ['png', 'jpg', 'webp', 'pdf', 'dxf'] },
  { id: 'tga', extension: 'tga', label: 'TGA', mime: 'image/x-tga', category: 'image', description: 'Truevision Targa', defaultTier: 2, popularTargets: ['png', 'jpg', 'webp'] },
  { id: 'qoi', extension: 'qoi', label: 'QOI', mime: 'image/qoi', category: 'image', description: 'Quite OK Image', defaultTier: 2, popularTargets: ['png', 'jpg', 'webp'] },
  { id: 'pnm', extension: 'pnm', label: 'PNM / PPM', mime: 'image/x-portable-anymap', category: 'image', description: 'Portable Anymap', defaultTier: 2, popularTargets: ['png', 'jpg'] },
  { id: 'hdr', extension: 'hdr', label: 'HDR', mime: 'image/vnd.radiance', category: 'image', description: 'Radiance High Dynamic Range', defaultTier: 2, popularTargets: ['png', 'jpg', 'exr'] },
  { id: 'exr', extension: 'exr', label: 'OpenEXR', mime: 'image/x-exr', category: 'image', description: 'Industrial Light & Magic EXR', defaultTier: 2, popularTargets: ['png', 'jpg', 'tiff'] },
  { id: 'dng', extension: 'dng', label: 'DNG RAW', mime: 'image/x-adobe-dng', category: 'image', description: 'Adobe Digital Negative RAW', defaultTier: 1, popularTargets: ['jpg', 'png', 'tiff', 'pdf'] },
  { id: 'cr2', extension: 'cr2', label: 'Canon CR2 RAW', mime: 'image/x-canon-cr2', category: 'image', description: 'Canon Camera RAW', defaultTier: 1, popularTargets: ['jpg', 'png', 'tiff'] },
  { id: 'nef', extension: 'nef', label: 'Nikon NEF RAW', mime: 'image/x-nikon-nef', category: 'image', description: 'Nikon Electronic Format RAW', defaultTier: 1, popularTargets: ['jpg', 'png', 'tiff'] },
  { id: 'arw', extension: 'arw', label: 'Sony ARW RAW', mime: 'image/x-sony-arw', category: 'image', description: 'Sony Alpha RAW', defaultTier: 1, popularTargets: ['jpg', 'png', 'tiff'] },
  { id: 'avif', extension: 'avif', label: 'AVIF', mime: 'image/avif', category: 'image', description: 'AV1 Image File Format', defaultTier: 3, isLossy: true, popularTargets: ['png', 'jpg', 'webp'] },
  { id: 'jxl', extension: 'jxl', label: 'JPEG XL', mime: 'image/jxl', category: 'image', description: 'Next-Gen JPEG XL', defaultTier: 3, popularTargets: ['png', 'jpg', 'webp'] },
  { id: 'psd', extension: 'psd', label: 'Photoshop PSD', mime: 'image/vnd.adobe.photoshop', category: 'image', description: 'Adobe Photoshop Document', defaultTier: 3, popularTargets: ['png', 'jpg', 'pdf', 'tiff', 'webp'] },
  { id: 'xcf', extension: 'xcf', label: 'GIMP XCF', mime: 'image/x-xcf', category: 'image', description: 'GIMP Native Image', defaultTier: 3, popularTargets: ['png', 'jpg', 'pdf'] },
  { id: 'ai', extension: 'ai', label: 'Illustrator AI', mime: 'application/postscript', category: 'image', description: 'Adobe Illustrator Vector', defaultTier: 3, isVector: true, popularTargets: ['svg', 'pdf', 'png', 'jpg'] },
  { id: 'eps', extension: 'eps', label: 'EPS', mime: 'application/postscript', category: 'image', description: 'Encapsulated PostScript', defaultTier: 3, isVector: true, popularTargets: ['svg', 'pdf', 'png', 'jpg'] },
  { id: 'cdr', extension: 'cdr', label: 'CorelDRAW CDR', mime: 'application/x-cdr', category: 'image', description: 'CorelDRAW Vector', defaultTier: 3, isVector: true, popularTargets: ['svg', 'pdf', 'png'] },
  { id: 'emf', extension: 'emf', label: 'EMF', mime: 'image/emf', category: 'image', description: 'Enhanced Metafile', defaultTier: 3, isVector: true, popularTargets: ['svg', 'png', 'pdf'] },
  { id: 'wmf', extension: 'wmf', label: 'WMF', mime: 'image/wmf', category: 'image', description: 'Windows Metafile', defaultTier: 3, isVector: true, popularTargets: ['svg', 'png', 'pdf'] },
  { id: 'cr3', extension: 'cr3', label: 'Canon CR3 RAW', mime: 'image/x-canon-cr3', category: 'image', description: 'Canon CR3 RAW', defaultTier: 3, popularTargets: ['jpg', 'png', 'tiff'] },
  { id: 'orf', extension: 'orf', label: 'Olympus ORF', mime: 'image/x-olympus-orf', category: 'image', description: 'Olympus Camera RAW', defaultTier: 3, popularTargets: ['jpg', 'png', 'tiff'] },
  { id: 'raf', extension: 'raf', label: 'Fujifilm RAF', mime: 'image/x-fuji-raf', category: 'image', description: 'Fujifilm Camera RAW', defaultTier: 3, popularTargets: ['jpg', 'png', 'tiff'] },
  { id: 'rw2', extension: 'rw2', label: 'Panasonic RW2', mime: 'image/x-panasonic-rw2', category: 'image', description: 'Panasonic RAW', defaultTier: 3, popularTargets: ['jpg', 'png', 'tiff'] },

  // ===================== PDF & OCR =====================
  { id: 'pdf', extension: 'pdf', label: 'PDF', mime: 'application/pdf', category: 'pdf', description: 'Portable Document Format', defaultTier: 1, popularTargets: ['png', 'jpg', 'txt', 'docx', 'xlsx', 'epub', 'html'] },

  // ===================== VIDEO =====================
  { id: 'mp4', extension: 'mp4', label: 'MP4 (H.264/HEVC)', mime: 'video/mp4', category: 'video', description: 'MPEG-4 Hardware Video', defaultTier: 1, isLossy: true, popularTargets: ['mov', 'm4a', 'wav', 'gif', 'webm', 'mkv'] },
  { id: 'mov', extension: 'mov', label: 'QuickTime MOV', mime: 'video/quicktime', category: 'video', description: 'Apple QuickTime Movie', defaultTier: 1, isLossy: true, popularTargets: ['mp4', 'm4a', 'wav', 'gif', 'webm'] },
  { id: 'm4v', extension: 'm4v', label: 'M4V', mime: 'video/x-m4v', category: 'video', description: 'Apple M4V Video', defaultTier: 1, isLossy: true, popularTargets: ['mp4', 'mov', 'm4a'] },
  { id: 'mkv', extension: 'mkv', label: 'Matroska MKV', mime: 'video/x-matroska', category: 'video', description: 'Matroska Multimedia Container', defaultTier: 3, popularTargets: ['mp4', 'mov', 'webm', 'mp3', 'wav'] },
  { id: 'webm', extension: 'webm', label: 'WebM', mime: 'video/webm', category: 'video', description: 'Web Video (VP8/VP9/AV1)', defaultTier: 3, isLossy: true, popularTargets: ['mp4', 'mov', 'gif', 'mp3'] },
  { id: 'avi', extension: 'avi', label: 'AVI', mime: 'video/x-msvideo', category: 'video', description: 'Audio Video Interleave', defaultTier: 3, popularTargets: ['mp4', 'mov', 'mkv', 'mp3'] },
  { id: 'flv', extension: 'flv', label: 'FLV', mime: 'video/x-flv', category: 'video', description: 'Flash Video', defaultTier: 3, isLossy: true, popularTargets: ['mp4', 'webm', 'mp3'] },
  { id: 'wmv', extension: 'wmv', label: 'WMV', mime: 'video/x-ms-wmv', category: 'video', description: 'Windows Media Video', defaultTier: 3, isLossy: true, popularTargets: ['mp4', 'mov', 'mkv'] },
  { id: 'mxf', extension: 'mxf', label: 'MXF Broadcast', mime: 'application/mxf', category: 'video', description: 'Material Exchange Format', defaultTier: 3, popularTargets: ['mp4', 'mov'] },
  { id: 'vob', extension: 'vob', label: 'DVD VOB', mime: 'video/x-ms-vob', category: 'video', description: 'DVD Video Object', defaultTier: 3, popularTargets: ['mp4', 'mkv'] },
  { id: 'ts', extension: 'ts', label: 'MPEG-TS', mime: 'video/mp2t', category: 'video', description: 'Transport Stream Video', defaultTier: 3, popularTargets: ['mp4', 'mkv'] },
  { id: 'rmvb', extension: 'rmvb', label: 'RMVB', mime: 'application/vnd.rn-realmedia-vbr', category: 'video', description: 'RealMedia Variable Bitrate', defaultTier: 3, popularTargets: ['mp4', 'mkv'] },
  { id: '3gp', extension: '3gp', label: '3GP', mime: 'video/3gpp', category: 'video', description: '3GPP Mobile Video', defaultTier: 3, isLossy: true, popularTargets: ['mp4', 'm4a'] },

  // ===================== AUDIO =====================
  { id: 'wav', extension: 'wav', label: 'WAV (Lossless PCM)', mime: 'audio/wav', category: 'audio', description: 'Uncompressed Waveform Audio', defaultTier: 1, popularTargets: ['m4a', 'mp3', 'flac', 'ogg', 'aac'] },
  { id: 'm4a', extension: 'm4a', label: 'M4A (AAC)', mime: 'audio/mp4', category: 'audio', description: 'MPEG-4 Audio', defaultTier: 1, isLossy: true, popularTargets: ['wav', 'mp3', 'flac', 'ogg'] },
  { id: 'aac', extension: 'aac', label: 'AAC', mime: 'audio/aac', category: 'audio', description: 'Advanced Audio Coding', defaultTier: 1, isLossy: true, popularTargets: ['wav', 'm4a', 'mp3'] },
  { id: 'caf', extension: 'caf', label: 'Apple CAF', mime: 'audio/x-caf', category: 'audio', description: 'Core Audio Format', defaultTier: 1, popularTargets: ['wav', 'm4a', 'mp3'] },
  { id: 'aiff', extension: 'aiff', label: 'AIFF', mime: 'audio/aiff', category: 'audio', description: 'Audio Interchange File Format', defaultTier: 1, popularTargets: ['wav', 'm4a', 'flac', 'mp3'] },
  { id: 'mp3', extension: 'mp3', label: 'MP3', mime: 'audio/mpeg', category: 'audio', description: 'MPEG Layer-3 Audio', defaultTier: 2, isLossy: true, popularTargets: ['wav', 'm4a', 'ogg', 'flac'] },
  { id: 'flac', extension: 'flac', label: 'FLAC', mime: 'audio/flac', category: 'audio', description: 'Free Lossless Audio Codec', defaultTier: 2, popularTargets: ['wav', 'm4a', 'mp3', 'ogg'] },
  { id: 'ogg', extension: 'ogg', label: 'OGG Vorbis', mime: 'audio/ogg', category: 'audio', description: 'Ogg Vorbis Audio', defaultTier: 2, isLossy: true, popularTargets: ['wav', 'mp3', 'm4a', 'flac'] },
  { id: 'opus', extension: 'opus', label: 'Opus', mime: 'audio/opus', category: 'audio', description: 'Low-Latency Opus Audio', defaultTier: 2, isLossy: true, popularTargets: ['wav', 'mp3', 'm4a'] },
  { id: 'alac', extension: 'alac', label: 'Apple ALAC', mime: 'audio/mp4', category: 'audio', description: 'Apple Lossless Audio', defaultTier: 2, popularTargets: ['wav', 'flac', 'm4a'] },
  { id: 'wma', extension: 'wma', label: 'WMA', mime: 'audio/x-ms-wma', category: 'audio', description: 'Windows Media Audio', defaultTier: 3, isLossy: true, popularTargets: ['mp3', 'wav', 'm4a'] },
  { id: 'amr', extension: 'amr', label: 'AMR', mime: 'audio/amr', category: 'audio', description: 'Adaptive Multi-Rate Voice', defaultTier: 3, isLossy: true, popularTargets: ['mp3', 'wav', 'm4a'] },
  { id: 'ac3', extension: 'ac3', label: 'Dolby AC3', mime: 'audio/ac3', category: 'audio', description: 'Dolby Digital AC-3', defaultTier: 3, popularTargets: ['wav', 'mp3', 'm4a'] },
  { id: 'dts', extension: 'dts', label: 'DTS Audio', mime: 'audio/vnd.dts', category: 'audio', description: 'DTS Digital Surround', defaultTier: 3, popularTargets: ['wav', 'flac', 'mp3'] },
  { id: 'mid', extension: 'mid', label: 'MIDI', mime: 'audio/midi', category: 'audio', description: 'Musical Instrument Digital Interface', defaultTier: 3, popularTargets: ['mp3', 'wav'] },
  { id: 'm4b', extension: 'm4b', label: 'M4B Audiobook', mime: 'audio/mp4', category: 'audio', description: 'MPEG-4 Audiobook', defaultTier: 3, popularTargets: ['mp3', 'm4a', 'wav'] },
  { id: 'm4p', extension: 'm4p', label: 'M4P (DRM Protected)', mime: 'audio/mp4', category: 'audio', description: 'FairPlay Protected Audio', defaultTier: 3, popularTargets: [] },

  // ===================== DOCUMENTS & OFFICE =====================
  { id: 'txt', extension: 'txt', label: 'Plain Text (TXT)', mime: 'text/plain', category: 'document', description: 'UTF-8 Plain Text', defaultTier: 2, isPlainText: true, popularTargets: ['pdf', 'html', 'md', 'docx', 'rtf'] },
  { id: 'md', extension: 'md', label: 'Markdown (MD)', mime: 'text/markdown', category: 'document', description: 'Markdown Document', defaultTier: 2, isPlainText: true, popularTargets: ['html', 'pdf', 'txt', 'docx', 'epub'] },
  { id: 'html', extension: 'html', label: 'HTML', mime: 'text/html', category: 'document', description: 'HyperText Markup Language', defaultTier: 2, isPlainText: true, popularTargets: ['md', 'txt', 'pdf', 'docx'] },
  { id: 'rtf', extension: 'rtf', label: 'RTF', mime: 'application/rtf', category: 'document', description: 'Rich Text Format', defaultTier: 2, isPlainText: true, popularTargets: ['txt', 'pdf', 'docx', 'html'] },
  { id: 'docx', extension: 'docx', label: 'Word DOCX', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', category: 'document', description: 'Microsoft Word Document', defaultTier: 3, popularTargets: ['pdf', 'odt', 'rtf', 'txt', 'html', 'epub', 'png'] },
  { id: 'doc', extension: 'doc', label: 'Word DOC', mime: 'application/msword', category: 'document', description: 'Legacy Microsoft Word', defaultTier: 3, popularTargets: ['docx', 'pdf', 'odt', 'txt'] },
  { id: 'odt', extension: 'odt', label: 'OpenDocument ODT', mime: 'application/vnd.oasis.opendocument.text', category: 'document', description: 'LibreOffice Writer Document', defaultTier: 3, popularTargets: ['pdf', 'docx', 'rtf', 'txt'] },
  { id: 'pages', extension: 'pages', label: 'Apple Pages', mime: 'application/vnd.apple.pages', category: 'document', description: 'Apple iWork Pages', defaultTier: 3, popularTargets: ['pdf', 'docx', 'txt'] },
  { id: 'xlsx', extension: 'xlsx', label: 'Excel XLSX', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', category: 'document', description: 'Microsoft Excel Spreadsheet', defaultTier: 2, popularTargets: ['csv', 'json', 'tsv', 'pdf', 'ods'] },
  { id: 'xls', extension: 'xls', label: 'Excel XLS', mime: 'application/vnd.ms-excel', category: 'document', description: 'Legacy Excel Workbook', defaultTier: 3, popularTargets: ['xlsx', 'csv', 'pdf', 'ods'] },
  { id: 'ods', extension: 'ods', label: 'OpenDocument ODS', mime: 'application/vnd.oasis.opendocument.spreadsheet', category: 'document', description: 'LibreOffice Calc Sheet', defaultTier: 2, popularTargets: ['csv', 'json', 'xlsx', 'pdf'] },
  { id: 'numbers', extension: 'numbers', label: 'Apple Numbers', mime: 'application/vnd.apple.numbers', category: 'document', description: 'Apple iWork Numbers', defaultTier: 3, popularTargets: ['xlsx', 'csv', 'pdf'] },
  { id: 'pptx', extension: 'pptx', label: 'PowerPoint PPTX', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', category: 'document', description: 'Microsoft PowerPoint', defaultTier: 3, popularTargets: ['pdf', 'odp', 'png', 'jpg'] },
  { id: 'ppt', extension: 'ppt', label: 'PowerPoint PPT', mime: 'application/vnd.ms-powerpoint', category: 'document', description: 'Legacy PowerPoint', defaultTier: 3, popularTargets: ['pptx', 'pdf', 'odp'] },
  { id: 'odp', extension: 'odp', label: 'OpenDocument ODP', mime: 'application/vnd.oasis.opendocument.presentation', category: 'document', description: 'LibreOffice Impress', defaultTier: 3, popularTargets: ['pdf', 'pptx'] },
  { id: 'key', extension: 'key', label: 'Apple Keynote', mime: 'application/vnd.apple.keynote', category: 'document', description: 'Apple iWork Keynote', defaultTier: 3, popularTargets: ['pdf', 'pptx'] },
  { id: 'tex', extension: 'tex', label: 'LaTeX (TEX)', mime: 'application/x-tex', category: 'document', description: 'LaTeX Typesetting Source', defaultTier: 3, isPlainText: true, popularTargets: ['pdf', 'docx', 'html', 'md'] },
  { id: 'wps', extension: 'wps', label: 'WPS Document', mime: 'application/vnd.ms-works', category: 'document', description: 'Kingsoft / MS Works Doc', defaultTier: 3, popularTargets: ['docx', 'pdf', 'txt'] },

  // ===================== E-BOOKS =====================
  { id: 'epub', extension: 'epub', label: 'EPUB', mime: 'application/epub+zip', category: 'ebook', description: 'Open Electronic Publication', defaultTier: 2, popularTargets: ['txt', 'pdf', 'mobi', 'azw3', 'docx'] },
  { id: 'mobi', extension: 'mobi', label: 'MOBI', mime: 'application/x-mobipocket-ebook', category: 'ebook', description: 'Mobipocket E-Book', defaultTier: 3, popularTargets: ['epub', 'pdf', 'azw3', 'txt'] },
  { id: 'azw3', extension: 'azw3', label: 'Kindle AZW3', mime: 'application/vnd.amazon.ebook', category: 'ebook', description: 'Kindle Format 8 (DRM-free)', defaultTier: 3, popularTargets: ['epub', 'pdf', 'mobi', 'txt'] },
  { id: 'azw', extension: 'azw', label: 'Kindle AZW', mime: 'application/vnd.amazon.ebook', category: 'ebook', description: 'Amazon Kindle Book', defaultTier: 3, popularTargets: ['epub', 'pdf'] },
  { id: 'kfx', extension: 'kfx', label: 'Kindle KFX (DRM)', mime: 'application/vnd.amazon.kfx', category: 'ebook', description: 'Amazon KFX Container', defaultTier: 3, popularTargets: [] },
  { id: 'fb2', extension: 'fb2', label: 'FictionBook FB2', mime: 'application/x-fictionbook+xml', category: 'ebook', description: 'FictionBook XML E-Book', defaultTier: 3, popularTargets: ['epub', 'pdf', 'mobi'] },
  { id: 'djvu', extension: 'djvu', label: 'DjVu', mime: 'image/vnd.djvu', category: 'ebook', description: 'Scanned Document Container', defaultTier: 3, popularTargets: ['pdf', 'png', 'txt'] },
  { id: 'cbz', extension: 'cbz', label: 'Comic Book CBZ', mime: 'application/vnd.comicbook+zip', category: 'ebook', description: 'ZIP Comic Archive', defaultTier: 2, popularTargets: ['pdf', 'zip', 'epub'] },
  { id: 'cbr', extension: 'cbr', label: 'Comic Book CBR', mime: 'application/vnd.comicbook-rar', category: 'ebook', description: 'RAR Comic Archive', defaultTier: 3, popularTargets: ['pdf', 'cbz', 'epub'] },
  { id: 'lit', extension: 'lit', label: 'Microsoft LIT', mime: 'application/x-ms-reader', category: 'ebook', description: 'Legacy MS Reader E-Book', defaultTier: 3, popularTargets: ['epub', 'pdf'] },
  { id: 'lrf', extension: 'lrf', label: 'Sony LRF', mime: 'application/x-sony-bbeb', category: 'ebook', description: 'Sony Portable Reader', defaultTier: 3, popularTargets: ['epub', 'pdf'] },

  // ===================== ARCHIVES =====================
  { id: 'zip', extension: 'zip', label: 'ZIP', mime: 'application/zip', category: 'archive', description: 'Standard ZIP Archive', defaultTier: 2, popularTargets: ['tar', 'gz', 'tgz', '7z', 'zst'] },
  { id: 'tar', extension: 'tar', label: 'TAR', mime: 'application/x-tar', category: 'archive', description: 'Tape Archive', defaultTier: 2, popularTargets: ['zip', 'tgz', 'gz', '7z'] },
  { id: 'gz', extension: 'gz', label: 'GZIP (GZ)', mime: 'application/gzip', category: 'archive', description: 'GNU Zip Compressed Stream', defaultTier: 2, popularTargets: ['zip', 'tar', 'txt'] },
  { id: 'tgz', extension: 'tgz', label: 'TAR.GZ (TGZ)', mime: 'application/gzip', category: 'archive', description: 'Gzipped TAR Archive', defaultTier: 2, popularTargets: ['zip', 'tar', '7z'] },
  { id: 'bz2', extension: 'bz2', label: 'BZIP2', mime: 'application/x-bzip2', category: 'archive', description: 'Burrows-Wheeler Archive', defaultTier: 3, popularTargets: ['zip', 'tar', 'gz'] },
  { id: 'xz', extension: 'xz', label: 'XZ', mime: 'application/x-xz', category: 'archive', description: 'LZMA2 Compressed File', defaultTier: 3, popularTargets: ['zip', 'tar', 'gz'] },
  { id: 'zst', extension: 'zst', label: 'Zstandard (ZST)', mime: 'application/zstd', category: 'archive', description: 'Meta Zstandard Fast Archive', defaultTier: 3, popularTargets: ['zip', 'tar', 'gz'] },
  { id: '7z', extension: '7z', label: '7-Zip (7Z)', mime: 'application/x-7z-compressed', category: 'archive', description: 'High-Ratio 7z Archive', defaultTier: 3, popularTargets: ['zip', 'tar', 'tgz'] },
  { id: 'rar', extension: 'rar', label: 'RAR', mime: 'application/vnd.rar', category: 'archive', description: 'Roshal Archive', defaultTier: 3, popularTargets: ['zip', '7z', 'tar'] },
  { id: 'cab', extension: 'cab', label: 'Windows CAB', mime: 'application/vnd.ms-cab-compressed', category: 'archive', description: 'Microsoft Cabinet Archive', defaultTier: 3, popularTargets: ['zip', '7z'] },
  { id: 'iso', extension: 'iso', label: 'ISO Disc Image', mime: 'application/x-iso9660-image', category: 'archive', description: 'ISO 9660 Optical Image', defaultTier: 3, popularTargets: ['zip', '7z'] },
  { id: 'dmg', extension: 'dmg', label: 'Apple DMG', mime: 'application/x-apple-diskimage', category: 'archive', description: 'macOS Disk Image', defaultTier: 3, popularTargets: ['zip', 'iso'] },

  // ===================== DATA & CODE =====================
  { id: 'json', extension: 'json', label: 'JSON', mime: 'application/json', category: 'data', description: 'JavaScript Object Notation', defaultTier: 2, isPlainText: true, popularTargets: ['yaml', 'toml', 'xml', 'csv', 'tsv', 'txt'] },
  { id: 'yaml', extension: 'yaml', label: 'YAML', mime: 'application/yaml', category: 'data', description: 'YAML Ain’t Markup Language', defaultTier: 2, isPlainText: true, popularTargets: ['json', 'toml', 'xml', 'txt'] },
  { id: 'toml', extension: 'toml', label: 'TOML', mime: 'application/toml', category: 'data', description: 'Tom’s Obvious Minimal Language', defaultTier: 2, isPlainText: true, popularTargets: ['json', 'yaml', 'xml', 'txt'] },
  { id: 'xml', extension: 'xml', label: 'XML', mime: 'application/xml', category: 'data', description: 'Extensible Markup Language', defaultTier: 2, isPlainText: true, popularTargets: ['json', 'yaml', 'csv', 'txt'] },
  { id: 'csv', extension: 'csv', label: 'CSV', mime: 'text/csv', category: 'data', description: 'Comma-Separated Values', defaultTier: 2, isPlainText: true, popularTargets: ['json', 'tsv', 'yaml', 'xml', 'xlsx', 'html', 'pdf'] },
  { id: 'tsv', extension: 'tsv', label: 'TSV', mime: 'text/tab-separated-values', category: 'data', description: 'Tab-Separated Values', defaultTier: 2, isPlainText: true, popularTargets: ['csv', 'json', 'yaml', 'xml'] },
  { id: 'parquet', extension: 'parquet', label: 'Apache Parquet', mime: 'application/vnd.apache.parquet', category: 'data', description: 'Columnar Analytics Format', defaultTier: 3, popularTargets: ['csv', 'json', 'xlsx'] },
  { id: 'avro', extension: 'avro', label: 'Apache Avro', mime: 'application/avro', category: 'data', description: 'Row-Oriented Binary Data', defaultTier: 3, popularTargets: ['json', 'csv', 'parquet'] },
  { id: 'bson', extension: 'bson', label: 'BSON', mime: 'application/bson', category: 'data', description: 'Binary JSON', defaultTier: 3, popularTargets: ['json', 'yaml'] },
  { id: 'sqlite', extension: 'sqlite', label: 'SQLite DB', mime: 'application/vnd.sqlite3', category: 'data', description: 'SQLite Database', defaultTier: 3, popularTargets: ['csv', 'json'] },

  // ===================== 3D MODELS =====================
  { id: 'obj', extension: 'obj', label: 'Wavefront OBJ', mime: 'model/obj', category: 'model3d', description: '3D Geometry Definition', defaultTier: 3, isPlainText: true, popularTargets: ['glb', 'gltf', 'stl', 'fbx', 'ply', 'usdz'] },
  { id: 'stl', extension: 'stl', label: 'STL (3D Print)', mime: 'model/stl', category: 'model3d', description: 'Stereolithography Mesh', defaultTier: 3, popularTargets: ['obj', 'glb', 'gltf', '3mf', 'ply', 'dxf'] },
  { id: 'glb', extension: 'glb', label: 'glTF Binary (GLB)', mime: 'model/gltf-binary', category: 'model3d', description: 'Web & AR 3D Asset', defaultTier: 3, popularTargets: ['obj', 'stl', 'fbx', 'usdz', 'gltf'] },
  { id: 'gltf', extension: 'gltf', label: 'glTF JSON', mime: 'model/gltf+json', category: 'model3d', description: 'GL Transmission Format', defaultTier: 3, isPlainText: true, popularTargets: ['glb', 'obj', 'stl', 'usdz'] },
  { id: 'fbx', extension: 'fbx', label: 'Autodesk FBX', mime: 'application/octet-stream', category: 'model3d', description: 'Filmbox 3D Exchange', defaultTier: 3, popularTargets: ['glb', 'gltf', 'obj', 'stl', 'usdz'] },
  { id: 'ply', extension: 'ply', label: 'Polygon PLY', mime: 'application/octet-stream', category: 'model3d', description: 'Stanford 3D Scan Mesh', defaultTier: 3, popularTargets: ['obj', 'stl', 'glb'] },
  { id: '3ds', extension: '3ds', label: '3D Studio 3DS', mime: 'image/x-3ds', category: 'model3d', description: 'Legacy Autodesk 3DS', defaultTier: 3, popularTargets: ['obj', 'glb', 'fbx', 'stl'] },
  { id: 'dae', extension: 'dae', label: 'COLLADA DAE', mime: 'model/vnd.collada+xml', category: 'model3d', description: 'Digital Asset Exchange', defaultTier: 3, isPlainText: true, popularTargets: ['glb', 'obj', 'fbx', 'stl'] },
  { id: '3mf', extension: '3mf', label: '3D Manufacturing 3MF', mime: 'model/3mf', category: 'model3d', description: '3D Printing Container', defaultTier: 3, popularTargets: ['stl', 'obj', 'glb'] },
  { id: 'blend', extension: 'blend', label: 'Blender BLEND', mime: 'application/x-blender', category: 'model3d', description: 'Blender 3D Project', defaultTier: 3, popularTargets: ['glb', 'fbx', 'obj', 'stl'] },
  { id: 'usdz', extension: 'usdz', label: 'Apple USDZ (AR)', mime: 'model/vnd.usdz+zip', category: 'model3d', description: 'Apple AR Quick Look 3D', defaultTier: 3, popularTargets: ['glb', 'obj', 'fbx'] },

  // ===================== CAD & TECHNICAL =====================
  { id: 'dxf', extension: 'dxf', label: 'AutoCAD DXF', mime: 'image/vnd.dxf', category: 'cad', description: 'Drawing Exchange Format', defaultTier: 3, isPlainText: true, popularTargets: ['pdf', 'svg', 'png', 'dwg'] },
  { id: 'dwg', extension: 'dwg', label: 'AutoCAD DWG', mime: 'image/vnd.dwg', category: 'cad', description: 'AutoCAD Native Drawing', defaultTier: 3, popularTargets: ['dxf', 'pdf', 'svg', 'png'] },
  { id: 'step', extension: 'step', label: 'CAD STEP (STP)', mime: 'application/step', category: 'cad', description: 'ISO 10303 CAD Assembly', defaultTier: 3, isPlainText: true, popularTargets: ['stl', 'obj', 'glb', 'iges'] },
  { id: 'iges', extension: 'iges', label: 'CAD IGES (IGS)', mime: 'model/iges', category: 'cad', description: 'Initial Graphics Exchange', defaultTier: 3, isPlainText: true, popularTargets: ['step', 'stl', 'obj'] },

  // ===================== FONTS =====================
  { id: 'ttf', extension: 'ttf', label: 'TrueType (TTF)', mime: 'font/ttf', category: 'font', description: 'TrueType Outline Font', defaultTier: 3, popularTargets: ['woff2', 'woff', 'otf', 'eot'] },
  { id: 'otf', extension: 'otf', label: 'OpenType (OTF)', mime: 'font/otf', category: 'font', description: 'OpenType Font', defaultTier: 3, popularTargets: ['woff2', 'woff', 'ttf', 'eot'] },
  { id: 'woff', extension: 'woff', label: 'WOFF Web Font', mime: 'font/woff', category: 'font', description: 'Web Open Font Format 1.0', defaultTier: 3, popularTargets: ['woff2', 'ttf', 'otf'] },
  { id: 'woff2', extension: 'woff2', label: 'WOFF2 Web Font', mime: 'font/woff2', category: 'font', description: 'Brotli Compressed Web Font', defaultTier: 3, popularTargets: ['ttf', 'otf', 'woff'] },
  { id: 'eot', extension: 'eot', label: 'Embedded OpenType', mime: 'application/vnd.ms-fontobject', category: 'font', description: 'Legacy IE Web Font', defaultTier: 3, popularTargets: ['woff2', 'ttf', 'woff'] },
];

export const FORMAT_BY_ID: ReadonlyMap<string, FormatDescriptor> = new Map(
  FORMAT_REGISTRY.map((f) => [f.id, f]),
);

const EXTENSION_ALIASES: Record<string, string> = {
  jpeg: 'jpg',
  jpe: 'jpg',
  tif: 'tiff',
  htm: 'html',
  markdown: 'md',
  yml: 'yaml',
  stp: 'step',
  igs: 'iges',
  midi: 'mid',
  ppm: 'pnm',
  pgm: 'pnm',
  pbm: 'pnm',
  'tar.gz': 'tgz',
  aif: 'aiff',
  m4r: 'm4a',
  sqlite3: 'sqlite',
  db: 'sqlite',
};

export function normalizeFormatId(raw: string): string {
  const clean = raw.trim().toLowerCase().replace(/^\./, '');
  return EXTENSION_ALIASES[clean] ?? clean;
}

export function getFormatDescriptor(idOrExt: string): FormatDescriptor | undefined {
  return FORMAT_BY_ID.get(normalizeFormatId(idOrExt));
}

export function getFormatsByCategory(category: FormatCategory | 'all'): FormatDescriptor[] {
  if (category === 'all') return [...FORMAT_REGISTRY];
  return FORMAT_REGISTRY.filter((f) => f.category === category);
}

/**
 * Generates all directed conversion edges across Tier 1 (Native Hardware),
 * Tier 2 (On-Device Local Engine), and Tier 3 (Zero-Knowledge Cloud Worker).
 * Multi-hop paths (up to 3 hops) automatically bridge over 1,000+ format pairs.
 */
function buildConversionEdges(): ConversionEdge[] {
  const edges: ConversionEdge[] = [];

  const add = (
    source: string,
    target: string,
    engineId: EngineId,
    tier: ConversionTier,
    latencyMsEst: number,
    qualityLoss = 0,
    warningCode?: WarningCode,
  ) => {
    if (source === target) return;
    edges.push({ source, target, engineId, tier, latencyMsEst, qualityLoss, warningCode });
  };

  const addMesh = (
    sources: string[],
    targets: string[],
    engineId: EngineId,
    tier: ConversionTier,
    latencyMsEst: number,
    qualityLossFn?: (s: string, t: string) => number,
    warningFn?: (s: string, t: string) => WarningCode | undefined,
  ) => {
    for (const s of sources) {
      for (const t of targets) {
        if (s === t) continue;
        add(
          s,
          t,
          engineId,
          tier,
          latencyMsEst,
          qualityLossFn ? qualityLossFn(s, t) : 0,
          warningFn ? warningFn(s, t) : undefined,
        );
      }
    }
  };

  // --- TIER 1 & TIER 2 IMAGES ---
  const lossyImages = new Set(['jpg', 'webp', 'heic', 'heif', 'avif']);
  const imgLoss = (s: string, t: string) =>
    lossyImages.has(s) && lossyImages.has(t) ? 12 : lossyImages.has(t) ? 8 : 0;
  const imgWarn = (s: string, t: string): WarningCode | undefined =>
    lossyImages.has(s) && lossyImages.has(t) ? 'WARN_LOSSY_REENCODE' : undefined;

  // Tier 1 iOS ImageIO hardware (HEIC, HEIF, DNG, CR2, NEF, ARW, JPG, PNG, WebP, GIF, TIFF, BMP)
  const tier1ImageSources = ['heic', 'heif', 'dng', 'cr2', 'nef', 'arw', 'tiff'];
  addMesh(tier1ImageSources, ['jpg', 'png', 'webp', 'heic'], 'ios_imageio', 1, 220, imgLoss, imgWarn);

  // Tier 2 On-Device Local Image Engine (works identically on iOS & Web offline!)
  const localRasterFormats = ['png', 'jpg', 'webp', 'bmp', 'gif', 'ico'];
  addMesh(localRasterFormats, ['png', 'jpg', 'webp', 'bmp', 'ico'], 'local_image', 2, 160, imgLoss, imgWarn);

  // SVG -> Raster locally (Tier 2) with transparent WARN_RASTERIZE
  for (const t of ['png', 'jpg', 'webp', 'ico']) {
    add('svg', t, 'local_image', 2, 180, 10, 'WARN_RASTERIZE');
  }

  // Tier 2 exotic local images (Rust Core / Local decoders)
  addMesh(['tga', 'qoi', 'pnm', 'hdr', 'exr'], ['png', 'jpg', 'webp'], 'local_image', 2, 260, imgLoss);

  // --- TIER 1 & TIER 2 PDF & OCR ---
  // Images -> PDF directly on-device (Tier 2 pdf-lib / Tier 1 PDFKit)
  for (const s of ['png', 'jpg', 'webp', 'bmp']) {
    add(s, 'pdf', 'local_pdf', 2, 200, 0);
  }
  // Note: HEIC -> PNG (Tier 1) -> PDF (Tier 2) is automatically resolved via 2-hop Dijkstra!
  // Plus SVG -> PNG -> PDF automatically resolved via 2-hop Dijkstra!

  // PDF -> Images & Offline OCR (Tier 1 PDFKit + Vision OCR)
  add('pdf', 'png', 'ios_pdfkit', 1, 350, 5);
  add('pdf', 'jpg', 'ios_pdfkit', 1, 350, 10);
  add('pdf', 'txt', 'ios_vision_ocr', 1, 600, 0);
  for (const s of ['png', 'jpg', 'heic', 'tiff', 'webp']) {
    add(s, 'txt', 'ios_vision_ocr', 1, 550, 0);
  }

  // Tier 3 Cloud Images & Vectors
  addMesh(['psd', 'xcf'], ['png', 'jpg', 'webp', 'tiff', 'pdf'], 'cloud_imagemagick', 3, 2800, () => 8, () => 'WARN_FLATTEN_LAYERS');
  addMesh(['ai', 'eps', 'cdr', 'emf', 'wmf'], ['svg', 'pdf'], 'cloud_inkscape', 3, 2500, () => 0);
  addMesh(['ai', 'eps', 'cdr', 'emf', 'wmf'], ['png', 'jpg', 'webp'], 'cloud_inkscape', 3, 2600, () => 12, () => 'WARN_RASTERIZE');
  addMesh(['avif', 'jxl', 'cr3', 'orf', 'raf', 'rw2'], ['png', 'jpg', 'webp', 'tiff'], 'cloud_imagemagick', 3, 2400, imgLoss);
  addMesh(['png', 'jpg', 'webp', 'tiff'], ['avif', 'jxl', 'psd'], 'cloud_imagemagick', 3, 2400, imgLoss);

  // --- TIER 1 & TIER 3 VIDEO ---
  addMesh(['mp4', 'mov', 'm4v'], ['mp4', 'mov', 'm4v'], 'ios_avfoundation', 1, 900, () => 8, () => 'WARN_LOSSY_REENCODE');
  addMesh(['mp4', 'mov', 'm4v'], ['m4a', 'wav', 'aac'], 'ios_avfoundation', 1, 500, () => 0);
  const cloudVideos = ['mkv', 'webm', 'avi', 'flv', 'wmv', 'mxf', 'vob', 'ts', 'rmvb', '3gp', 'gif'];
  addMesh(cloudVideos, ['mp4', 'mov', 'webm', 'mkv', 'gif'], 'cloud_ffmpeg', 3, 5500, () => 12, () => 'WARN_LOSSY_REENCODE');
  addMesh(['mp4', 'mov', 'm4v'], ['mkv', 'webm', 'avi', 'gif'], 'cloud_ffmpeg', 3, 4500, () => 12, () => 'WARN_LOSSY_REENCODE');
  addMesh(cloudVideos, ['mp3', 'wav', 'm4a', 'flac'], 'cloud_ffmpeg', 3, 3500, () => 4);

  // --- TIER 1, TIER 2 & TIER 3 AUDIO ---
  const lossyAudio = new Set(['mp3', 'm4a', 'aac', 'ogg', 'opus', 'wma', 'amr']);
  const audioWarn = (s: string, t: string): WarningCode | undefined =>
    lossyAudio.has(s) && lossyAudio.has(t) ? 'WARN_LOSSY_REENCODE' : undefined;
  const audioLoss = (s: string, t: string) => (lossyAudio.has(s) && lossyAudio.has(t) ? 15 : lossyAudio.has(t) ? 8 : 0);

  addMesh(['wav', 'm4a', 'aac', 'caf', 'aiff'], ['wav', 'm4a', 'aac'], 'ios_avfoundation', 1, 350, audioLoss, audioWarn);
  addMesh(['mp3', 'flac', 'ogg', 'opus', 'alac', 'wav'], ['wav'], 'local_audio', 2, 300, () => 0);
  const allAudioCloud = ['wav', 'm4a', 'aac', 'caf', 'aiff', 'mp3', 'flac', 'ogg', 'opus', 'alac', 'wma', 'amr', 'ac3', 'dts', 'm4b'];
  addMesh(allAudioCloud, ['mp3', 'flac', 'ogg', 'opus', 'm4a', 'wav', 'aac'], 'cloud_ffmpeg', 3, 2500, audioLoss, audioWarn);
  addMesh(['mid'], ['mp3', 'wav'], 'cloud_ffmpeg', 3, 2800, () => 5);

  // --- TIER 2 & TIER 3 DOCUMENTS & OFFICE ---
  add('md', 'html', 'local_data', 2, 50, 0);
  add('md', 'txt', 'local_data', 2, 40, 0);
  add('html', 'md', 'local_data', 2, 60, 4);
  add('html', 'txt', 'local_data', 2, 50, 5);
  add('txt', 'html', 'local_data', 2, 40, 0);
  add('txt', 'md', 'local_data', 2, 40, 0);
  add('txt', 'pdf', 'local_pdf', 2, 160, 0);
  add('md', 'pdf', 'local_pdf', 2, 190, 0);
  add('rtf', 'txt', 'local_data', 2, 70, 5);

  // Spreadsheets local extraction (Tier 2: XLSX/ODS -> CSV/JSON/TSV!)
  addMesh(['xlsx', 'ods'], ['csv', 'json', 'tsv'], 'local_data', 2, 180, () => 4);

  // Tier 3 Office (LibreOffice + Pandoc)
  const officeDocs = ['docx', 'doc', 'odt', 'rtf', 'pages', 'wps', 'tex', 'html', 'md', 'txt'];
  addMesh(officeDocs, ['pdf', 'docx', 'odt', 'rtf', 'html', 'txt', 'md'], 'cloud_libreoffice', 3, 3200, () => 5, (s) =>
    s === 'pages' ? 'WARN_LAYOUT_SHIFT' : undefined,
  );
  addMesh(['pdf'], ['docx', 'xlsx', 'pptx', 'rtf', 'html', 'epub'], 'cloud_libreoffice', 3, 4200, () => 18, () => 'WARN_LAYOUT_SHIFT');
  addMesh(['xlsx', 'xls', 'ods', 'numbers', 'csv'], ['xlsx', 'ods', 'pdf', 'csv'], 'cloud_libreoffice', 3, 3000, () => 4, (s) =>
    s === 'numbers' ? 'WARN_LAYOUT_SHIFT' : undefined,
  );
  addMesh(['pptx', 'ppt', 'odp', 'key'], ['pdf', 'pptx', 'odp'], 'cloud_libreoffice', 3, 3600, () => 5, (s) =>
    s === 'key' ? 'WARN_LAYOUT_SHIFT' : undefined,
  );
  // Note: DOCX -> PDF (Tier 3) -> PNG (Tier 1) OR PPTX -> PDF -> PNG resolves automatically via multi-hop Dijkstra!

  // --- TIER 2 & TIER 3 E-BOOKS ---
  add('epub', 'txt', 'local_archive', 2, 180, 5);
  add('cbz', 'zip', 'local_archive', 2, 120, 0);
  const ebooks = ['epub', 'mobi', 'azw3', 'azw', 'fb2', 'lit', 'lrf', 'djvu', 'cbz', 'cbr', 'pdf', 'docx', 'md'];
  addMesh(ebooks, ['epub', 'mobi', 'azw3', 'pdf', 'txt', 'fb2'], 'cloud_calibre', 3, 3500, () => 6);

  // --- TIER 2 & TIER 3 ARCHIVES ---
  addMesh(['zip', 'tar', 'gz', 'tgz'], ['zip', 'tar', 'gz', 'tgz'], 'local_archive', 2, 220, () => 0);
  add('txt', 'gz', 'local_archive', 2, 90, 0);
  add('json', 'gz', 'local_archive', 2, 90, 0);
  add('csv', 'gz', 'local_archive', 2, 90, 0);
  // Allow zipping any common local file locally!
  for (const s of ['png', 'jpg', 'webp', 'pdf', 'txt', 'md', 'html', 'json', 'yaml', 'csv', 'xml', 'wav']) {
    add(s, 'zip', 'local_archive', 2, 110, 0);
  }
  const cloudArchives = ['zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'zst', '7z', 'rar', 'cab', 'iso', 'dmg'];
  addMesh(cloudArchives, ['zip', 'tar', 'tgz', '7z', 'zst', 'gz'], 'cloud_archive', 3, 2800, () => 0);

  // --- TIER 2 & TIER 3 DATA & CODE ---
  const localDataFormats = ['json', 'yaml', 'toml', 'xml', 'csv', 'tsv'];
  addMesh(localDataFormats, localDataFormats, 'local_data', 2, 70, () => 0);
  add('csv', 'html', 'local_data', 2, 80, 0);
  add('json', 'txt', 'local_data', 2, 40, 0);
  add('yaml', 'txt', 'local_data', 2, 40, 0);
  addMesh(['parquet', 'avro', 'bson', 'sqlite'], ['csv', 'json', 'parquet', 'xlsx'], 'cloud_data', 3, 2600, () => 0);
  addMesh(['csv', 'json'], ['parquet', 'avro', 'bson'], 'cloud_data', 3, 2600, () => 0);

  // --- TIER 3 3D MODELS ---
  const models3d = ['obj', 'stl', 'glb', 'gltf', 'fbx', 'ply', '3ds', 'dae', '3mf', 'blend', 'usdz'];
  addMesh(models3d, ['obj', 'stl', 'glb', 'gltf', 'fbx', 'ply', '3mf', 'usdz'], 'cloud_assimp', 3, 4500, () => 5);

  // --- TIER 3 CAD & TECHNICAL ---
  addMesh(['dwg', 'dxf'], ['pdf', 'svg', 'png', 'dxf'], 'cloud_cad', 3, 4200, () => 8, (s, t) =>
    s === 'dwg' && (t === 'pdf' || t === 'png') ? 'WARN_FLATTEN_LAYERS' : t === 'png' ? 'WARN_RASTERIZE' : undefined,
  );
  add('svg', 'dxf', 'cloud_cad', 3, 2200, 4);
  add('stl', 'dxf', 'cloud_cad', 3, 3500, 10, 'WARN_FLATTEN_LAYERS');
  addMesh(['step', 'iges'], ['stl', 'obj', 'glb', 'step', 'iges'], 'cloud_cad', 3, 5000, () => 6);

  // --- TIER 3 FONTS ---
  const fonts = ['ttf', 'otf', 'woff', 'woff2', 'eot'];
  addMesh(fonts, fonts, 'cloud_fontforge', 3, 1800, () => 0);

  return edges;
}

export const CONVERSION_EDGES: readonly ConversionEdge[] = buildConversionEdges();
