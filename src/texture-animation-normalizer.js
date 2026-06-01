import { normalizeTextureAlphaSource } from "./texture-alpha.js";
import { componentValue } from "./component-value.js";
import { normalizeTextureCropValue } from "./texture-cropping.js";
import {
  normalizeTextureAnisotropy,
  normalizeTextureBlendMode,
  normalizeTextureBoolean,
  normalizeTextureColorSpace,
  normalizeTextureCompareFunction,
  normalizeTextureDimensionKind,
  normalizeTextureEncoding,
  normalizeTextureFilter,
  normalizeTextureFormat,
  normalizeTextureInternalFormatId,
  normalizeTextureMappingType,
  normalizeTexturePositiveInteger,
  normalizeTextureType,
  normalizeTextureTypeUse,
  normalizeTextureUnpackAlignment,
  textureWrapModeEnum
} from "./texture-metadata-normalizer.js";
import { vector } from "./value-normalizers.js";

export const TEXTURE_CROP_ANIMATION_PROPERTIES = Object.freeze({
  textureCropLeft: "left",
  textureCropTop: "top",
  textureCropRight: "right",
  textureCropBottom: "bottom"
});

export const TEXTURE_METADATA_ANIMATION_PROPERTIES = Object.freeze({
  textureWrapU: "wrapU",
  textureWrapV: "wrapV",
  textureWrapW: "wrapW",
  textureMappingType: "mappingType",
  textureBlendMode: "blendMode",
  textureTypeUse: "textureTypeUse",
  textureAlphaSource: "alphaSource",
  textureUseMipMap: "useMipMap",
  textureUvSwap: "uvSwap",
  texturePremultiplyAlpha: "premultiplyAlpha",
  textureColorSpace: "colorSpace",
  textureEncoding: "encoding",
  textureFlipY: "flipY",
  textureUnpackAlignment: "unpackAlignment",
  textureMinFilter: "minFilter",
  textureMagFilter: "magFilter",
  textureAnisotropy: "anisotropy",
  textureFormat: "format",
  textureType: "type",
  textureInternalFormatId: "internalFormatId",
  textureIsDepthTexture: "isDepthTexture",
  textureCompareFunction: "compareFunction",
  textureDimensionId: "textureDimensionId",
  textureDepth: "textureDepth",
  textureLayers: "textureLayers",
  textureIsDataTexture: "isDataTexture",
  textureIsCompressedTexture: "isCompressedTexture",
  textureIsTextureArray: "isTextureArray",
  textureMipmapCount: "mipmapCount",
  textureMatrixAutoUpdate: "matrixAutoUpdate"
});

export const TEXTURE_SCALAR_ANIMATION_PROPERTIES = new Set([
  "textureAlpha",
  ...Object.keys(TEXTURE_CROP_ANIMATION_PROPERTIES),
  ...Object.keys(TEXTURE_METADATA_ANIMATION_PROPERTIES)
]);

export const TEXTURE_VECTOR_ANIMATION_PROPERTIES = new Set([
  "textureTranslation",
  "textureRotation",
  "textureScale",
  "textureRotationPivot",
  "textureScalingPivot"
]);

const TEXTURE_VECTOR_COMPONENT_SPECS = Object.freeze({
  textureTranslationX: { vector: "textureTranslation", axis: 0 },
  textureTranslationY: { vector: "textureTranslation", axis: 1 },
  textureTranslationZ: { vector: "textureTranslation", axis: 2 },
  textureRotationX: { vector: "textureRotation", axis: 0 },
  textureRotationY: { vector: "textureRotation", axis: 1 },
  textureRotationZ: { vector: "textureRotation", axis: 2 },
  textureScaleX: { vector: "textureScale", axis: 0 },
  textureScaleY: { vector: "textureScale", axis: 1 },
  textureScaleZ: { vector: "textureScale", axis: 2 },
  textureRotationPivotX: { vector: "textureRotationPivot", axis: 0 },
  textureRotationPivotY: { vector: "textureRotationPivot", axis: 1 },
  textureRotationPivotZ: { vector: "textureRotationPivot", axis: 2 },
  textureScalingPivotX: { vector: "textureScalingPivot", axis: 0 },
  textureScalingPivotY: { vector: "textureScalingPivot", axis: 1 },
  textureScalingPivotZ: { vector: "textureScalingPivot", axis: 2 }
});

