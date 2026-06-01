import { animationSamples, clipDurationSeconds } from "./three-animation-sampler.js";
import {
  threeClipBakeFrameRate,
  threeClipFrameRate,
  threeClipFrameWindow,
  threeClipLayer,
  threeClipLayers,
  threeClipPlaybackRate,
  threeClipSourceRange,
  threeTrackInterpolation,
  withTrackInterpolation
} from "./three-animation-metadata.js";
import { threeKeyframeMetadata } from "./three-animation-key-metadata.js";
import {
  convertThreeLightTrack,
  parseThreeLightTrackName
} from "./three-light-animation-adapter.js";
import {
  convertThreeMaterialTrack,
  isThreeMaterialLocalTrackName,
  parseThreeMaterialTrackName
} from "./three-material-animation-adapter.js";
import {
  convertThreeTextureTrack,
  isThreeTextureLocalTrackName,
  parseThreeTextureTrackName
} from "./three-texture-animation-adapter.js";
import { convertThreeModelMetadataTrack, isThreeModelMetadataLocalTrackName, parseThreeModelMetadataTrackName } from "./three-model-animation-adapter.js";
import { convertThreeModelCustomTrack, isThreeModelCustomLocalTrackName, parseThreeModelCustomTrackName } from "./three-model-custom-property-adapter.js";
import { createQuaternionComponentTrack, parseQuaternionComponentSuffix } from "./three-quaternion-component-track.js";
import { THREE_TRACK_TARGET_PATTERN, threeTrackTargetName } from "./three-track-path.js";
import { vectorSampleValue } from "./three-vector-sample.js";
import { decomposeTransformMatrix } from "../core/transform-decompose.js";
import { matrixFromQuaternion } from "../core/transform-matrix.js";

const RAD_TO_DEG = 180 / Math.PI;
const VECTOR_COMPONENT_PROPERTIES = Object.freeze({
  position: "translation",
  rotation: "rotation",
  scale: "scale"
});
const VECTOR_COMPONENT_AXES = Object.freeze({
  0: "X",
  1: "Y",
  2: "Z",
  x: "X",
  y: "Y",
  z: "Z"
});
const TARGET = THREE_TRACK_TARGET_PATTERN;

function parseComponentSuffix(suffix) {
  const match = suffix?.match(/^(?:\.([xyzXYZ])|\[([xyzXYZ012])\])$/);
  return match ? VECTOR_COMPONENT_AXES[(match[1] || match[2]).toLowerCase()] : null;
}

function componentTrackProperty(binding, axis) {
  const property = VECTOR_COMPONENT_PROPERTIES[binding];
  return property ? `${property}${axis}` : null;
}

function resolveParsedTarget(parsed, options) {
  if (!parsed?.target) return parsed;
  const target = options.trackTargetAliases?.get(parsed.target) || parsed.target;
  return target === parsed.target ? parsed : { ...parsed, target };
}

function isRootLocalTrackName(text) {
  return /^(?:position|rotation|scale)(?:(?:\.[xyzXYZ])|(?:\[[xyzXYZ012]\]))?$/.test(text) ||
    /^quaternion(?:(?:\.[xyzwXYZW])|(?:\[[xyzwXYZW0123]\]))?$/.test(text) ||
    /^matrix(?:\.elements)?$/.test(text) ||
    /^(?:visible|visibility)$/.test(text) ||
    /^morphTargetInfluences(?:\[[^\]]+\])?$/.test(text) ||
    /^(?:materials?(?:\[\d+\])?|map)\./.test(text) ||
    isThreeMaterialLocalTrackName(text) ||
    isThreeTextureLocalTrackName(text) ||
    isThreeModelMetadataLocalTrackName(text) ||
    isThreeModelCustomLocalTrackName(text) ||
    /^(?:fov|focalLength|focusDistance|dof\.focusDistance|zoom|orthoZoom|orthoScale|orthographicScale)$/.test(text) ||
    /^(?:color|intensity|distance|angle|penumbra|innerAngle|outerAngle|spotInnerAngle|spotOuterAngle)$/.test(text);
}

