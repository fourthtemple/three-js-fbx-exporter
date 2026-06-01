export function normalizeTextureAlpha(value) {
  if (value == null) {
    return 1;
  }
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 1;
}

export function normalizeTextureAlphaSource(value) {
  if (Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (value == null) {
    return 0;
  }
  const text = String(value).toLowerCase();
  if (text.includes("rgb") || text.includes("intensity") || text.includes("luminance")) {
    return 1;
  }
  if (text.includes("black") || text.includes("alpha") || text.includes("channel")) {
    return 2;
  }
  return 0;
}
