import { PDFDocument } from "pdf-lib";

export function safePdfName(name: string): string {
  return name.replace(/\.pdf$/i, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "").slice(0, 50) || "document";
}

function parsePageTokens(value: string, count: number): number[][] {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("PDF page count must be a positive integer.");
  if (!value.trim()) throw new Error("Enter at least one page.");
  const tokens = value.split(",");
  const ranges: number[][] = [];
  for (const token of tokens) {
    const match = token.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error("Page range format: 1-3,5,8-10");
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start || end > count) {
      throw new Error("Page numbers must be between 1 and " + count + ".");
    }
    const range: number[] = [];
    for (let page = start; page <= end; page++) range.push(page);
    ranges.push(range);
  }
  return ranges;
}

export function parsePdfPageRange(value: string, count: number): number[] {
  const pages = new Set(parsePageTokens(value, count).flat());
  return [...pages].sort((a, b) => a - b);
}

export function parsePdfPageOrder(value: string, count: number): number[] {
  return parsePageTokens(value, count).flat();
}

export function escapeRtfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/[^\x00-\x7F]/g, char => "\\u" + char.charCodeAt(0) + "?")
    .replace(/\r?\n/g, "\\par\n");
}

export function csvCell(value: string): string {
  return "\"" + value.replace(/"/g, "\"\"") + "\"";
}

export async function reorderPdfDocument(sourceBytes: ArrayBuffer | Uint8Array, pageNumbers: readonly number[]): Promise<Uint8Array> {
  if (!pageNumbers.length) throw new Error("Enter at least one page.");
  const source = await PDFDocument.load(sourceBytes);
  const pageCount = source.getPageCount();
  for (const page of pageNumbers) {
    if (!Number.isSafeInteger(page) || page < 1 || page > pageCount) {
      throw new Error("Page numbers must be between 1 and " + pageCount + ".");
    }
  }
  const output = await PDFDocument.create();
  const copied = await output.copyPages(source, pageNumbers.map(page => page - 1));
  copied.forEach(page => output.addPage(page));
  return output.save();
}