function trackNameForParsing(name, options) {
  const text = String(name);
  if (!options.rootTrackTarget) return text;
  if (text.startsWith(".")) return `${options.rootTrackTarget}${text}`;
  return isRootLocalTrackName(text) ? `${options.rootTrackTarget}.${text}` : text;
}

function parseTrackName(name, options = {}) {
  const text = String(name);
  const morphAllMatch = text.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.morphTargetInfluences$`));
  if (morphAllMatch) {
    return {
      target: threeTrackTargetName(morphAllMatch[1]),
      binding: "morphTargetInfluences"
    };
  }

  const morphMatch = text.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.morphTargetInfluences\\[([^\\]]+)\\]$`));
  if (morphMatch) {
    const morphKey = morphMatch[2];
    const morphIndex = Number(morphKey);
    return {
      target: threeTrackTargetName(morphMatch[1]),
      binding: "morphTargetInfluence",
      morphIndex: Number.isInteger(morphIndex) ? morphIndex : null,
      morphTarget: Number.isInteger(morphIndex) ? null : morphKey
    };
  }

  const directTargetOptions = { ...options, allowBareDirectTargets: true };
  const materialTrack = parseThreeMaterialTrackName(text, directTargetOptions);
  if (materialTrack) {
    return materialTrack;
  }
  const textureTrack = parseThreeTextureTrackName(text, directTargetOptions);
  if (textureTrack) {
    return textureTrack;
  }
  const modelMetadataTrack = parseThreeModelMetadataTrackName(text);
  if (modelMetadataTrack) return modelMetadataTrack;
  const modelCustomTrack = parseThreeModelCustomTrackName(text);
  if (modelCustomTrack) return modelCustomTrack;

  const visibilityMatch = text.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.(visible|visibility)$`));
  if (visibilityMatch) {
    return {
      target: threeTrackTargetName(visibilityMatch[1]),
      binding: "visibility"
    };
  }

  const cameraPropertyMatch = text.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.(fov|focalLength|focusDistance|dof\\.focusDistance|zoom|orthoZoom|orthoScale|orthographicScale)$`));
  if (cameraPropertyMatch) {
    return {
      target: threeTrackTargetName(cameraPropertyMatch[1]),
      binding: cameraPropertyMatch[2]
    };
  }

  const lightTrack = parseThreeLightTrackName(text);
  if (lightTrack) {
    return lightTrack;
  }

  const boneQuaternionComponentMatch = text.match(/(?:^|\.|\/|:)bones\[([^\]]+)\]\.quaternion((?:\.[xyzwXYZW])|(?:\[[xyzwXYZW0123]\]))$/);
  if (boneQuaternionComponentMatch) {
    return {
      target: boneQuaternionComponentMatch[1],
      binding: "quaternionComponent",
      component: parseQuaternionComponentSuffix(boneQuaternionComponentMatch[2])
    };
  }

  const boneComponentMatch = text.match(/(?:^|\.|\/|:)bones\[([^\]]+)\]\.(position|rotation|scale)((?:\.[xyzXYZ])|(?:\[[xyzXYZ012]\]))$/);
  if (boneComponentMatch) {
    return {
      target: boneComponentMatch[1],
      binding: `${boneComponentMatch[2]}Component`,
      component: parseComponentSuffix(boneComponentMatch[3])
    };
  }

  const boneMatrixMatch = text.match(/(?:^|\.|\/|:)bones\[([^\]]+)\]\.matrix(?:\.elements)?$/);
  if (boneMatrixMatch) {
    return {
      target: boneMatrixMatch[1],
      binding: "matrix"
    };
  }

  const boneMatch = text.match(/(?:^|\.|\/|:)bones\[([^\]]+)\]\.(position|quaternion|rotation|scale)$/);
  if (boneMatch) {
    return {
      target: boneMatch[1],
      binding: boneMatch[2]
    };
  }

  const objectQuaternionComponentMatch = text.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.quaternion((?:\\.[xyzwXYZW])|(?:\\[[xyzwXYZW0123]\\]))$`));
  if (objectQuaternionComponentMatch) {
    return {
      target: threeTrackTargetName(objectQuaternionComponentMatch[1]),
      binding: "quaternionComponent",
      component: parseQuaternionComponentSuffix(objectQuaternionComponentMatch[2])
    };
  }

  const objectComponentMatch = text.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.(position|rotation|scale)((?:\\.[xyzXYZ])|(?:\\[[xyzXYZ012]\\]))$`));
  if (objectComponentMatch) {
    return {
      target: threeTrackTargetName(objectComponentMatch[1]),
      binding: `${objectComponentMatch[2]}Component`,
      component: parseComponentSuffix(objectComponentMatch[3])
    };
  }

  const objectMatrixMatch = text.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.matrix(?:\\.elements)?$`));
  if (objectMatrixMatch) {
    return {
      target: threeTrackTargetName(objectMatrixMatch[1]),
      binding: "matrix"
    };
  }

  const objectMatch = text.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.(position|quaternion|rotation|scale)$`));
  if (objectMatch) {
    return {
      target: threeTrackTargetName(objectMatch[1]),
      binding: objectMatch[2]
    };
  }
  return null;
}

