import * as yaml from 'js-yaml';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import Papa from 'papaparse';
import { marked } from 'marked';
import { OmniError } from '../../core/errors';
import { safeUnzip } from './localArchiveConverter';

function stripHtmlToMarkdown(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripRtfToText(rtf: string): string {
  return rtf
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\tab/g, '\t')
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\[a-z]+-?\d* ?/g, '')
    .replace(/[{}]/g, '')
    .trim();
}

function escapeHtml(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Extracts paragraphs, headings, and table lines from a real .docx (word/document.xml) on-device.
 */
export function extractDocxParagraphs(bytes: Uint8Array): string[] {
  const files = safeUnzip(bytes);
  const docEntry = files['word/document.xml'];
  if (!docEntry) {
    throw new OmniError('DOCX_PARSE_ERROR', 'word/document.xml not found inside DOCX archive.');
  }
  const xml = new TextDecoder('utf-8', { fatal: false }).decode(docEntry);
  // Split by Word paragraph tags <w:p ...>...</w:p> and pull all <w:t> text runs cleanly
  const paragraphs: string[] = [];
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  const tRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;

  let pMatch: RegExpExecArray | null;
  while ((pMatch = pRegex.exec(xml)) !== null) {
    const pBody = pMatch[1];
    let line = '';
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tRegex.exec(pBody)) !== null) {
      line += tMatch[1]
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&apos;', "'");
    }
    const cleaned = line.trim();
    if (cleaned) paragraphs.push(cleaned);
  }
  return paragraphs;
}

/**
 * Extracts tabular rows from .xlsx (Office Open XML) or .ods (OpenDocument) locally using fflate + XMLParser.
 */
function extractSpreadsheetRows(bytes: Uint8Array, format: 'xlsx' | 'ods'): Record<string, string>[] {
  const files = safeUnzip(bytes);
  const decoder = new TextDecoder();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

  if (format === 'xlsx') {
    const sharedStrings: string[] = [];
    if (files['xl/sharedStrings.xml']) {
      const ssXml = parser.parse(decoder.decode(files['xl/sharedStrings.xml']));
      const siList = ssXml?.sst?.si;
      const arr = Array.isArray(siList) ? siList : siList ? [siList] : [];
      for (const si of arr) {
        if (typeof si?.t === 'string') sharedStrings.push(si.t);
        else if (si?.t && typeof si.t['#text'] === 'string') sharedStrings.push(si.t['#text']);
        else if (Array.isArray(si?.r)) {
          sharedStrings.push(si.r.map((r: { t?: string }) => r?.t ?? '').join(''));
        } else {
          sharedStrings.push('');
        }
      }
    }

    const sheetKey = Object.keys(files)
      .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k))
      .sort()[0];
    if (!sheetKey) throw new OmniError('XLSX_PARSE_ERROR', 'No worksheet found inside XLSX.');

    const sheetXml = parser.parse(decoder.decode(files[sheetKey]));
    const rowsRaw = sheetXml?.worksheet?.sheetData?.row;
    const rowsArr = Array.isArray(rowsRaw) ? rowsRaw : rowsRaw ? [rowsRaw] : [];

    const matrix: string[][] = rowsArr.map((row: { c?: unknown }) => {
      const cells = Array.isArray(row.c) ? row.c : row.c ? [row.c] : [];
      return cells.map((cell: { '@_t'?: string; v?: string | number; is?: { t?: string } }) => {
        if (cell['@_t'] === 's') {
          const idx = Number(cell.v);
          return sharedStrings[idx] ?? '';
        }
        if (cell['@_t'] === 'inlineStr') {
          return String(cell.is?.t ?? '');
        }
        return cell.v !== undefined ? String(cell.v) : '';
      });
    });

    if (matrix.length === 0) return [];
    const headers = matrix[0].map((h, i) => h || `col_${i + 1}`);
    return matrix.slice(1).map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = r[i] ?? '';
      });
      return obj;
    });
  }

  // ODS (content.xml)
  if (!files['content.xml']) throw new OmniError('ODS_PARSE_ERROR', 'No content.xml found inside ODS.');
  const odsXml = parser.parse(decoder.decode(files['content.xml']));
  const tables = odsXml?.['office:document-content']?.['office:body']?.['office:spreadsheet']?.['table:table'];
  const firstTable = Array.isArray(tables) ? tables[0] : tables;
  const rowsRaw = firstTable?.['table:table-row'];
  const rowsArr = Array.isArray(rowsRaw) ? rowsRaw : rowsRaw ? [rowsRaw] : [];
  const matrix: string[][] = rowsArr
    .map((row: { 'table:table-cell'?: unknown }) => {
      const cells = Array.isArray(row['table:table-cell'])
        ? row['table:table-cell']
        : row['table:table-cell']
          ? [row['table:table-cell']]
          : [];
      return cells.map((cell: { 'text:p'?: unknown }) => {
        const p = cell['text:p'];
        if (typeof p === 'string' || typeof p === 'number') return String(p);
        return '';
      });
    })
    .filter((r: string[]) => r.some((v) => v.length > 0));

  if (matrix.length === 0) return [];
  const headers = matrix[0].map((h, i) => h || `col_${i + 1}`);
  return matrix.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = r[i] ?? '';
    });
    return obj;
  });
}

function normalizeTabularRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.map((item) =>
      item && typeof item === 'object' ? (item as Record<string, unknown>) : { value: item },
    );
  }
  if (data && typeof data === 'object') {
    // Unwrap single root array if present (e.g., XML <root><row>...</row></root>)
    const values = Object.values(data as Record<string, unknown>);
    if (values.length === 1 && Array.isArray(values[0])) {
      return normalizeTabularRows(values[0]);
    }
    return [data as Record<string, unknown>];
  }
  return [{ value: data }];
}

export async function convertDataLocally(
  inputBlob: Blob,
  sourceFormat: string,
  targetFormat: string,
): Promise<{ blob: Blob; mime: string; previewText: string }> {
  // Handle binary Word documents (.docx) 100% locally!
  if (sourceFormat === 'docx') {
    const bytes = new Uint8Array(await inputBlob.arrayBuffer());
    const paragraphs = extractDocxParagraphs(bytes);
    if (targetFormat === 'txt') {
      const text = paragraphs.join('\n\n');
      return { blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), mime: 'text/plain', previewText: text };
    }
    if (targetFormat === 'md') {
      const md = paragraphs.join('\n\n');
      return { blob: new Blob([md], { type: 'text/markdown;charset=utf-8' }), mime: 'text/markdown', previewText: md };
    }
    if (targetFormat === 'html') {
      const body = paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n');
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,sans-serif;max-width:740px;margin:2rem auto;padding:0 1rem;line-height:1.6}</style></head><body>${body}</body></html>`;
      return { blob: new Blob([html], { type: 'text/html;charset=utf-8' }), mime: 'text/html', previewText: html };
    }
  }

  // Handle binary spreadsheets (XLSX / ODS) first
  if (sourceFormat === 'xlsx' || sourceFormat === 'ods') {
    const bytes = new Uint8Array(await inputBlob.arrayBuffer());
    const rows = extractSpreadsheetRows(bytes, sourceFormat);
    if (targetFormat === 'json') {
      const text = JSON.stringify(rows, null, 2);
      return { blob: new Blob([text], { type: 'application/json' }), mime: 'application/json', previewText: text };
    }
    if (targetFormat === 'csv' || targetFormat === 'tsv') {
      const text = Papa.unparse(rows, { delimiter: targetFormat === 'tsv' ? '\t' : ',' });
      const mime = targetFormat === 'tsv' ? 'text/tab-separated-values' : 'text/csv';
      return { blob: new Blob([text], { type: mime }), mime, previewText: text };
    }
    if (targetFormat === 'html') {
      const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
      const thead = cols.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
      const tbody = rows
        .map((r) => `<tr>${cols.map((c) => `<td>${escapeHtml(String(r[c] ?? ''))}</td>`).join('')}</tr>`)
        .join('\n');
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse;font-family:sans-serif}th,td{border:1px solid #cbd5e1;padding:6px 10px}</style></head><body><table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></body></html>`;
      return { blob: new Blob([html], { type: 'text/html;charset=utf-8' }), mime: 'text/html', previewText: html };
    }
  }

  const rawText = await inputBlob.text();

  // Markup & Plain Text direct paths
  if (sourceFormat === 'rtf' && targetFormat === 'txt') {
    const text = stripRtfToText(rawText);
    return { blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), mime: 'text/plain', previewText: text };
  }
  if (sourceFormat === 'md' && targetFormat === 'html') {
    const body = await marked.parse(rawText);
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,sans-serif;max-width:740px;margin:2rem auto;padding:0 1rem;line-height:1.6}</style></head><body>${body}</body></html>`;
    return { blob: new Blob([html], { type: 'text/html;charset=utf-8' }), mime: 'text/html', previewText: html };
  }
  if (sourceFormat === 'md' && targetFormat === 'txt') {
    const html = await marked.parse(rawText);
    const text = stripHtmlToMarkdown(html).replace(/[#*`]/g, '');
    return { blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), mime: 'text/plain', previewText: text };
  }
  if (sourceFormat === 'html' && targetFormat === 'md') {
    const md = stripHtmlToMarkdown(rawText);
    return { blob: new Blob([md], { type: 'text/markdown;charset=utf-8' }), mime: 'text/markdown', previewText: md };
  }
  if (sourceFormat === 'html' && targetFormat === 'txt') {
    const text = stripHtmlToMarkdown(rawText).replace(/[#*`]/g, '');
    return { blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), mime: 'text/plain', previewText: text };
  }
  if (sourceFormat === 'txt' && targetFormat === 'html') {
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><pre>${escapeHtml(rawText)}</pre></body></html>`;
    return { blob: new Blob([html], { type: 'text/html;charset=utf-8' }), mime: 'text/html', previewText: html };
  }
  if (sourceFormat === 'txt' && targetFormat === 'md') {
    return { blob: new Blob([rawText], { type: 'text/markdown;charset=utf-8' }), mime: 'text/markdown', previewText: rawText };
  }
  if (targetFormat === 'txt' && ['json', 'yaml', 'toml', 'xml', 'csv', 'tsv'].includes(sourceFormat)) {
    return { blob: new Blob([rawText], { type: 'text/plain;charset=utf-8' }), mime: 'text/plain', previewText: rawText };
  }

  // Structured data parsing -> canonical JS value
  let parsed: unknown;
  switch (sourceFormat) {
    case 'json':
      parsed = JSON.parse(rawText);
      break;
    case 'yaml':
      parsed = yaml.load(rawText);
      break;
    case 'toml':
      parsed = parseToml(rawText);
      break;
    case 'xml': {
      const xmlParser = new XMLParser({ ignoreAttributes: false, parseTagValue: true });
      parsed = xmlParser.parse(rawText);
      break;
    }
    case 'csv':
    case 'tsv': {
      const res = Papa.parse<Record<string, unknown>>(rawText, {
        header: true,
        skipEmptyLines: true,
        delimiter: sourceFormat === 'tsv' ? '\t' : ',',
      });
      parsed = res.data;
      break;
    }
    default:
      throw new OmniError('DATA_PARSE_UNSUPPORTED', `Unsupported local data source: ${sourceFormat}`);
  }

  // Canonical JS value -> target structured serialization
  switch (targetFormat) {
    case 'json': {
      const out = JSON.stringify(parsed, null, 2);
      return { blob: new Blob([out], { type: 'application/json;charset=utf-8' }), mime: 'application/json', previewText: out };
    }
    case 'yaml': {
      const out = yaml.dump(parsed, { indent: 2, lineWidth: 100 });
      return { blob: new Blob([out], { type: 'application/yaml;charset=utf-8' }), mime: 'application/yaml', previewText: out };
    }
    case 'toml': {
      const tomlObj =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : { items: parsed };
      const out = stringifyToml(tomlObj as Record<string, never>);
      return { blob: new Blob([out], { type: 'application/toml;charset=utf-8' }), mime: 'application/toml', previewText: out };
    }
    case 'xml': {
      const builder = new XMLBuilder({ format: true, ignoreAttributes: false });
      const wrapped = Array.isArray(parsed) ? { root: { item: parsed } } : { root: parsed };
      const out = `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(wrapped)}`;
      return { blob: new Blob([out], { type: 'application/xml;charset=utf-8' }), mime: 'application/xml', previewText: out };
    }
    case 'csv':
    case 'tsv': {
      const rows = normalizeTabularRows(parsed);
      const out = Papa.unparse(rows, { delimiter: targetFormat === 'tsv' ? '\t' : ',' });
      const mime = targetFormat === 'tsv' ? 'text/tab-separated-values' : 'text/csv';
      return { blob: new Blob([out], { type: `${mime};charset=utf-8` }), mime, previewText: out };
    }
    case 'html': {
      const rows = normalizeTabularRows(parsed);
      const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
      const thead = cols.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
      const tbody = rows
        .map((r) => `<tr>${cols.map((c) => `<td>${escapeHtml(String(r[c] ?? ''))}</td>`).join('')}</tr>`)
        .join('\n');
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse;font-family:sans-serif}th,td{border:1px solid #cbd5e1;padding:6px 10px}</style></head><body><table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></body></html>`;
      return { blob: new Blob([html], { type: 'text/html;charset=utf-8' }), mime: 'text/html', previewText: html };
    }
    default:
      throw new OmniError('DATA_ENCODE_UNSUPPORTED', `Unsupported local data target: ${targetFormat}`);
  }
}