export const TEXTURE_VECTOR_COMPONENT_ANIMATION_PROPERTIES = new Set(Object.keys(TEXTURE_VECTOR_COMPONENT_SPECS));

export const TEXTURE_ANIMATION_PROPERTIES = new Set([
  ...TEXTURE_VECTOR_ANIMATION_PROPERTIES,
  ...TEXTURE_SCALAR_ANIMATION_PROPERTIES,
  ...TEXTURE_VECTOR_COMPONENT_ANIMATION_PROPERTIES
]);

const TEXTURE_PROPERTY_ALIASES = Object.freeze({
  textureTranslation: "textureTranslation",
  textureOffset: "textureTranslation",
  offset: "textureTranslation",
  textureTranslationX: "textureTranslationX",
  textureTranslationY: "textureTranslationY",
  textureTranslationZ: "textureTranslationZ",
  textureOffsetX: "textureTranslationX",
  textureOffsetY: "textureTranslationY",
  textureOffsetZ: "textureTranslationZ",
  offsetX: "textureTranslationX",
  offsetY: "textureTranslationY",
  offsetZ: "textureTranslationZ",
  textureRotation: "textureRotation",
  textureRotationX: "textureRotationX",
  textureRotationY: "textureRotationY",
  textureRotationZ: "textureRotationZ",
  textureScale: "textureScale",
  textureRepeat: "textureScale",
  repeat: "textureScale",
  textureScaleX: "textureScaleX",
  textureScaleY: "textureScaleY",
  textureScaleZ: "textureScaleZ",
  textureRepeatX: "textureScaleX",
  textureRepeatY: "textureScaleY",
  textureRepeatZ: "textureScaleZ",
  repeatX: "textureScaleX",
  repeatY: "textureScaleY",
  repeatZ: "textureScaleZ",
  textureRotationPivot: "textureRotationPivot",
  rotationPivot: "textureRotationPivot",
  textureRotationPivotX: "textureRotationPivotX",
  textureRotationPivotY: "textureRotationPivotY",
  textureRotationPivotZ: "textureRotationPivotZ",
  rotationPivotX: "textureRotationPivotX",
  rotationPivotY: "textureRotationPivotY",
  rotationPivotZ: "textureRotationPivotZ",
  textureScalingPivot: "textureScalingPivot",
  scalingPivot: "textureScalingPivot",
  textureScalingPivotX: "textureScalingPivotX",
  textureScalingPivotY: "textureScalingPivotY",
  textureScalingPivotZ: "textureScalingPivotZ",
  scalingPivotX: "textureScalingPivotX",
  scalingPivotY: "textureScalingPivotY",
  scalingPivotZ: "textureScalingPivotZ",
  textureAlpha: "textureAlpha",
  textureOpacity: "textureAlpha",
  textureBlendAlpha: "textureAlpha",
  "Texture alpha": "textureAlpha",
  textureCropLeft: "textureCropLeft",
  cropLeft: "textureCropLeft",
  croppingLeft: "textureCropLeft",
  CroppingLeft: "textureCropLeft",
  textureCropTop: "textureCropTop",
  cropTop: "textureCropTop",
  croppingTop: "textureCropTop",
  CroppingTop: "textureCropTop",
  textureCropRight: "textureCropRight",
  cropRight: "textureCropRight",
  croppingRight: "textureCropRight",
  CroppingRight: "textureCropRight",
  textureCropBottom: "textureCropBottom",
  cropBottom: "textureCropBottom",
  croppingBottom: "textureCropBottom",
  CroppingBottom: "textureCropBottom",
  textureWrapU: "textureWrapU",
  wrapU: "textureWrapU",
  wrapS: "textureWrapU",
  WrapModeU: "textureWrapU",
  textureWrapV: "textureWrapV",
  wrapV: "textureWrapV",
  wrapT: "textureWrapV",
  WrapModeV: "textureWrapV",
  textureWrapW: "textureWrapW",
  textureWrapR: "textureWrapW",
  wrapW: "textureWrapW",
  wrapR: "textureWrapW",
  WrapModeW: "textureWrapW",
  textureMappingType: "textureMappingType",
  mappingType: "textureMappingType",
  currentMappingType: "textureMappingType",
  CurrentMappingType: "textureMappingType",
  mapping: "textureMappingType",
  textureBlendMode: "textureBlendMode",
  blendMode: "textureBlendMode",
  currentTextureBlendMode: "textureBlendMode",
  CurrentTextureBlendMode: "textureBlendMode",
  textureTypeUse: "textureTypeUse",
  currentTextureTypeUse: "textureTypeUse",
  TextureTypeUse: "textureTypeUse",
  typeUse: "textureTypeUse",
  textureAlphaSource: "textureAlphaSource",
  alphaSource: "textureAlphaSource",
  currentAlphaSource: "textureAlphaSource",
  AlphaSource: "textureAlphaSource",
  textureUseMipMap: "textureUseMipMap",
  useMipMap: "textureUseMipMap",
  useMipMaps: "textureUseMipMap",
  useMipmaps: "textureUseMipMap",
  generateMipmaps: "textureUseMipMap",
  UseMipMap: "textureUseMipMap",
  textureUvSwap: "textureUvSwap",
  uvSwap: "textureUvSwap",
  swapUV: "textureUvSwap",
  UVSwap: "textureUvSwap",
  texturePremultiplyAlpha: "texturePremultiplyAlpha",
  premultiplyAlpha: "texturePremultiplyAlpha",
  preMultiplyAlpha: "texturePremultiplyAlpha",
  premultipliedAlpha: "texturePremultiplyAlpha",
  PremultiplyAlpha: "texturePremultiplyAlpha",
  textureColorSpace: "textureColorSpace",
  colorSpace: "textureColorSpace",
  colourSpace: "textureColorSpace",
  ColorSpace: "textureColorSpace",
  textureEncoding: "textureEncoding",
  encoding: "textureEncoding",
  Encoding: "textureEncoding",
  textureFlipY: "textureFlipY",
  flipY: "textureFlipY",
  FlipY: "textureFlipY",
  textureUnpackAlignment: "textureUnpackAlignment",
  unpackAlignment: "textureUnpackAlignment",
  UnpackAlignment: "textureUnpackAlignment",
  textureMinFilter: "textureMinFilter",
  minFilter: "textureMinFilter",
  MinFilter: "textureMinFilter",
  textureMagFilter: "textureMagFilter",
  magFilter: "textureMagFilter",
  MagFilter: "textureMagFilter",
  textureAnisotropy: "textureAnisotropy",
  textureFormat: "textureFormat",
  format: "textureFormat",
  Format: "textureFormat",
  textureType: "textureType",
  type: "textureType",
  Type: "textureType",
  textureInternalFormatId: "textureInternalFormatId",
  internalFormatId: "textureInternalFormatId",
  internalFormat: "textureInternalFormatId",
  InternalFormat: "textureInternalFormatId",
  textureIsDepthTexture: "textureIsDepthTexture",
  isDepthTexture: "textureIsDepthTexture",
  depthTexture: "textureIsDepthTexture",
  isDepthMap: "textureIsDepthTexture",
  IsDepthTexture: "textureIsDepthTexture",
  textureCompareFunction: "textureCompareFunction",
  compareFunction: "textureCompareFunction",
  compare: "textureCompareFunction",
  depthCompareFunction: "textureCompareFunction",
  CompareFunction: "textureCompareFunction",
  textureDimensionId: "textureDimensionId",
  textureDimension: "textureDimensionId",
  textureDimensionKind: "textureDimensionId",
  dimensionKind: "textureDimensionId",
  dimension: "textureDimensionId",
  TextureDimension: "textureDimensionId",
  textureDepth: "textureDepth",
  depth: "textureDepth",
  TextureDepth: "textureDepth",
  textureLayers: "textureLayers",
  layers: "textureLayers",
  layerCount: "textureLayers",
  TextureLayers: "textureLayers",
  textureIsDataTexture: "textureIsDataTexture",
  isDataTexture: "textureIsDataTexture",
  dataTexture: "textureIsDataTexture",
  IsDataTexture: "textureIsDataTexture",
  textureIsCompressedTexture: "textureIsCompressedTexture",
  isCompressedTexture: "textureIsCompressedTexture",
  compressedTexture: "textureIsCompressedTexture",
  IsCompressedTexture: "textureIsCompressedTexture",
  textureIsTextureArray: "textureIsTextureArray",
  isTextureArray: "textureIsTextureArray",
  textureArray: "textureIsTextureArray",
  IsTextureArray: "textureIsTextureArray",
  textureMipmapCount: "textureMipmapCount",
  mipmapCount: "textureMipmapCount",
  MipmapCount: "textureMipmapCount",
  textureMatrixAutoUpdate: "textureMatrixAutoUpdate",
  matrixAutoUpdate: "textureMatrixAutoUpdate",
  MatrixAutoUpdate: "textureMatrixAutoUpdate"
});

