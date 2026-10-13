export type ImageDimensions = { width: number; height: number };

export function normalizeImageDimensions(width: number, height: number, maxDimension = 6000): ImageDimensions {
  const max = Number.isFinite(maxDimension) ? Math.max(1, Math.floor(maxDimension)) : 6000;
  const normalize = (value: number) => Number.isFinite(value)
    ? Math.max(1, Math.min(max, Math.round(value) || 1))
    : 1;
  return { width: normalize(width), height: normalize(height) };
}

export function getTargetSizeBytes(targetKB: number): number {
  const kb = Number.isFinite(targetKB) ? Math.max(10, Math.min(10000, targetKB)) : 10;
  return Math.round(kb) * 1024;
}

export function getImageExportExtension(mimeType: string): "jpg" | "png" | "webp" {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}
