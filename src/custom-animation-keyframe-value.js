import { componentValue } from "./component-value.js";
import {
  customMaterialAnimationKind,
  customMaterialFbxProperty,
  customMaterialVectorComponentIndex,
  isCustomMaterialAnimationProperty
} from "./material-custom-properties.js";
import {
  customModelAnimationKind,
  customModelFbxProperty,
  customModelVectorComponentIndex,
  isCustomModelAnimationProperty
} from "./model-custom-properties.js";
import {
  customTextureAnimationKind,
  customTextureFbxProperty,
  customTextureVectorComponentIndex,
  isCustomTextureAnimationProperty
} from "./texture-custom-properties.js";

function customAnimationSpec(property) {
  if (isCustomMaterialAnimationProperty(property)) {
    return {
      fbxProperty: customMaterialFbxProperty(property),
      kind: customMaterialAnimationKind(property),
      componentIndex: customMaterialVectorComponentIndex(property)
    };
  }
  if (isCustomTextureAnimationProperty(property)) {
    return {
      fbxProperty: customTextureFbxProperty(property),
      kind: customTextureAnimationKind(property),
      componentIndex: customTextureVectorComponentIndex(property)
    };
  }
  if (isCustomModelAnimationProperty(property)) {
    return {
      fbxProperty: customModelFbxProperty(property),
      kind: customModelAnimationKind(property),
      componentIndex: customModelVectorComponentIndex(property)
    };
  }
  return null;
}

function sourceValue(source, fbxProperty, seen = new Set(), allowPlainObjectPayload = false) {
  if (!source || typeof source !== "object" || Array.isArray(source) || ArrayBuffer.isView(source)) {
    return { found: true, value: source };
  }
  if (seen.has(source)) {
    return { found: false, value: undefined };
  }
  seen.add(source);
  if (source[fbxProperty] != null) {
    return sourceValue(source[fbxProperty], fbxProperty, seen, true);
  }
  if (Object.hasOwn(source, "value")) {
    return sourceValue(source.value, fbxProperty, seen, true);
  }
  if (Object.hasOwn(source, "defaultValue")) {
    return sourceValue(source.defaultValue, fbxProperty, seen, true);
  }
  if (allowPlainObjectPayload) {
    return { found: true, value: source };
  }
  return { found: false, value: undefined };
}

function customAnimationValue(keyframe, property) {
  const spec = customAnimationSpec(property);
  if (!spec) {
    return undefined;
  }
  const direct = keyframe.value ?? keyframe[property] ?? keyframe[spec.fbxProperty];
  if (direct != null) {
    const value = sourceValue(direct, spec.fbxProperty);
    if (value.found) {
      return spec.kind === "vectorComponent"
        ? componentValue(value.value, spec.componentIndex, 0)
        : value.value;
    }
    if (spec.kind === "vector" || spec.kind === "color") {
      return direct;
    }
  }
  const value = sourceValue(keyframe, spec.fbxProperty);
  if (!value.found) {
    return undefined;
  }
  return spec.kind === "vectorComponent"
    ? componentValue(value.value, spec.componentIndex, 0)
    : value.value;
}

export function customAnimationScalarKeyframeValue(keyframe, property) {
  const spec = customAnimationSpec(property);
  if (!spec || (spec.kind !== "scalar" && spec.kind !== "vectorComponent")) {
    return undefined;
  }
  return customAnimationValue(keyframe, property);
}

export function customAnimationVectorKeyframeValue(keyframe, property) {
  const spec = customAnimationSpec(property);
  if (!spec || (spec.kind !== "vector" && spec.kind !== "color")) {
    return undefined;
  }
  return customAnimationValue(keyframe, property);
}
