import { normalizeTextureAlpha } from "./texture-alpha.js";
import { normalizeTextureBlendMode } from "./texture-metadata-normalizer.js";

const TEXTURE_LAYER_ALPHA_PREFIX = "textureLayerAlpha:";
const TEXTURE_LAYER_BLEND_MODE_PREFIX = "textureLayerBlendMode:";

const PROPERTY_ALIASES = new Map([
  ["layeralpha", "alpha"],
  ["texturelayeralpha", "alpha"],
  ["layeropacity", "alpha"],
  ["texturelayeropacity", "alpha"],
  ["layerblendmode", "blendMode"],
  ["texturelayerblendmode", "blendMode"]
]);

const VALUE_ALIASES = Object.freeze({
  alpha: ["alpha", "opacity", "layerAlpha", "textureLayerAlpha", "layerOpacity", "textureLayerOpacity"],
  blendMode: ["blendMode", "layerBlendMode", "textureLayerBlendMode"]
});

function normalizedIndex(index) {
  const number = Number(index);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function indexedProperty(kind, index) {
  const layerIndex = normalizedIndex(index);
  if (layerIndex == null) {
    return null;
  }
  return kind === "alpha"
    ? `${TEXTURE_LAYER_ALPHA_PREFIX}${layerIndex}`
    : `${TEXTURE_LAYER_BLEND_MODE_PREFIX}${layerIndex}`;
}

function parseTextureLayerProperty(property) {
  const text = String(property || "");
  const explicit = text.match(/^textureLayer(Alpha|BlendMode):(\d+)$/);
  if (explicit) {
    return {
      kind: explicit[1] === "Alpha" ? "alpha" : "blendMode",
      index: Number(explicit[2])
    };
  }
  const maya = text.match(/^Maya\|layer_(alpha|blend_mode)_(\d+)$/);
  if (maya) {
    return {
      kind: maya[1] === "alpha" ? "alpha" : "blendMode",
      index: Number(maya[2])
    };
  }
  const alias = text.match(/^([a-zA-Z]+)(?::|\.|\[)?(\d+)\]?$/);
  const kind = alias ? PROPERTY_ALIASES.get(alias[1].toLowerCase()) : null;
  return kind ? { kind, index: Number(alias[2]) } : null;
}

export function textureLayerAlphaAnimationProperty(index) {
  return indexedProperty("alpha", index);
}

export function textureLayerBlendModeAnimationProperty(index) {
  return indexedProperty("blendMode", index);
}

export function normalizeTextureLayerAnimationProperty(property) {
  const parsed = parseTextureLayerProperty(property);
  return parsed ? indexedProperty(parsed.kind, parsed.index) : null;
}

export function isTextureLayerAnimationProperty(property) {
  return normalizeTextureLayerAnimationProperty(property) === property;
}

export function isTextureLayerScalarAnimationProperty(property) {
  return isTextureLayerAnimationProperty(property);
}

export function textureLayerAnimationKind(property) {
  return parseTextureLayerProperty(property)?.kind || null;
}

export function textureLayerAnimationIndex(property) {
  return parseTextureLayerProperty(property)?.index ?? null;
}

export function textureLayerScalarKeyframeValue(keyframe, property) {
  const kind = textureLayerAnimationKind(property);
  if (!kind) {
    return null;
  }
  const direct = keyframe.value ?? keyframe[property];
  const value = (direct != null ? sourceValue(direct, kind) : null) ?? sourceValue(keyframe, kind);
  if (value == null) {
    return null;
  }
  return kind === "alpha" ? normalizeTextureAlpha(value) : normalizeTextureBlendMode(value);
}

function sourceValue(source, kind, seen = new Set()) {
  if (!source || typeof source !== "object" || Array.isArray(source) || ArrayBuffer.isView(source)) {
    return source;
  }
  if (seen.has(source)) {
    return undefined;
  }
  seen.add(source);
  for (const key of VALUE_ALIASES[kind] || []) {
    if (source[key] != null) {
      return sourceValue(source[key], kind, seen);
    }
  }
  const nested = source.value ?? source.defaultValue;
  if (nested != null && nested !== source) {
    return sourceValue(nested, kind, seen);
  }
  return undefined;
}