const TEXTURE_SCALAR_VALUE_ALIASES = Object.freeze({
  textureAlpha: ["alpha", "opacity", "textureOpacity"],
  textureCropLeft: ["left", "l", "cropLeft", "croppingLeft"],
  textureCropTop: ["top", "t", "cropTop", "croppingTop"],
  textureCropRight: ["right", "r", "cropRight", "croppingRight"],
  textureCropBottom: ["bottom", "b", "cropBottom", "croppingBottom"]
});

const TEXTURE_VECTOR_VALUE_ALIASES = Object.freeze({
  textureTranslation: ["textureTranslation", "textureOffset", "translation", "offset"],
  textureRotation: ["textureRotation", "rotation"],
  textureScale: ["textureScale", "textureRepeat", "scale", "repeat"],
  textureRotationPivot: ["textureRotationPivot", "rotationPivot", "center", "pivot"],
  textureScalingPivot: ["textureScalingPivot", "scalingPivot", "center", "pivot"]
});

function normalizeTextureRotationValue(value, options) {
  const normalized = Number.isFinite(Number(value))
    ? [0, 0, Number(value)]
    : vector(value, 3, [0, 0, 0]);
  if (options.textureTransformMode !== "blender") {
    return normalized;
  }
  return normalized.map((entry) => entry === 0 ? 0 : -entry);
}

