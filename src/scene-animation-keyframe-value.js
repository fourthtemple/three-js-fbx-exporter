const SCALAR_PROPERTY_ALIASES = Object.freeze({
  cameraFocalLength: ["cameraFocalLength", "focalLength", "lens"],
  cameraFocusDistance: ["cameraFocusDistance", "focusDistance", "dofFocusDistance"],
  cameraOrthoZoom: ["cameraOrthoZoom", "orthoZoom", "orthoScale", "orthographicScale", "zoom"],
  lightIntensity: ["lightIntensity", "intensity"],
  lightDistance: ["lightDistance", "distance", "farAttenuationEnd"],
  lightInnerAngle: ["lightInnerAngle", "innerAngle", "spotInnerAngle", "hotSpotAngle", "angle"],
  lightOuterAngle: ["lightOuterAngle", "outerAngle", "spotOuterAngle", "spotAngle", "coneAngle", "angle"]
});

const VECTOR_PROPERTY_ALIASES = Object.freeze({
  lightColor: ["lightColor", "color"]
});

function isObjectPayload(value) {
  return value && typeof value === "object" && !Array.isArray(value) && !ArrayBuffer.isView(value);
}

function nestedSourceValue(source, reader) {
  const nested = source.value ?? source.defaultValue;
  return nested != null && nested !== source ? reader(nested) : undefined;
}

function aliasedSourceValue(source, aliases) {
  if (!isObjectPayload(source)) {
    return source;
  }
  for (const alias of aliases) {
    if (source[alias] != null) {
      return source[alias];
    }
  }
  return nestedSourceValue(source, (value) => aliasedSourceValue(value, aliases));
}

function vectorSourceValue(source, aliases) {
  if (!isObjectPayload(source)) {
    return source;
  }
  const value = aliasedSourceValue(source, aliases);
  if (value != null) {
    return value;
  }
  if ("x" in source || "y" in source || "z" in source || "r" in source || "g" in source || "b" in source) {
    return source;
  }
  return undefined;
}

export function sceneScalarKeyframeValue(keyframe, property, sourceProperty = property) {
  const aliases = SCALAR_PROPERTY_ALIASES[property];
  if (!aliases) {
    return null;
  }
  const sourceAliases = sourceProperty === property ? aliases : [sourceProperty, ...aliases];
  const direct = keyframe.value ?? keyframe[property] ?? keyframe[sourceProperty];
  const value = direct != null
    ? aliasedSourceValue(direct, sourceAliases)
    : aliasedSourceValue(keyframe, sourceAliases);
  return value != null ? value : null;
}

export function sceneVectorKeyframeValue(keyframe, property, sourceProperty = property) {
  const aliases = VECTOR_PROPERTY_ALIASES[property];
  if (!aliases) {
    return undefined;
  }
  const sourceAliases = sourceProperty === property ? aliases : [sourceProperty, ...aliases];
  const direct = keyframe.value ?? keyframe[property] ?? keyframe[sourceProperty];
  return direct != null
    ? vectorSourceValue(direct, sourceAliases)
    : vectorSourceValue(keyframe, sourceAliases);
}
