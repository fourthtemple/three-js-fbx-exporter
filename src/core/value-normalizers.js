export function finiteNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function vector(values, size, fallback) {
  const input = Array.isArray(values) || ArrayBuffer.isView(values)
    ? values
    : objectVector(values);
  return Array.from({ length: size }, (_, index) => finiteNumber(input[index], fallback[index] ?? 0));
}

function objectVector(values) {
  if (!values || typeof values !== "object") {
    return [];
  }
  if ("x" in values || "y" in values || "z" in values) {
    return [values.x, values.y, values.z];
  }
  if ("r" in values || "g" in values || "b" in values) {
    return [values.r, values.g, values.b, values.a];
  }
  if ("u" in values || "v" in values || "w" in values) {
    return [values.u, values.v, values.w];
  }
  return [];
}
