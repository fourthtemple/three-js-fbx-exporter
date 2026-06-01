import { RAD_TO_DEG } from "./three-transform-adapter.js";
import {
  THREE_TRACK_TARGET_PATTERN,
  threeTrackTargetName
} from "./three-track-path.js";

const TARGET = THREE_TRACK_TARGET_PATTERN;

export function parseThreeLightTrackName(text) {
  const match = String(text).match(new RegExp(
    `^${TARGET}(?:\\.[^.]+)*\\.(color|intensity|distance|angle|penumbra|innerAngle|outerAngle|spotInnerAngle|spotOuterAngle)$`
  ));
  if (!match) {
    return null;
  }
  return {
    target: threeTrackTargetName(match[1]),
    binding: `light.${match[2]}`
  };
}

export function convertThreeLightTrack(parsed, track, context) {
  if (!parsed.binding?.startsWith("light.")) {
    return undefined;
  }
  if (!context.options.lightNames?.has(parsed.target)) {
    return null;
  }

  if (parsed.binding === "light.color") {
    return {
      target: parsed.target,
      property: "lightColor",
      keyframes: context.vectorKeyframes(track, "lightColor")
    };
  }
  if (parsed.binding === "light.intensity") {
    return {
      target: parsed.target,
      property: "lightIntensity",
      keyframes: context.scalarKeyframes(track)
    };
  }
  if (parsed.binding === "light.distance") {
    return {
      target: parsed.target,
      property: "lightDistance",
      keyframes: context.scalarKeyframes(track)
    };
  }
  if (parsed.binding === "light.angle") {
    return {
      target: parsed.target,
      property: "lightOuterAngle",
      keyframes: context.scalarKeyframesMapped(track, (value) => value * RAD_TO_DEG)
    };
  }
  if (parsed.binding === "light.penumbra") {
    const light = context.options.lightParametersByName?.get(parsed.target);
    const outerAngle = light?.outerAngle ?? 45;
    return {
      target: parsed.target,
      property: "lightInnerAngle",
      keyframes: context.scalarKeyframesMapped(track, (value) => {
        const penumbra = Math.max(0, Math.min(1, value));
        return outerAngle * (1 - penumbra);
      })
    };
  }
  if (parsed.binding === "light.innerAngle" || parsed.binding === "light.spotInnerAngle") {
    return {
      target: parsed.target,
      property: "lightInnerAngle",
      keyframes: context.scalarKeyframes(track)
    };
  }
  if (parsed.binding === "light.outerAngle" || parsed.binding === "light.spotOuterAngle") {
    return {
      target: parsed.target,
      property: "lightOuterAngle",
      keyframes: context.scalarKeyframes(track)
    };
  }
  return null;
}
