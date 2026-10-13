import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import {
  csvCell,
  escapeRtfText,
  parsePdfPageOrder,
  parsePdfPageRange,
  reorderPdfDocument,
  safePdfName,
} from "../src/lib/pdf-utils.ts";
import {
  getImageExportExtension,
  getTargetSizeBytes,
  normalizeImageDimensions,
} from "../src/lib/image-utils.ts";

test("PDF page ranges expand, sort, and de-duplicate selections", () => {
  assert.deepEqual(parsePdfPageRange("3, 1-2,2,5-4".replace("5-4", "4-5"), 5), [1, 2, 3, 4, 5]);
});

test("PDF page range validation rejects empty, malformed, reversed, and out-of-bounds input", () => {
  assert.throws(() => parsePdfPageRange("", 3), /at least one page/);
  assert.throws(() => parsePdfPageRange("1,,3", 3), /Page range format/);
  assert.throws(() => parsePdfPageRange("3-1", 3), /between 1 and 3/);
  assert.throws(() => parsePdfPageRange("1-4", 3), /between 1 and 3/);
  assert.throws(() => parsePdfPageRange("1", 0), /positive integer/);
});

test("custom PDF page order preserves the requested order and ranges", () => {
  assert.deepEqual(parsePdfPageOrder("3,1-2,5", 5), [3, 1, 2, 5]);
  assert.throws(() => parsePdfPageOrder("4", 3), /between 1 and 3/);
});

test("PDF export names remove extensions and unsafe path characters", () => {
  assert.equal(safePdfName("../../My file.PDF"), "My-file");
  assert.equal(safePdfName("..."), "document");
  assert.equal(safePdfName("a".repeat(60) + ".pdf").length, 50);
});

test("RTF escaping protects braces, backslashes, newlines and Unicode", () => {
  const escaped = escapeRtfText("A {B} \\ C\nह");
  assert.ok(escaped.includes("\\{B\\}"));
  assert.ok(escaped.includes("\\\\ C"));
  assert.ok(escaped.includes("\\par\n"));
  assert.ok(escaped.includes("\\u"));
});

test("CSV cell escaping quotes values and doubles embedded quotes", () => {
  assert.equal(csvCell('Hello, "student"'), '"Hello, ""student"""');
  assert.equal(csvCell("plain"), '"plain"');
});

test("PDF reorder export keeps only requested pages in the requested order", async () => {
  const source = await PDFDocument.create();
  source.addPage([100, 200]);
  source.addPage([300, 400]);
  source.addPage([500, 600]);
  const bytes = await source.save();

  const reorderedBytes = await reorderPdfDocument(bytes, [3, 1]);
  const reordered = await PDFDocument.load(reorderedBytes);
  assert.equal(reordered.getPageCount(), 2);
  assert.deepEqual(reordered.getPages().map(page => [page.getWidth(), page.getHeight()]), [[500, 600], [100, 200]]);
});

test("PDF reorder export rejects empty or invalid page selections", async () => {
  const source = await PDFDocument.create();
  source.addPage([100, 100]);
  const bytes = await source.save();
  await assert.rejects(reorderPdfDocument(bytes, []), /at least one page/);
  await assert.rejects(reorderPdfDocument(bytes, [2]), /between 1 and 1/);
  await assert.rejects(reorderPdfDocument(bytes, [0]), /between 1 and 1/);
});

test("image dimensions are rounded and clamped to safe canvas bounds", () => {
  assert.deepEqual(normalizeImageDimensions(1200.4, 800.6), { width: 1200, height: 801 });
  assert.deepEqual(normalizeImageDimensions(9000, -4), { width: 6000, height: 1 });
  assert.deepEqual(normalizeImageDimensions(Number.NaN, Number.POSITIVE_INFINITY), { width: 1, height: 1 });
});

test("target image size is clamped to supported minimum and maximum", () => {
  assert.equal(getTargetSizeBytes(200), 200 * 1024);
  assert.equal(getTargetSizeBytes(1), 10 * 1024);
  assert.equal(getTargetSizeBytes(20000), 10000 * 1024);
  assert.equal(getTargetSizeBytes(Number.NaN), 10 * 1024);
});

test("image export extensions match the selected MIME type", () => {
  assert.equal(getImageExportExtension("image/jpeg"), "jpg");
  assert.equal(getImageExportExtension("image/png"), "png");
  assert.equal(getImageExportExtension("image/webp"), "webp");
});