function normalizeTextureScaleValue(value, options) {
  const normalized = vector(value, 3, [1, 1, 1]);
  if (options.textureTransformMode !== "blender") {
    return normalized;
  }
  return normalized.map((entry) => entry === 0 ? 1 : 1 / entry);
}

export function normalizeTextureAnimationProperty(property) {
  return TEXTURE_PROPERTY_ALIASES[property] || null;
}

export function isTextureAnimationProperty(property) {
  return TEXTURE_ANIMATION_PROPERTIES.has(property);
}

export function isTextureScalarAnimationProperty(property) {
  return TEXTURE_SCALAR_ANIMATION_PROPERTIES.has(property) || TEXTURE_VECTOR_COMPONENT_ANIMATION_PROPERTIES.has(property);
}

export function normalizeTextureAnimationKeyValue(value, property, options) {
  if (property === "textureRotation") {
    return normalizeTextureRotationValue(value, options);
  }
  if (property === "textureScale") {
    return normalizeTextureScaleValue(value, options);
  }
  return vector(value, 3, [0, 0, 0]);
}

export function textureVectorKeyframeValue(keyframe, property, sourceProperty = property) {
  if (!TEXTURE_VECTOR_ANIMATION_PROPERTIES.has(property)) {
    return undefined;
  }
  const direct = keyframe.value ?? keyframe[property] ?? keyframe[sourceProperty];
  const value = direct != null
    ? textureVectorSourceValue(direct, property, sourceProperty)
    : textureVectorSourceValue(keyframe, property, sourceProperty);
  return value;
}

