import { FBX_KTIME } from "../core/fbx-values.js";
import { normalizeTextureBoolean } from "./texture-metadata-normalizer.js";
import { normalizeVideoAccessMode } from "./texture-video.js";

export const TEXTURE_VIDEO_ANIMATION_PROPERTIES = Object.freeze({
  videoWidth: "width",
  videoHeight: "height",
  videoAccessMode: "accessMode",
  videoStartFrame: "startFrame",
  videoStopFrame: "stopFrame",
  videoOffset: "videoOffset",
  videoCurrentTime: "videoOffset",
  videoPlaySpeed: "playSpeed",
  videoFreeRunning: "freeRunning",
  videoLoop: "loop",
  videoInterlaceMode: "interlaceMode",
  videoImageSequence: "imageSequence",
  videoImageSequenceOffset: "imageSequenceOffset",
  videoFrameRate: "frameRate",
  videoLastFrame: "lastFrame"
});

const VIDEO_PROPERTY_ALIASES = Object.freeze({
  videoWidth: "videoWidth",
  width: "videoWidth",
  naturalWidth: "videoWidth",
  Width: "videoWidth",
  videoHeight: "videoHeight",
  height: "videoHeight",
  naturalHeight: "videoHeight",
  Height: "videoHeight",
  videoAccessMode: "videoAccessMode",
  accessMode: "videoAccessMode",
  AccessMode: "videoAccessMode",
  videoStartFrame: "videoStartFrame",
  startFrame: "videoStartFrame",
  sequenceStartFrame: "videoStartFrame",
  StartFrame: "videoStartFrame",
  videoStopFrame: "videoStopFrame",
  stopFrame: "videoStopFrame",
  sequenceStopFrame: "videoStopFrame",
  endFrame: "videoStopFrame",
  StopFrame: "videoStopFrame",
  videoOffset: "videoOffset",
  timeOffset: "videoOffset",
  sequenceTimeOffset: "videoOffset",
  Offset: "videoOffset",
  videoCurrentTime: "videoCurrentTime",
  currentTime: "videoCurrentTime",
  currentTimeSeconds: "videoCurrentTime",
  mediaCurrentTime: "videoCurrentTime",
  videoPlaySpeed: "videoPlaySpeed",
  playSpeed: "videoPlaySpeed",
  playbackRate: "videoPlaySpeed",
  PlaySpeed: "videoPlaySpeed",
  videoFreeRunning: "videoFreeRunning",
  freeRunning: "videoFreeRunning",
  FreeRunning: "videoFreeRunning",
  videoLoop: "videoLoop",
  loop: "videoLoop",
  Loop: "videoLoop",
  videoInterlaceMode: "videoInterlaceMode",
  interlaceMode: "videoInterlaceMode",
  InterlaceMode: "videoInterlaceMode",
  videoImageSequence: "videoImageSequence",
  imageSequence: "videoImageSequence",
  isImageSequence: "videoImageSequence",
  ImageSequence: "videoImageSequence",
  videoImageSequenceOffset: "videoImageSequenceOffset",
  imageSequenceOffset: "videoImageSequenceOffset",
  sequenceOffset: "videoImageSequenceOffset",
  currentFrame: "videoImageSequenceOffset",
  currentSequenceFrame: "videoImageSequenceOffset",
  sequenceFrame: "videoImageSequenceOffset",
  imageSequenceFrame: "videoImageSequenceOffset",
  frameIndex: "videoImageSequenceOffset",
  ImageSequenceOffset: "videoImageSequenceOffset",
  videoFrameRate: "videoFrameRate",
  frameRate: "videoFrameRate",
  sequenceFrameRate: "videoFrameRate",
  fps: "videoFrameRate",
  FrameRate: "videoFrameRate",
  videoLastFrame: "videoLastFrame",
  lastFrame: "videoLastFrame",
  sequenceLastFrame: "videoLastFrame",
  LastFrame: "videoLastFrame"
});

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0;
}

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function secondsToKtime(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * FBX_KTIME) : 0;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sourceValue(source, property) {
  if (!source || typeof source !== "object" || Array.isArray(source) || ArrayBuffer.isView(source)) {
    return source;
  }
  for (const [alias, normalizedProperty] of Object.entries(VIDEO_PROPERTY_ALIASES)) {
    if (normalizedProperty === property && source[alias] != null) {
      return source[alias];
    }
  }
  const nested = source.value ?? source.defaultValue;
  if (nested != null && nested !== source) {
    return sourceValue(nested, property);
  }
  return undefined;
}

export function normalizeTextureVideoAnimationProperty(property) {
  return VIDEO_PROPERTY_ALIASES[property] || null;
}

export function isTextureVideoAnimationProperty(property) {
  return Object.hasOwn(TEXTURE_VIDEO_ANIMATION_PROPERTIES, property);
}

export function normalizeTextureVideoScalarKeyValue(value, property) {
  if (!isTextureVideoAnimationProperty(property)) {
    return null;
  }
  if (property === "videoAccessMode") {
    return normalizeVideoAccessMode(value);
  }
  if (property === "videoPlaySpeed") {
    return finiteNumber(value);
  }
  if (property === "videoCurrentTime") {
    return secondsToKtime(value);
  }
  if (property === "videoFrameRate") {
    return nonNegativeNumber(value);
  }
  if (["videoFreeRunning", "videoLoop", "videoImageSequence"].includes(property)) {
    return normalizeTextureBoolean(value);
  }
  return nonNegativeInteger(value);
}

export function textureVideoScalarKeyframeValue(keyframe, property) {
  if (!isTextureVideoAnimationProperty(property)) {
    return null;
  }
  const direct = keyframe.value ?? keyframe[property];
  if (direct != null) {
    return normalizeTextureVideoScalarKeyValue(sourceValue(direct, property), property);
  }
  const field = TEXTURE_VIDEO_ANIMATION_PROPERTIES[property];
  if (field) {
    return normalizeTextureVideoScalarKeyValue(videoKeyframeValue(keyframe, property, field), property);
  }
  return null;
}

function videoKeyframeValue(keyframe, property, field) {
  return sourceValue(keyframe, property) ?? keyframe[field];
}
