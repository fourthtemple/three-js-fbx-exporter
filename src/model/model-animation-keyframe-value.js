import {
  MODEL_COMPONENT_ANIMATION_PROPERTIES,
  MODEL_VECTOR_ANIMATION_PROPERTIES,
  MODEL_VECTOR_ANIMATION_SPECS
} from "./model-animation-normalizer.js";
import { componentValue } from "../core/component-value.js";

const AXIS_INDEX = Object.freeze({ X: 0, Y: 1, Z: 2 });

const MODEL_VECTOR_VALUE_ALIASES = Object.freeze({
  translation: ["translation", "position", "translate"],
  rotation: ["rotation"],
  scale: ["scale", "scaling"],
  rotationOffset: ["rotationOffset"],
  rotationPivot: ["rotationPivot"],
  preRotation: ["preRotation"],
  postRotation: ["postRotation"],
  scalingOffset: ["scalingOffset"],
  scalingPivot: ["scalingPivot"],
  geometricTranslation: ["geometricTranslation"],
  geometricRotation: ["geometricRotation"],
  geometricScaling: ["geometricScaling", "geometricScale"]
});

const MODEL_SCALAR_VALUE_ALIASES = Object.freeze({
  morph: ["morph", "weight", "influence", "morphTargetInfluence", "blendShape", "shape"],
  visibility: ["visibility", "visible", "Visibility"]
});

function isObjectPayload(value) {
  return value && typeof value === "object" && !Array.isArray(value) && !ArrayBuffer.isView(value);
}

function nestedSourceValue(source, reader) {
  const nested = source.value ?? source.defaultValue;
  return nested != null && nested !== source ? reader(nested) : undefined;
}

function modelComponentSpec(property) {
  if (!MODEL_COMPONENT_ANIMATION_PROPERTIES.includes(property)) {
    return null;
  }
  const vectorProperty = MODEL_VECTOR_ANIMATION_PROPERTIES
    .filter((candidate) => property.startsWith(candidate))
    .sort((a, b) => b.length - a.length)[0];
  const axis = property.slice(vectorProperty.length);
  const index = AXIS_INDEX[axis];
  return index == null ? null : { vectorProperty, index };
}

function aliasesForVectorProperty(property, sourceProperty) {
  const aliases = MODEL_VECTOR_VALUE_ALIASES[property] || [property];
  return sourceProperty && sourceProperty !== property ? [sourceProperty, ...aliases] : aliases;
}

function aliasesForScalarProperty(property, sourceProperty) {
  const aliases = MODEL_SCALAR_VALUE_ALIASES[property] || [property];
  return sourceProperty && sourceProperty !== property ? [sourceProperty, ...aliases] : aliases;
}

function scalarSourceValue(source, aliases) {
  if (!isObjectPayload(source)) {
    return source;
  }
  for (const alias of aliases) {
    if (source[alias] != null) {
      return source[alias];
    }
  }
  return nestedSourceValue(source, (value) => scalarSourceValue(value, aliases));
}

function vectorSourceValue(source, property, sourceProperty) {
  if (!isObjectPayload(source)) {
    return source;
  }
  for (const alias of aliasesForVectorProperty(property, sourceProperty)) {
    if (source[alias] != null) {
      return source[alias];
    }
  }
  const nested = nestedSourceValue(source, (value) => vectorSourceValue(value, property, sourceProperty));
  if (nested != null) {
    return nested;
  }
  if ("x" in source || "y" in source || "z" in source) {
    return source;
  }
  return undefined;
}

function componentSourceValue(source, property, spec, sourceProperty) {
  if (!isObjectPayload(source)) {
    return componentValue(source, spec.index, source);
  }
  const componentAliases = sourceProperty && sourceProperty !== property ? [sourceProperty, property] : [property];
  for (const alias of componentAliases) {
    if (source[alias] != null) {
      return source[alias];
    }
  }
  const vectorValue = vectorSourceValue(source, spec.vectorProperty, sourceProperty);
  if (vectorValue != null && vectorValue !== source) {
    return componentValue(vectorValue, spec.index, MODEL_VECTOR_ANIMATION_SPECS[spec.vectorProperty].fallback[spec.index]);
  }
  const nested = nestedSourceValue(source, (value) => componentSourceValue(value, property, spec, sourceProperty));
  if (nested != null) {
    return nested;
  }
  return componentValue(source, spec.index, undefined);
}

export function modelScalarKeyframeValue(keyframe, property, sourceProperty = property) {
  const componentSpec = modelComponentSpec(property);
  if (componentSpec) {
    const direct = keyframe.value ?? keyframe[property] ?? keyframe[sourceProperty];
    const value = direct != null
      ? componentSourceValue(direct, property, componentSpec, sourceProperty)
      : componentSourceValue(keyframe, property, componentSpec, sourceProperty);
    return value != null ? value : null;
  }
  if (!MODEL_SCALAR_VALUE_ALIASES[property]) {
    return null;
  }
  const aliases = aliasesForScalarProperty(property, sourceProperty);
  const direct = keyframe.value ?? keyframe[property] ?? keyframe[sourceProperty];
  const value = direct != null ? scalarSourceValue(direct, aliases) : scalarSourceValue(keyframe, aliases);
  return value != null ? value : null;
}

export function modelVectorKeyframeValue(keyframe, property, sourceProperty = property) {
  if (!MODEL_VECTOR_ANIMATION_PROPERTIES.includes(property)) {
    return undefined;
  }
  const direct = keyframe.value ?? keyframe[property] ?? keyframe[sourceProperty];
  return direct != null
    ? vectorSourceValue(direct, property, sourceProperty)
    : vectorSourceValue(keyframe, property, sourceProperty);
}