function quaternionToEulerDegrees(x, y, z, w, rotationOrder = "XYZ") {
  const transform = decomposeTransformMatrix(matrixFromQuaternion({ x, y, z, w }), { rotationOrder });
  return transform?.rotation || [0, 0, 0];
}

function vectorKeyframes(track, property, frameRate, duration, options) {
  const { times, values, size } = animationSamples(track, frameRate, duration, options);
  const zFallback = property === "scale" || property === "textureScale" ? 1 : 0;
  return times.map((time, index) => keyframeForTime(track, time, frameRate, options, {
    value: vectorSampleValue(values, size, index, zFallback)
  }));
}

function rotationKeyframes(track, frameRate, duration, options, target) {
  const { times, values, size } = animationSamples(track, frameRate, duration, options);
  if (size === 4 || String(track.ValueTypeName || "").toLowerCase().includes("quaternion")) {
    const rotationOrder = options.rotationOrdersByName?.get(target) || "XYZ";
    return times.map((time, index) => keyframeForTime(track, time, frameRate, options, {
      value: quaternionToEulerDegrees(
        values[index * size] ?? 0,
        values[index * size + 1] ?? 0,
        values[index * size + 2] ?? 0,
        values[index * size + 3] ?? 1,
        rotationOrder
      )
    }));
  }
  return vectorKeyframes(track, "rotation", frameRate, duration, options).map((keyframe) => ({
    ...keyframe,
    value: keyframe.value.map((radians) => radians * RAD_TO_DEG)
  }));
}

function scalarKeyframes(track, frameRate, duration, options) {
  const { times, values } = animationSamples(track, frameRate, duration, options);
  return times.map((time, index) => keyframeForTime(track, time, frameRate, options, {
    value: values[index] ?? 0
  }));
}

function vectorComponentKeyframes(track, frameRate, duration, options, componentIndex) {
  const { times, values, size } = animationSamples(track, frameRate, duration, options);
  return times.map((time, index) => keyframeForTime(track, time, frameRate, options, {
    value: size === 1
      ? values[index] ?? 0
      : values[index * size + componentIndex] ?? 0
  }));
}

function scalarKeyframesMapped(track, frameRate, duration, options, mapValue) {
  return scalarKeyframes(track, frameRate, duration, options).map((keyframe) => ({
    ...keyframe,
    value: mapValue(keyframe.value)
  }));
}

function rotationScalarKeyframes(track, frameRate, duration, options) {
  return scalarKeyframesMapped(track, frameRate, duration, options, (value) => value * RAD_TO_DEG);
}

function scalarZKeyframes(track, frameRate, duration, options) {
  return scalarKeyframes(track, frameRate, duration, options).map((keyframe) => ({
    ...keyframe,
    value: [0, 0, keyframe.value]
  }));
}

function matrixKeyframes(track, frameRate, duration, options) {
  const { times, values, size } = animationSamples(track, frameRate, duration, options);
  return times.map((time, index) => keyframeForTime(track, time, frameRate, options, {
    value: Array.from({ length: 9 }, (_, component) => values[index * size + component] ?? 0)
  }));
}