export function normalizeTextureScalarKeyValue(value, property, options = {}) {
  if (TEXTURE_VECTOR_COMPONENT_ANIMATION_PROPERTIES.has(property)) {
    return normalizeTextureComponentKeyValue(value, property, options);
  }
  if (!TEXTURE_SCALAR_ANIMATION_PROPERTIES.has(property)) {
    return null;
  }
  if (TEXTURE_CROP_ANIMATION_PROPERTIES[property]) {
    return normalizeTextureCropValue(value);
  }
  if (property === "textureWrapU" || property === "textureWrapV" || property === "textureWrapW") {
    return textureWrapModeEnum(value);
  }
  if (property === "textureMappingType") {
    return normalizeTextureMappingType(value);
  }
  if (property === "textureBlendMode") {
    return normalizeTextureBlendMode(value);
  }
  if (property === "textureTypeUse") {
    return normalizeTextureTypeUse(value);
  }
  if (property === "textureAlphaSource") {
    return normalizeTextureAlphaSource(value);
  }
  if (["textureUseMipMap", "textureUvSwap", "texturePremultiplyAlpha"].includes(property)) {
    return normalizeTextureBoolean(value);
  }
  if (property === "textureColorSpace") {
    return normalizeTextureColorSpace(value);
  }
  if (property === "textureEncoding") {
    return normalizeTextureEncoding(value);
  }
  if (property === "textureFlipY") {
    return normalizeTextureBoolean(value);
  }
  if (property === "textureUnpackAlignment") {
    return normalizeTextureUnpackAlignment(value);
  }
  if (property === "textureMinFilter") {
    return normalizeTextureFilter(value, 1008);
  }
  if (property === "textureMagFilter") {
    return normalizeTextureFilter(value, 1006);
  }
  if (property === "textureAnisotropy") {
    return normalizeTextureAnisotropy(value);
  }
  if (property === "textureFormat") {
    return normalizeTextureFormat(value);
  }
  if (property === "textureType") {
    return normalizeTextureType(value);
  }
  if (property === "textureInternalFormatId") {
    return normalizeTextureInternalFormatId(value);
  }
  if (property === "textureIsDepthTexture") {
    return normalizeTextureBoolean(value);
  }
  if (property === "textureCompareFunction") {
    return normalizeTextureCompareFunction(value);
  }
  if (property === "textureDimensionId") {
    return normalizeTextureDimensionKind(value);
  }
  if (["textureDepth", "textureLayers", "textureMipmapCount"].includes(property)) {
    return normalizeTexturePositiveInteger(value);
  }
  if (["textureIsDataTexture", "textureIsCompressedTexture", "textureIsTextureArray"].includes(property)) {
    return normalizeTextureBoolean(value);
  }
  if (property === "textureMatrixAutoUpdate") {
    return normalizeTextureBoolean(value);
  }
  return value;
}

export function textureScalarKeyframeValue(keyframe, property, options = {}) {
  if (!isTextureScalarAnimationProperty(property)) {
    return null;
  }
  const direct = keyframe.value ?? keyframe[property];
  if (direct != null) {
    const value = textureScalarSourceValue(direct, property) ?? textureScalarSourceValue(keyframe, property);
    return value != null ? normalizeTextureScalarKeyValue(value, property, options) : null;
  }
  const value = textureScalarSourceValue(keyframe, property);
  if (value != null) {
    return normalizeTextureScalarKeyValue(value, property, options);
  }
  const cropField = TEXTURE_CROP_ANIMATION_PROPERTIES[property];
  if (cropField) {
    return normalizeTextureCropValue(
      keyframe[cropField] ??
      keyframe[`crop${cropField[0].toUpperCase()}${cropField.slice(1)}`] ??
      keyframe[`cropping${cropField[0].toUpperCase()}${cropField.slice(1)}`]
    );
  }
  return null;
}

