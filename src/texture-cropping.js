import { firstField, nestedTextureSources } from "./texture-source-fields.js";

const CROP_KEYS = Object.freeze(["left", "top", "right", "bottom"]);
const CROP_OBJECT_KEYS = Object.freeze(["cropping", "crop", "textureCropping", "textureCrop"]);

export function normalizeTextureCropping(source = {}) {
  const sources = cropSources(source);
  const explicit = firstField(sources, ...CROP_OBJECT_KEYS);
  if (Array.isArray(explicit)) {
    return cropFromArray(explicit);
  }
  if (explicit && typeof explicit === "object") {
    return cropFromObject(explicit);
  }
  return cropFromSources(sources);
}

export function cropValues(cropping) {
  const normalized = normalizeTextureCropping(cropping);
  return CROP_KEYS.map((key) => normalized[key]);
}

function cropFromArray(values) {
  return {
    left: normalizeTextureCropValue(values[0]),
    top: normalizeTextureCropValue(values[1]),
    right: normalizeTextureCropValue(values[2]),
    bottom: normalizeTextureCropValue(values[3])
  };
}

function cropFromObject(value) {
  return {
    left: normalizeTextureCropValue(firstDefined(value.left, value.l, value.cropLeft, value.croppingLeft)),
    top: normalizeTextureCropValue(firstDefined(value.top, value.t, value.cropTop, value.croppingTop)),
    right: normalizeTextureCropValue(firstDefined(value.right, value.r, value.cropRight, value.croppingRight)),
    bottom: normalizeTextureCropValue(firstDefined(value.bottom, value.b, value.cropBottom, value.croppingBottom))
  };
}

function cropFromSources(sources) {
  return cropFromObject({
    left: firstField(sources, "left", "l", "cropLeft", "croppingLeft"),
    top: firstField(sources, "top", "t", "cropTop", "croppingTop"),
    right: firstField(sources, "right", "r", "cropRight", "croppingRight"),
    bottom: firstField(sources, "bottom", "b", "cropBottom", "croppingBottom")
  });
}

function cropSources(source = {}) {
  return [source, source?.userData, ...nestedTextureSources(source)];
}

function firstDefined(...values) {
  return values.find((value) => value != null);
}

export function normalizeTextureCropValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}
