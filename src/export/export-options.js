const CHARACTER_EXPORT_DEFAULTS = Object.freeze({
  bakeAnimations: true,
  embedTextures: true,
  frameRate: 30,
  textureTransformMode: "blender"
});

const TARGET_PRESETS = Object.freeze({
  threejs: Object.freeze({ upAxis: "Y", forwardAxis: "Z", coordAxis: "X", unitScale: 1 }),
  unity: Object.freeze({ upAxis: "Y", forwardAxis: "Z", coordAxis: "X", unitScale: 1 }),
  unreal: Object.freeze({ upAxis: "Z", forwardAxis: "X", coordAxis: "Y", unitScale: 1 }),
  blender: Object.freeze({ upAxis: "Y", forwardAxis: "Z", coordAxis: "X", unitScale: 100 }),
  maya: Object.freeze({ upAxis: "Y", forwardAxis: "Z", coordAxis: "X", unitScale: 100 })
});

function normalizedTargetName(value) {
  if (value == null || value === "") {
    return "threejs";
  }
  const name = String(value).trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (name === "three" || name === "threejs" || name === "three.js") return "threejs";
  if (name === "ue" || name === "ue4" || name === "ue5" || name === "unrealengine") return "unreal";
  return name;
}

export function resolveTargetPreset(target = "threejs", overrides = {}) {
  const name = normalizedTargetName(target);
  const preset = TARGET_PRESETS[name];
  if (!preset) {
    throw new Error(`Unknown FBX target preset '${target}'`);
  }
  return {
    target: name,
    ...preset,
    ...overrides
  };
}

export function normalizeExportOptions(options = {}) {
  const warnings = Array.isArray(options.warnings) ? options.warnings : [];
  const targetPreset = resolveTargetPreset(options.target ?? options.preset, {
    ...(options.upAxis ? { upAxis: options.upAxis } : {}),
    ...(options.forwardAxis ? { forwardAxis: options.forwardAxis } : {}),
    ...(options.frontAxis ? { forwardAxis: options.frontAxis } : {}),
    ...(options.coordAxis ? { coordAxis: options.coordAxis } : {}),
    ...(options.unitScale != null ? { unitScale: options.unitScale } : {})
  });
  return {
    ...options,
    targetPreset,
    upAxis: targetPreset.upAxis,
    forwardAxis: targetPreset.forwardAxis,
    frontAxis: targetPreset.forwardAxis,
    coordAxis: targetPreset.coordAxis,
    unitScale: targetPreset.unitScale,
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
