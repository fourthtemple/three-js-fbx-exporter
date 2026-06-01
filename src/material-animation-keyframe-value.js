import {
  MATERIAL_COLOR_ANIMATION_PROPERTIES,
  MATERIAL_COLOR_COMPONENT_ANIMATION_PROPERTIES,
  MATERIAL_SCALAR_ANIMATION_PROPERTIES,
  MATERIAL_VECTOR_ANIMATION_PROPERTIES,
  MATERIAL_VECTOR_COMPONENT_ANIMATION_PROPERTIES,
  materialAnimationPropertyAliases,
  roughnessToFbxShininess
} from "./material-normalizer.js";
import { componentValue } from "./component-value.js";

const ROUGHNESS_ALIASES = new Set([
  "roughness",
  "materialRoughness",
  "clearcoatRoughness",
  "materialClearcoatRoughness",
  "sheenRoughness",
  "materialSheenRoughness"
]);

function isObjectPayload(value) {
  return value && typeof value === "object" && !Array.isArray(value) && !ArrayBuffer.isView(value);
}

function normalizeMaterialScalarValue(value, property, sourceProperty) {
  if (property === "shininess" && ROUGHNESS_ALIASES.has(sourceProperty)) {
    return roughnessToFbxShininess(value);
  }
  return value;
}

function materialComponentSpec(property) {
  if (!MATERIAL_COLOR_COMPONENT_ANIMATION_PROPERTIES.has(property) && !MATERIAL_VECTOR_COMPONENT_ANIMATION_PROPERTIES.has(property)) {
    return null;
  }
  const suffix = property[property.length - 1];
  const index = { R: 0, G: 1, B: 2, X: 0, Y: 1, Z: 2 }[suffix];
  return index == null ? null : { vectorProperty: property.slice(0, -1), index };
}

function nestedSourceValue(source, reader) {
  const nested = source.value ?? source.defaultValue;
  return nested != null && nested !== source ? reader(nested) : undefined;
}

function materialComponentSourceValue(source, property, spec) {
  if (!isObjectPayload(source)) {
    return componentValue(source, spec.index, source);
  }
  for (const alias of materialAnimationPropertyAliases(property)) {
    if (source[alias] != null) {
      return source[alias];
    }
  }
  for (const alias of materialAnimationPropertyAliases(spec.vectorProperty)) {
    if (source[alias] != null) {
      return componentValue(source[alias], spec.index, 0);
    }
  }
  const nested = nestedSourceValue(source, (value) => materialComponentSourceValue(value, property, spec));
  if (nested != null) {
    return nested;
  }
  return componentValue(source, spec.index, undefined);
}

function materialScalarSourceValue(source, property, sourceProperty) {
  const componentSpec = materialComponentSpec(property);
  if (componentSpec) {
    return materialComponentSourceValue(source, property, componentSpec);
  }
  if (!isObjectPayload(source)) {
    return normalizeMaterialScalarValue(source, property, sourceProperty);
  }
  for (const alias of materialAnimationPropertyAliases(property)) {
    if (source[alias] != null) {
      return normalizeMaterialScalarValue(source[alias], property, alias);
    }
  }
  return nestedSourceValue(source, (value) => materialScalarSourceValue(value, property, sourceProperty));
}

function materialVectorSourceValue(source, property) {
  if (!isObjectPayload(source)) {
    return source;
  }
  for (const alias of materialAnimationPropertyAliases(property)) {
    if (source[alias] != null) {
      return source[alias];
    }
  }
  const nested = nestedSourceValue(source, (value) => materialVectorSourceValue(value, property));
  if (nested != null) {
    return nested;
  }
  if ("x" in source || "y" in source || "z" in source || "r" in source || "g" in source || "b" in source) {
    return source;
  }
  return undefined;
}

export function materialScalarKeyframeValue(keyframe, property, sourceProperty = property) {
  if (
    !MATERIAL_SCALAR_ANIMATION_PROPERTIES.has(property) &&
    !MATERIAL_COLOR_COMPONENT_ANIMATION_PROPERTIES.has(property) &&
    !MATERIAL_VECTOR_COMPONENT_ANIMATION_PROPERTIES.has(property)
  ) {
    return null;
  }
  const direct = keyframe.value ?? keyframe[property] ?? keyframe[sourceProperty];
  if (direct != null) {
    return materialScalarSourceValue(direct, property, sourceProperty);
  }
  const value = materialScalarSourceValue(keyframe, property, sourceProperty);
  return value != null ? value : null;
}

export function materialVectorKeyframeValue(keyframe, property, sourceProperty = property) {
  if (!MATERIAL_COLOR_ANIMATION_PROPERTIES.has(property) && !MATERIAL_VECTOR_ANIMATION_PROPERTIES.has(property)) {
    return undefined;
  }
  const direct = keyframe.value ?? keyframe[property] ?? keyframe[sourceProperty];
  if (direct != null) {
    return materialVectorSourceValue(direct, property);
  }
  return materialVectorSourceValue(keyframe, property);
}
