const CHARACTER_EXPORT_DEFAULTS = Object.freeze({
  bakeAnimations: true,
  embedTextures: true,
  frameRate: 30,
  textureTransformMode: "blender"
});

export function normalizeExportOptions(options = {}) {
  const warnings = Array.isArray(options.warnings) ? options.warnings : [];
  return {
    ...options,
    warnings,
    onWarning: typeof options.onWarning === "function" ? options.onWarning : null
  };
}

export function createCharacterExportOptions(options = {}) {
  return normalizeExportOptions({
    ...CHARACTER_EXPORT_DEFAULTS,
    ...options
  });
}

export function emitExportWarning(options, warning) {
  if (!options) {
    return null;
  }
  const entry = typeof warning === "string"
    ? { code: "export.warning", message: warning }
    : warning;
  options.warnings?.push(entry);
  options.onWarning?.(entry);
  return entry;
}