function transformMatrixSamples(track, frameRate, duration, target, options) {
  const { times, values, size } = animationSamples(track, frameRate, duration, options);
  const rotationOrder = options.rotationOrdersByName?.get(target) || "XYZ";
  return times.map((time, index) => {
    const matrix = Array.from({ length: 16 }, (_, component) => {
      const fallback = component % 5 === 0 ? 1 : 0;
      return values[index * size + component] ?? fallback;
    });
    return {
      frame: frameForTime(time, frameRate, options),
      metadata: threeKeyframeMetadata(track, time, options),
      transform: decomposeTransformMatrix(matrix, { rotationOrder })
    };
  }).filter((sample) => Boolean(sample.transform));
}

function transformMatrixTracks(parsed, track, frameRate, duration, options) {
  const samples = transformMatrixSamples(track, frameRate, duration, parsed.target, options);
  return [
    {
      target: parsed.target,
      property: "translation",
      keyframes: samples.map((sample) => ({ frame: sample.frame, ...sample.metadata, value: sample.transform.translation }))
    },
    {
      target: parsed.target,
      property: "rotation",
      keyframes: samples.map((sample) => ({ frame: sample.frame, ...sample.metadata, value: sample.transform.rotation }))
    },
    {
      target: parsed.target,
      property: "scale",
      keyframes: samples.map((sample) => ({ frame: sample.frame, ...sample.metadata, value: sample.transform.scale }))
    }
  ];
}

function focalLengthFromFov(fovDegrees, camera) {
  const filmHeight = camera?.filmHeight || 35;
  return filmHeight / (2 * Math.tan((fovDegrees * Math.PI / 180) / 2));
}

function frameForTime(time, frameRate, options) {
  const playbackRate = options.playbackRate || 1;
  const rate = Math.abs(playbackRate);
  const sourceTime = playbackRate < 0 ? Math.max(0, options.duration || 0) - time : time;
  const frameScale = Number.isFinite(options.frameScale) ? options.frameScale : frameRate / rate;
  return sourceTime * frameScale + (options.frameOffset || 0);
}
function keyframeForTime(track, time, frameRate, options, keyframe) {
  return { frame: frameForTime(time, frameRate, options), ...threeKeyframeMetadata(track, time, options), ...keyframe };
}

