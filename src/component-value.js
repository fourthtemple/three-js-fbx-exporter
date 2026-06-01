const COMPONENT_KEYS = Object.freeze([
  ["x", "r", "u", 0, "0"],
  ["y", "g", "v", 1, "1"],
  ["z", "b", "w", 2, "2"]
]);

export function componentValue(value, index, fallback = 0) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    return value[index] ?? fallback;
  }
  if (value && typeof value === "object") {
    const keys = COMPONENT_KEYS[index] || [];
    for (const key of keys) {
      const component = value[key];
      if (component != null) {
        return component;
      }
    }
    return fallback;
  }
  return value ?? fallback;
}
