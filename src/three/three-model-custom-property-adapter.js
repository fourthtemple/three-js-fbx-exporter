import {
  customModelAnimationProperty,
  customModelVectorComponentAnimationProperty
} from "../model/model-custom-properties.js";
import {
  isCustomModelPropertyPath,
  parseCustomModelPropertyPath
} from "./three-model-custom-property-path.js";
import { threeTrackTargetName } from "./three-track-path.js";

const CUSTOM_COMPONENTS = Object.freeze({
  0: 0,
  1: 1,
  2: 2,
  r: 0,
  g: 1,
  b: 2,
  x: 0,
  y: 1,
  z: 2
});
const CUSTOM_PROPERTY_CONTAINERS = [
  "userData.customProperties",
  "userData.fbxCustomProperties",
  "userData.modelCustomProperties",
  "customProperties",
  "fbxCustomProperties",
  "modelCustomProperties"
];

function parseCustomComponentSuffix(suffix) {
  const match = suffix?.match(/^(?:\.([rgbxyzRGBXYZ])|\[([rgbxyzRGBXYZ012])\])$/);
  return match ? CUSTOM_COMPONENTS[(match[1] || match[2]).toLowerCase()] : null;
}

function trackValueSize(track) {
  if (typeof track.getValueSize === "function") {
    return track.getValueSize();
  }
  const times = track.times?.length || 1;
  const values = track.values?.length || 1;
  return Math.max(1, Math.floor(values / times));
}

function customModelPropertyKind(track) {
  const type = String(track.ValueTypeName || track.valueTypeName || "").toLowerCase();
  if (type.includes("color")) {
    return "color";
  }
  if (type.includes("vector") || trackValueSize(track) >= 3) {
    return "vector";
  }
  return "scalar";
}

function customModelTrackProperty(track, fbxProperty, component) {
  return component == null
    ? customModelAnimationProperty(customModelPropertyKind(track), fbxProperty)
    : customModelVectorComponentAnimationProperty(fbxProperty, component);
}

export function isThreeModelCustomLocalTrackName(text) {
  return isCustomModelPropertyPath(text);
}

export function parseThreeModelCustomTrackName(text) {
  const source = String(text);
  const match = CUSTOM_PROPERTY_CONTAINERS
    .map((container) => {
      const marker = `.${container}`;
      const index = source.indexOf(marker);
      return index > 0 ? { target: source.slice(0, index), path: source.slice(index + 1) } : null;
    })
    .find(Boolean);
  const customProperty = match ? parseCustomModelPropertyPath(match.path) : null;
  if (!customProperty) {
    return null;
  }
  return {
    target: threeTrackTargetName(match.target),
    binding: "modelCustomProperty",
    customProperty: customProperty.name,
    component: parseCustomComponentSuffix(customProperty.componentSuffix)
  };
}

export function convertThreeModelCustomTrack(parsed, track, context) {
  if (parsed.binding !== "modelCustomProperty") {
    return undefined;
  }
  if (context.targetNames && !context.targetNames.has(parsed.target)) {
    return null;
  }
  const isComponent = parsed.component != null;
  const valueSize = trackValueSize(track);
  return {
    target: parsed.target,
    property: customModelTrackProperty(track, parsed.customProperty, parsed.component),
    keyframes: isComponent
      ? valueSize > 1 ? context.vectorComponentKeyframes(track, parsed.component) : context.scalarKeyframes(track)
      : customModelPropertyKind(track) === "scalar"
        ? context.scalarKeyframes(track)
        : context.vectorKeyframes(track, "modelCustomProperty")
  };
}