function convertTrack(track, frameRate, duration, targetNames, options = {}) {
  const parsed = resolveParsedTarget(parseTrackName(trackNameForParsing(track.name, options), options), options);
  if (!parsed) {
    return null;
  }

  const materialTrack = convertThreeMaterialTrack(parsed, track, {
    targetNames,
    options,
    scalarKeyframes: (source) => scalarKeyframes(source, frameRate, duration, options),
    scalarKeyframesMapped: (source, mapValue) => scalarKeyframesMapped(source, frameRate, duration, options, mapValue),
    vectorComponentKeyframes: (source, componentIndex) => vectorComponentKeyframes(source, frameRate, duration, options, componentIndex),
    vectorKeyframes: (source, property) => vectorKeyframes(source, property, frameRate, duration, options)
  });
  if (materialTrack !== undefined) {
    return materialTrack;
  }
  const textureTrack = convertThreeTextureTrack(parsed, track, {
    targetNames,
    options,
    scalarKeyframes: (source) => scalarKeyframes(source, frameRate, duration, options),
    scalarZKeyframes: (source) => scalarZKeyframes(source, frameRate, duration, options),
    matrixKeyframes: (source) => matrixKeyframes(source, frameRate, duration, options),
    vectorComponentKeyframes: (source, componentIndex) => vectorComponentKeyframes(source, frameRate, duration, options, componentIndex),
    vectorKeyframes: (source, property) => vectorKeyframes(source, property, frameRate, duration, options)
  });
  if (textureTrack !== undefined) {
    return textureTrack;
  }

  if (!targetNames.has(parsed.target)) {
    return null;
  }
  const modelMetadataTrack = convertThreeModelMetadataTrack(parsed, track, {
    scalarKeyframes: (source) => scalarKeyframes(source, frameRate, duration, options),
    vectorKeyframes: (source, property) => vectorKeyframes(source, property, frameRate, duration, options)
  });
  if (modelMetadataTrack !== undefined) return modelMetadataTrack;
  const modelCustomTrack = convertThreeModelCustomTrack(parsed, track, {
    scalarKeyframes: (source) => scalarKeyframes(source, frameRate, duration, options),
    vectorComponentKeyframes: (source, componentIndex) => vectorComponentKeyframes(source, frameRate, duration, options, componentIndex),
    vectorKeyframes: (source, property) => vectorKeyframes(source, property, frameRate, duration, options)
  });
  if (modelCustomTrack !== undefined) return modelCustomTrack;

  if (parsed.binding === "visibility") {
    return {
      target: parsed.target,
      property: "visibility",
      keyframes: scalarKeyframes(track, frameRate, duration, options)
    };
  }

  const lightTrack = convertThreeLightTrack(parsed, track, {
    options,
    scalarKeyframes: (source) => scalarKeyframes(source, frameRate, duration, options),
    scalarKeyframesMapped: (source, mapValue) => scalarKeyframesMapped(source, frameRate, duration, options, mapValue),
    vectorKeyframes: (source, property) => vectorKeyframes(source, property, frameRate, duration, options)
  });
  if (lightTrack !== undefined) {
    return lightTrack;
  }

  if (parsed.binding === "fov") {
    const camera = options.cameraParametersByName?.get(parsed.target);
    return {
      target: parsed.target,
      property: "cameraFocalLength",
      keyframes: scalarKeyframesMapped(track, frameRate, duration, options, (value) => focalLengthFromFov(value, camera))
    };
  }
  if (parsed.binding === "focalLength") {
    return {
      target: parsed.target,
      property: "cameraFocalLength",
      keyframes: scalarKeyframes(track, frameRate, duration, options)
    };
  }
  if (parsed.binding === "focusDistance" || parsed.binding === "dof.focusDistance") {
    return {
      target: parsed.target,
      property: "cameraFocusDistance",
      keyframes: scalarKeyframes(track, frameRate, duration, options)
    };
  }
  if (["zoom", "orthoZoom", "orthoScale", "orthographicScale"].includes(parsed.binding)) {
    const camera = options.cameraParametersByName?.get(parsed.target);
    return {
      target: parsed.target,
      property: "cameraOrthoZoom",
      keyframes: parsed.binding === "zoom" && camera?.orthographicHeight
        ? scalarKeyframesMapped(track, frameRate, duration, options, (value) => camera.orthographicHeight / (value || 1))
        : scalarKeyframes(track, frameRate, duration, options)
    };
  }

  if (parsed.binding === "morphTargetInfluence") {
    const names = options.morphTargetsByMesh?.get(parsed.target) || [];
    const morphTarget = parsed.morphTarget ?? names[parsed.morphIndex];
    if (!morphTarget) {
      return null;
    }
    return {
      target: parsed.target,
      property: "morph",
      morphTarget,
      keyframes: scalarKeyframes(track, frameRate, duration, options)
    };
  }
  if (parsed.binding === "morphTargetInfluences") {
    const names = options.morphTargetsByMesh?.get(parsed.target) || [];
    return names.map((morphTarget, index) => ({
      target: parsed.target,
      property: "morph",
      morphTarget,
      keyframes: vectorComponentKeyframes(track, frameRate, duration, options, index)
    }));
  }

  if (parsed.binding === "position") {
    return {
      target: parsed.target,
      property: "translation",
      keyframes: vectorKeyframes(track, "translation", frameRate, duration, options)
    };
  }
  if (parsed.binding === "matrix") {
    return transformMatrixTracks(parsed, track, frameRate, duration, options);
  }
  if (parsed.binding === "positionComponent" || parsed.binding === "rotationComponent" || parsed.binding === "scaleComponent") {
    const sourceBinding = parsed.binding.replace("Component", "");
    return {
      target: parsed.target,
      property: componentTrackProperty(sourceBinding, parsed.component),
      keyframes: parsed.binding === "rotationComponent"
        ? rotationScalarKeyframes(track, frameRate, duration, options)
        : scalarKeyframes(track, frameRate, duration, options)
    };
  }
  if (parsed.binding === "scale") {
    return {
      target: parsed.target,
      property: "scale",
      keyframes: vectorKeyframes(track, "scale", frameRate, duration, options)
    };
  }
  if (parsed.binding === "rotation" || parsed.binding === "quaternion") {
    return {
      target: parsed.target,
      property: "rotation",
      keyframes: rotationKeyframes(track, frameRate, duration, options, parsed.target)
    };
  }
  return null;
}

