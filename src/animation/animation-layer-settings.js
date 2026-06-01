import { finiteNumber, vector } from "../core/value-normalizers.js";

const DEFAULT_LAYER = Object.freeze({
  weight: 100,
  mute: false,
  solo: false,
  lock: false,
  color: [0.8, 0.8, 0.8],
  blendMode: 0,
  rotationAccumulationMode: 0,
  scaleAccumulationMode: 0
});

const BLEND_MODE_ALIASES = Object.freeze({
  normal: 0,
  override: 0,
  replace: 0,
  additive: 1,
  add: 1
});

const ACCUMULATION_MODE_ALIASES = Object.freeze({
  layer: 0,
  bylayer: 0,
  channel: 1,
  bychannel: 1
});

export function normalizeAnimationLayerSettings(clip = {}) {
  const layer = clip.layer || clip.animationLayer || {};
  return {
    name: firstDefined(layer.name, clip.layerName, clip.animationLayerName, clip.name, "AnimLayer"),
    weight: finiteNumber(firstDefined(layer.weight, clip.layerWeight, clip.animationLayerWeight, clip.weight), DEFAULT_LAYER.weight),
    mute: normalizeBool(firstDefined(layer.mute, layer.muted, clip.layerMute, clip.mute, clip.muted), DEFAULT_LAYER.mute),
    solo: normalizeBool(firstDefined(layer.solo, clip.layerSolo, clip.solo), DEFAULT_LAYER.solo),
    lock: normalizeBool(firstDefined(layer.lock, layer.locked, clip.layerLock, clip.lock, clip.locked), DEFAULT_LAYER.lock),
    color: vector(firstDefined(layer.color, clip.layerColor, clip.animationLayerColor, clip.color), 3, DEFAULT_LAYER.color),
    blendMode: normalizeEnum(firstDefined(layer.blendMode, clip.layerBlendMode, clip.blendMode), BLEND_MODE_ALIASES, DEFAULT_LAYER.blendMode),
    rotationAccumulationMode: normalizeEnum(
      firstDefined(layer.rotationAccumulationMode, clip.layerRotationAccumulationMode, clip.rotationAccumulationMode),
      ACCUMULATION_MODE_ALIASES,
      DEFAULT_LAYER.rotationAccumulationMode
    ),
    scaleAccumulationMode: normalizeEnum(
      firstDefined(layer.scaleAccumulationMode, clip.layerScaleAccumulationMode, clip.scaleAccumulationMode),
      ACCUMULATION_MODE_ALIASES,
      DEFAULT_LAYER.scaleAccumulationMode
    )
  };
}

function firstDefined(...values) {
  return values.find((value) => value != null);
}

function normalizeBool(value, fallback) {
  if (value == null) {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  const text = String(value).toLowerCase();
  if (["true", "yes", "on", "1"].includes(text)) {
    return true;
  }
  if (["false", "no", "off", "0"].includes(text)) {
    return false;
  }
  return fallback;
}

function normalizeEnum(value, aliases, fallback) {
  if (Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (value == null) {
    return fallback;
  }
  const text = String(value).toLowerCase().replace(/[\s_-]+/g, "");
  return aliases[text] ?? fallback;
}
