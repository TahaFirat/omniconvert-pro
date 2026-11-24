export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Apple HIG middle-truncation so file extensions (.pdf, .heic, .docx) remain legible on narrow screens.
 */
export function middleTruncate(text: string, maxLen = 28): string {
  if (text.length <= maxLen) return text;
  const dotIdx = text.lastIndexOf('.');
  if (dotIdx > 0 && text.length - dotIdx <= 8) {
    const ext = text.slice(dotIdx);
    const stem = text.slice(0, dotIdx);
    const budget = Math.max(8, maxLen - ext.length - 1);
    const head = Math.ceil(budget * 0.65);
    const tail = Math.max(2, budget - head);
    return `${stem.slice(0, head)}…${stem.slice(-tail)}${ext}`;
  }
  const head = Math.ceil((maxLen - 1) * 0.6);
  const tail = maxLen - 1 - head;
  return `${text.slice(0, head)}…${text.slice(-tail)}`;
}
