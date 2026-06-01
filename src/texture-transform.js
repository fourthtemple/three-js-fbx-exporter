import { firstField } from "./texture-source-fields.js";
import { vector } from "./value-normalizers.js";

const TEXTURE_MATRIX_KEYS = Object.freeze(["matrix", "transformMatrix", "uvMatrix"]);
const TEXTURE_TRANSLATION_KEYS = Object.freeze(["textureTranslation", "translation", "textureOffset", "offset"]);
const TEXTURE_ROTATION_KEYS = Object.freeze(["textureRotation", "rotation"]);
const TEXTURE_SCALE_KEYS = Object.freeze(["textureScale", "scale", "textureRepeat", "repeat"]);

function matrixElements(matrix) {
  const elements = matrix?.elements ?? matrix;
  if (!elements || elements.length < 9) {
    return null;
  }
  const values = Array.from(elements, (value) => Number(value));
  return values.every(Number.isFinite) ? values : null;
}

export function transformMode(transform, options = {}) {
  if (options.textureTransformMode !== "blender") {
    return transform;
  }
  return {
    ...transform,
    rotation: transform.rotation.map((value) => value === 0 ? 0 : -value),
    scale: transform.scale.map((value) => value === 0 ? 1 : 1 / value)
  };
}

export function textureTransformFromMatrix(matrix) {
  const elements = matrixElements(matrix);
  if (!elements) {
    return null;
  }

  const scaleX = Math.hypot(elements[0], elements[3]) || 1;
  const scaleY = Math.hypot(elements[1], elements[4]) || 1;
  const rotation = Math.atan2(elements[3], elements[0]);
  return {
    translation: [elements[6], elements[7], 0],
    rotation: [0, 0, rotation],
    scale: [scaleX, scaleY, 1],
    fromMatrix: true
  };
}

export function normalizeTextureRotation(value) {
  if (Number.isFinite(Number(value))) {
    return [0, 0, Number(value)];
  }
  return vector(value, 3, [0, 0, 0]);
}

function userDataTransformSources(texture = {}) {
  const userData = texture.userData || {};
  return [
    userData,
    userData.image,
    userData.source,
    userData.source?.data,
    userData.video,
    userData.media,
    userData.element,
    userData.mediaElement
  ];
}

function nestedTransformSources(texture = {}) {
  return [
    texture.image,
    texture.source,
    texture.source?.data,
    texture.video,
    texture.media,
    texture.element,
    texture.mediaElement
  ];
}

function directTextureMatrixValue(texture = {}) {
  return firstField([texture], ...TEXTURE_MATRIX_KEYS);
}

function userDataTextureMatrixValue(texture = {}) {
  return firstField(userDataTransformSources(texture), ...TEXTURE_MATRIX_KEYS);
}

function nestedTextureMatrixValue(texture = {}) {
  return firstField(nestedTransformSources(texture), ...TEXTURE_MATRIX_KEYS);
}

function textureMatrixValue(texture = {}, { preferUserData = false, preferNested = false } = {}) {
  const textureMatrix = directTextureMatrixValue(texture);
  const nestedMatrix = nestedTextureMatrixValue(texture);
  const directMatrix = preferNested ? nestedMatrix ?? textureMatrix : textureMatrix ?? nestedMatrix;
  const userMatrix = userDataTextureMatrixValue(texture);
  return preferUserData ? userMatrix ?? directMatrix : directMatrix ?? userMatrix;
}

function firstDefined(...values) {
  return values.find((value) => value != null);
}

function textureTransformField(source, keys) {
  return firstField(source, ...keys);
}

function textureTranslationValue(texture = {}, { preferUserData = false, preferNested = false } = {}) {
  const textureValue = textureTransformField([texture], TEXTURE_TRANSLATION_KEYS);
  const nestedTextureValue = textureTransformField(nestedTransformSources(texture), TEXTURE_TRANSLATION_KEYS);
  const directValue = preferNested ? firstDefined(nestedTextureValue, textureValue) : firstDefined(textureValue, nestedTextureValue);
  const userValue = textureTransformField(userDataTransformSources(texture), TEXTURE_TRANSLATION_KEYS);
  return preferUserData ? firstDefined(userValue, directValue) : firstDefined(directValue, userValue);
}

function textureRotationValue(texture = {}, { preferUserData = false, preferNested = false } = {}) {
  const textureValue = textureTransformField([texture], TEXTURE_ROTATION_KEYS);
  const nestedTextureValue = textureTransformField(nestedTransformSources(texture), TEXTURE_ROTATION_KEYS);
  const directValue = preferNested ? firstDefined(nestedTextureValue, textureValue) : firstDefined(textureValue, nestedTextureValue);
  const userValue = textureTransformField(userDataTransformSources(texture), TEXTURE_ROTATION_KEYS);
  return preferUserData ? firstDefined(userValue, directValue) : firstDefined(directValue, userValue);
}

function textureScaleValue(texture = {}, { preferUserData = false, preferNested = false } = {}) {
  const textureValue = textureTransformField([texture], TEXTURE_SCALE_KEYS);
  const nestedTextureValue = textureTransformField(nestedTransformSources(texture), TEXTURE_SCALE_KEYS);
  const directValue = preferNested ? firstDefined(nestedTextureValue, textureValue) : firstDefined(textureValue, nestedTextureValue);
  const userValue = textureTransformField(userDataTransformSources(texture), TEXTURE_SCALE_KEYS);
  return preferUserData ? firstDefined(userValue, directValue) : firstDefined(directValue, userValue);
}

export function normalizeTextureTransform(texture = {}, options = {}) {
  const matrixTransform = textureTransformFromMatrix(textureMatrixValue(texture));
  if (matrixTransform) {
    return transformMode(matrixTransform, options);
  }

  return transformMode({
    translation: vector(textureTranslationValue(texture), 3, [0, 0, 0]),
    rotation: normalizeTextureRotation(textureRotationValue(texture)),
    scale: vector(textureScaleValue(texture), 3, [1, 1, 1]),
    fromMatrix: false
  }, options);
}

export function textureTransformFromThreeTexture(texture) {
  const userData = texture?.userData || {};
  const userMatrix = userDataTextureMatrixValue(texture);
  const nestedMatrix = nestedTextureMatrixValue(texture);
  if (texture?.matrixAutoUpdate === false || userData.matrixAutoUpdate === false || userMatrix || nestedMatrix) {
    const matrixTransform = textureTransformFromMatrix(textureMatrixValue(texture, { preferUserData: true, preferNested: true }));
    if (matrixTransform) {
      return matrixTransform;
    }
  }
  return {
    translation: vector(textureTranslationValue(texture, { preferUserData: true, preferNested: true }), 3, [0, 0, 0]),
    rotation: normalizeTextureRotation(textureRotationValue(texture, { preferUserData: true, preferNested: true })),
    scale: vector(textureScaleValue(texture, { preferUserData: true, preferNested: true }), 3, [1, 1, 1]),
    fromMatrix: false
  };
}