function quaternionDefaultForTarget(target, options) {
  return options.quaternionsByName?.get(target) || [0, 0, 0, 1];
}

function mergeQuaternionComponentTracks(tracks, targetNames, options) {
  const groups = new Map();
  const entries = [];
  for (const track of tracks) {
    const parsed = resolveParsedTarget(parseTrackName(trackNameForParsing(track.name, options), options), options);
    if (parsed?.binding !== "quaternionComponent" || parsed.component == null || !targetNames.has(parsed.target)) {
      entries.push(track);
      continue;
    }
    let group = groups.get(parsed.target);
    if (!group) {
      group = { target: parsed.target, components: [] };
      groups.set(parsed.target, group);
      entries.push(group);
    }
    group.components.push({ component: parsed.component, track });
  }
  return entries.map((entry) => {
    if (!entry.components) {
      return entry;
    }
    return createQuaternionComponentTrack(
      entry.target,
      entry.components,
      quaternionDefaultForTarget(entry.target, options)
    );
  });
}

function clipEntry(value, options) {
  return value?.clip
    ? {
        clip: value.clip,
        rootTrackTarget: value.rootTrackTarget ?? null
      }
    : {
        clip: value,
        rootTrackTarget: options.rootTrackTarget
      };
}

function convertSourceTracks(sourceTracks, frameRate, duration, targetNames, clipOptions) {
  return mergeQuaternionComponentTracks(sourceTracks, targetNames, clipOptions)
    .flatMap((track) => withTrackInterpolation(
      convertTrack(track, frameRate, duration, targetNames, clipOptions),
      threeTrackInterpolation(track, clipOptions)
    ))
    .filter(Boolean);
}

export function animationsFromThreeClips(clips = [], targetNames, options = {}) {
  const fallbackFrameRate = options.frameRate || 30;
  return clips.map((value, index) => {
    const { clip, rootTrackTarget } = clipEntry(value, options);
    const frameRate = threeClipFrameRate(clip, fallbackFrameRate);
    const duration = clipDurationSeconds(clip);
    const playbackRate = threeClipPlaybackRate(clip);
    const bakeFrameRate = threeClipBakeFrameRate(clip, options.bakeFrameRate);
    const sourceRange = threeClipSourceRange(clip, duration, frameRate);
    const exportDuration = sourceRange.trimmed ? sourceRange.duration : duration;
    const frameWindow = threeClipFrameWindow(clip, frameRate, exportDuration, { playbackRate });
    const clipOptions = {
      ...options,
      ...(bakeFrameRate ? { bakeFrameRate } : {}),
      rootTrackTarget,
      duration: exportDuration,
      frameOffset: frameWindow.frameOffset,
      frameScale: frameWindow.frameScale,
      playbackRate,
      ...(sourceRange.trimmed ? {
        sourceStartTime: sourceRange.startTime,
        sourceEndTime: sourceRange.endTime
      } : {})
    };
    const sourceLayers = threeClipLayers(clip);
    const layers = sourceLayers?.map((sourceLayer) => {
      const { tracks: sourceTracks, ...settings } = sourceLayer;
      return {
        ...settings,
        tracks: convertSourceTracks(sourceTracks, frameRate, duration, targetNames, clipOptions)
      };
    }).filter((layer) => layer.tracks.length);
    const tracks = layers
      ? layers.flatMap((layer) => layer.tracks)
      : convertSourceTracks(clip.tracks || [], frameRate, duration, targetNames, clipOptions);
    return {
      name: clip.name || `Clip_${index + 1}`,
      frameRate,
      startFrame: frameWindow.startFrame,
      endFrame: frameWindow.endFrame,
      layer: layers?.[0] || threeClipLayer(clip),
      ...(layers ? { layers } : {}),
      tracks
    };
  }).filter((clip) => clip.tracks.length);
}
