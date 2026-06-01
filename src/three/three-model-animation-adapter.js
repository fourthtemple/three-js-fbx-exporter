import { normalizeModelAnimationProperty } from "../model/model-animation-normalizer.js";
import { threeTrackTargetName } from "./three-track-path.js";

const MODEL_METADATA_PROPERTIES = [
  "rotationOffset",
  "rotationPivot",
  "preRotation",
  "postRotation",
  "scalingOffset",
  "scalingPivot",
  "geometricTranslation",
  "geometricRotation",
  "geometricScaling",
  "geometricScale"
].join("|");
const COMPONENT_SUFFIX = "((?:\\.[xyzXYZ])|(?:\\[[xyzXYZ012]\\]))?";

function componentAxis(suffix) {
  const match = suffix?.match(/^(?:\.([xyzXYZ])|\[([xyzXYZ012])\])$/);
  return match ? (match[1] || match[2]).toUpperCase() : "";
}

function animationProperty(property, suffix = "") {
  return normalizeModelAnimationProperty(`${property}${componentAxis(suffix)}`);
}

export function isThreeModelMetadataLocalTrackName(text) {
  return new RegExp(`^(?:userData\\.)?(?:${MODEL_METADATA_PROPERTIES})${COMPONENT_SUFFIX}$`).test(String(text));
}

export function parseThreeModelMetadataTrackName(text) {
  const source = String(text);
  const userDataMatch = source.match(new RegExp(`^(.+)\\.userData\\.(${MODEL_METADATA_PROPERTIES})${COMPONENT_SUFFIX}$`));
  const directMatch = source.match(new RegExp(`^(.+)\\.(${MODEL_METADATA_PROPERTIES})${COMPONENT_SUFFIX}$`));
  const match = userDataMatch || directMatch;
  if (!match) {
    return null;
  }
  return {
    target: threeTrackTargetName(match[1]),
    binding: "modelMetadata",
    property: animationProperty(match[2], match[3]),
    component: Boolean(match[3])
  };
}

export function convertThreeModelMetadataTrack(parsed, track, context) {
  if (parsed.binding !== "modelMetadata") {
    return undefined;
  }
  return {
    target: parsed.target,
    property: parsed.property,
    keyframes: parsed.component
      ? context.scalarKeyframes(track)
      : context.vectorKeyframes(track, parsed.property)
  };
}
