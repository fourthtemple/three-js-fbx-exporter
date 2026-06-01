import { finiteNumber, vector } from "./value-normalizers.js";

export const CUSTOM_MODEL_SCALAR_PREFIX = "customModelScalar:";
export const CUSTOM_MODEL_VECTOR_PREFIX = "customModelVector:";
export const CUSTOM_MODEL_COLOR_PREFIX = "customModelColor:";
export const CUSTOM_MODEL_VECTOR_COMPONENT_PREFIX = "customModelVectorComponent:";

function boolValue(value) {
  return value ? 1 : 0;
}

function explicitKind(property) {
  return String(property.kind || property.type || "").toLowerCase();
}

function isVectorLike(value) {
  return (Array.isArray(value) || ArrayBuffer.isView(value)) && value.length >= 3 ||
    Boolean(value && typeof value === "object" && (
      "x" in value || "y" in value || "z" in value ||
      "r" in value || "g" in value || "b" in value ||
      "u" in value || "v" in value || "w" in value
    ));
}

function inferredKind(property) {
  const value = property.value;
  if (typeof value === "string") {
    return "string";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (value && typeof value === "object" && ("r" in value || "g" in value || "b" in value)) {
    return "color";
  }
  if (isVectorLike(value)) {
    return "vector";
  }
  return "scalar";
}

function propertyKind(property) {
  const kind = explicitKind(property);
  if (["color", "colorrgb"].includes(kind)) {
    return "color";
  }
  if (["vector", "vector3", "vector3d"].includes(kind)) {
    return "vector";
  }
  if (["string", "kstring"].includes(kind)) {
    return "string";
  }
  if (["boolean", "bool"].includes(kind)) {
    return "boolean";
  }
  return inferredKind(property);
}

function customModelAnimationPrefix(kind) {
  if (kind === "color") {
    return CUSTOM_MODEL_COLOR_PREFIX;
  }
  if (kind === "vector") {
    return CUSTOM_MODEL_VECTOR_PREFIX;
  }
  return CUSTOM_MODEL_SCALAR_PREFIX;
}

export function customModelPropertyEntries(properties) {
  if (Array.isArray(properties)) {
    return properties;
  }
  if (!properties || typeof properties !== "object") {
    return [];
  }
  return Object.entries(properties).map(([name, value]) => {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !ArrayBuffer.isView(value) &&
      ("value" in value || "kind" in value || "type" in value || "animationProperty" in value)
    ) {
      return {
        name,
        ...value,
        value: Object.hasOwn(value, "value") ? value.value : value.defaultValue
      };
    }
    return { name, value };
  });
}

export function customModelAnimationProperty(kind, fbxProperty) {
  return `${customModelAnimationPrefix(kind)}${fbxProperty}`;
}

export function customModelVectorComponentAnimationProperty(fbxProperty, componentIndex) {
  return `${CUSTOM_MODEL_VECTOR_COMPONENT_PREFIX}${fbxProperty}:${componentIndex}`;
}

export function isCustomModelAnimationProperty(property) {
  return [
    CUSTOM_MODEL_SCALAR_PREFIX,
    CUSTOM_MODEL_VECTOR_PREFIX,
    CUSTOM_MODEL_COLOR_PREFIX,
    CUSTOM_MODEL_VECTOR_COMPONENT_PREFIX
  ].some((prefix) => String(property).startsWith(prefix));
}

export function isCustomModelScalarAnimationProperty(property) {
  const source = String(property);
  return source.startsWith(CUSTOM_MODEL_SCALAR_PREFIX) ||
    source.startsWith(CUSTOM_MODEL_VECTOR_COMPONENT_PREFIX);
}

export function customModelFbxProperty(property) {
  const source = String(property);
  if (source.startsWith(CUSTOM_MODEL_VECTOR_COMPONENT_PREFIX)) {
    const body = source.slice(CUSTOM_MODEL_VECTOR_COMPONENT_PREFIX.length);
    return body.slice(0, body.lastIndexOf(":"));
  }
  for (const prefix of [CUSTOM_MODEL_SCALAR_PREFIX, CUSTOM_MODEL_VECTOR_PREFIX, CUSTOM_MODEL_COLOR_PREFIX]) {
    if (source.startsWith(prefix)) {
      return source.slice(prefix.length);
    }
  }
  return source;
}

export function customModelAnimationKind(property) {
  const source = String(property);
  if (source.startsWith(CUSTOM_MODEL_COLOR_PREFIX)) {
    return "color";
  }
  if (source.startsWith(CUSTOM_MODEL_VECTOR_PREFIX)) {
    return "vector";
  }
  if (source.startsWith(CUSTOM_MODEL_VECTOR_COMPONENT_PREFIX)) {
    return "vectorComponent";
  }
  return "scalar";
}

export function customModelVectorComponentIndex(property) {
  const source = String(property);
  if (!source.startsWith(CUSTOM_MODEL_VECTOR_COMPONENT_PREFIX)) {
    return null;
  }
  const index = Number(source.slice(source.lastIndexOf(":") + 1));
  return Number.isInteger(index) && index >= 0 && index < 3 ? index : 0;
}

export function normalizeCustomModelProperties(properties = []) {
  return customModelPropertyEntries(properties)
    .filter((property) => property?.name)
    .map((property) => {
      const kind = propertyKind(property);
      const name = String(property.name);
      const value = property.value;
      const normalizedValue = kind === "color" || kind === "vector"
        ? vector(value, 3, [0, 0, 0])
        : kind === "boolean"
          ? boolValue(value)
          : kind === "string"
            ? String(value ?? "")
            : finiteNumber(value, 0);
      return {
        name,
        kind,
        value: normalizedValue,
        animationProperty: property.animationProperty || customModelAnimationProperty(kind, name)
      };
    });
}