function textureScalarSourceValue(source, property) {
  if (TEXTURE_VECTOR_COMPONENT_ANIMATION_PROPERTIES.has(property)) {
    return textureComponentSourceValue(source, property);
  }
  if (!source || typeof source !== "object" || Array.isArray(source) || ArrayBuffer.isView(source)) {
    return source;
  }
  for (const key of TEXTURE_SCALAR_VALUE_ALIASES[property] || []) {
    if (source[key] != null) {
      return source[key];
    }
  }
  for (const [alias, normalizedProperty] of Object.entries(TEXTURE_PROPERTY_ALIASES)) {
    if (normalizedProperty === property && source[alias] != null) {
      return source[alias];
    }
  }
  const nested = source.value ?? source.defaultValue;
  if (nested != null && nested !== source) {
    return textureScalarSourceValue(nested, property);
  }
  return undefined;
}

function textureVectorSourceValue(source, property, sourceProperty = property) {
  if (!source || typeof source !== "object" || Array.isArray(source) || ArrayBuffer.isView(source)) {
    return source;
  }
  const aliases = sourceProperty !== property
    ? [sourceProperty, ...(TEXTURE_VECTOR_VALUE_ALIASES[property] || [])]
    : TEXTURE_VECTOR_VALUE_ALIASES[property] || [];
  for (const key of aliases) {
    if (source[key] != null) {
      return source[key];
    }
  }
  const nested = source.value ?? source.defaultValue;
  if (nested != null && nested !== source) {
    return textureVectorSourceValue(nested, property, sourceProperty);
  }
  if ("x" in source || "y" in source || "z" in source || "u" in source || "v" in source || "w" in source) {
    return source;
  }
  return undefined;
}

function textureComponentSourceValue(source, property) {
  const spec = TEXTURE_VECTOR_COMPONENT_SPECS[property];
  const fallback = componentFallback(property);
  if (!source || typeof source !== "object" || Array.isArray(source) || ArrayBuffer.isView(source)) {
    return componentValue(source, spec?.axis ?? 0, fallback);
  }
  for (const [alias, normalizedProperty] of Object.entries(TEXTURE_PROPERTY_ALIASES)) {
    if (normalizedProperty === property && source[alias] != null) {
      return source[alias];
    }
  }
  for (const key of TEXTURE_VECTOR_VALUE_ALIASES[spec?.vector] || []) {
    if (source[key] != null) {
      return componentValue(source[key], spec?.axis ?? 0, fallback);
    }
  }
  const nested = source.value ?? source.defaultValue;
  if (nested != null && nested !== source) {
    return textureComponentSourceValue(nested, property);
  }
  return componentValue(source, spec?.axis ?? 0, undefined);
}

function normalizeTextureComponentKeyValue(value, property, options) {
  const spec = TEXTURE_VECTOR_COMPONENT_SPECS[property];
  const fallback = componentFallback(property);
  const number = Number(componentValue(value, spec?.axis ?? 0, fallback));
  const scalar = Number.isFinite(number) ? number : fallback;
  if (options.textureTransformMode !== "blender") {
    return scalar;
  }
  if (spec?.vector === "textureRotation") {
    return scalar === 0 ? 0 : -scalar;
  }
  if (spec?.vector === "textureScale") {
    return scalar === 0 ? 1 : 1 / scalar;
  }
  return scalar;
}

function componentFallback(property) {
  return TEXTURE_VECTOR_COMPONENT_SPECS[property]?.vector === "textureScale" ? 1 : 0;
}
