import { textureTransformFromMatrix } from "./texture-transform.js";

const TEXTURE_MATRIX_ANIMATION_ALIASES = Object.freeze({
  textureMatrix: "textureMatrix",
  textureTransformMatrix: "textureMatrix",
  transformMatrix: "textureMatrix",
  uvMatrix: "textureMatrix"
});

const TEXTURE_MATRIX_VALUE_ALIASES = Object.freeze([
  "textureMatrix",
  "textureTransformMatrix",
  "transformMatrix",
  "uvMatrix",
  "matrix"
]);

function textureMatrixProperty(property) {
  return TEXTURE_MATRIX_ANIMATION_ALIASES[property] || null;
}

function matrixValue(source) {
  if (!source || typeof source !== "object" || Array.isArray(source) || ArrayBuffer.isView(source)) {
    return source;
  }
  if (source.elements) {
    return source;
  }
  for (const key of TEXTURE_MATRIX_VALUE_ALIASES) {
    if (source[key] != null) {
      return source[key];
    }
  }
  const nested = source.value ?? source.defaultValue;
  return nested != null && nested !== source ? matrixValue(nested) : undefined;
}

function textureMatrixKeyframeValue(keyframe) {
  const transform = textureTransformFromMatrix(matrixValue(keyframe));
  if (!transform) {
    throw new Error("Texture matrix animation keyframes require 9 matrix values");
  }
  return transform;
}

function keyframeWithValue(keyframe, value) {
  return {
    ...keyframe,
    value
  };
}

function expandedTextureMatrixTrack(track, property, valueKey) {
  const keyframes = (track.keyframes || track.keys || []).map((keyframe) => {
    return keyframeWithValue(keyframe, textureMatrixKeyframeValue(keyframe)[valueKey]);
  });
  return {
    ...track,
    property,
    keyframes
  };
}

export function normalizeTextureMatrixAnimationProperty(property) {
  return textureMatrixProperty(property);
}

export function expandTextureMatrixAnimationTrack(track) {
  if (textureMatrixProperty(track.property || track.channel)) {
    return [
      expandedTextureMatrixTrack(track, "textureTranslation", "translation"),
      expandedTextureMatrixTrack(track, "textureRotation", "rotation"),
      expandedTextureMatrixTrack(track, "textureScale", "scale")
    ];
  }
  return [track];
}
