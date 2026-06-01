import { FBX_KTIME, frameToKtime } from "../core/fbx-values.js";

const CUSTOM_TIME_MODE = 14;
const FBX_FRAME_RATES = Object.freeze([
  [120, 1],
  [100, 2],
  [60, 3],
  [50, 4],
  [48, 5],
  [30, 6],
  [30 / 1.001, 9],
  [25, 10],
  [24, 11],
  [24 / 1.001, 13],
  [96, 15]
]);

function similarValues(a, b, epsilon = 1e-5) {
  if (a === b) {
    return true;
  }
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)) <= epsilon;
}

export function normalizeFrameRate(value, fallback = 30) {
  const frameRate = Number(value);
  return Number.isFinite(frameRate) && frameRate > 0 ? frameRate : fallback;
}

export function fbxTimeMode(frameRate) {
  const normalized = normalizeFrameRate(frameRate);
  for (const [referenceFrameRate, timeMode] of FBX_FRAME_RATES) {
    if (similarValues(normalized, referenceFrameRate)) {
      return {
        timeMode,
        customFrameRate: referenceFrameRate
      };
    }
  }
  return {
    timeMode: CUSTOM_TIME_MODE,
    customFrameRate: normalized
  };
}

function animationLayers(clip = {}) {
  return Array.isArray(clip.layers) ? clip.layers : [];
}

function animationTracks(clip = {}) {
  return [
    ...(Array.isArray(clip.tracks) ? clip.tracks : []),
    ...animationLayers(clip).flatMap((layer) => Array.isArray(layer?.tracks) ? layer.tracks : [])
  ];
}

function finiteFrame(value) {
  const frame = Number(value);
  return Number.isFinite(frame) ? frame : null;
}

export function animationClipFrameRange(clip = {}) {
  const keyFrames = animationTracks(clip).flatMap((track) => {
    return (track.keyframes || []).map((keyframe) => Number(keyframe.frame));
  }).filter(Number.isFinite);
  const explicitStarts = [
    finiteFrame(clip.startFrame),
    ...animationLayers(clip).map((layer) => finiteFrame(layer?.startFrame))
  ].filter(Number.isFinite);
  const explicitEnds = [
    finiteFrame(clip.endFrame),
    ...animationLayers(clip).map((layer) => finiteFrame(layer?.endFrame))
  ].filter(Number.isFinite);
  const startFrame = Math.min(
    explicitStarts.length ? Math.min(...explicitStarts) : Infinity,
    ...keyFrames
  );
  const endFrame = Math.max(
    explicitEnds.length ? Math.max(...explicitEnds) : -Infinity,
    ...keyFrames
  );
  return {
    startFrame: Number.isFinite(startFrame) ? startFrame : 0,
    endFrame: Number.isFinite(endFrame) ? endFrame : 0
  };
}

export function animationClipTimeSpan(clip = {}, fallbackFrameRate = 30) {
  const frameRate = normalizeFrameRate(clip.frameRate, fallbackFrameRate);
  const { startFrame, endFrame } = animationClipFrameRange(clip);
  return {
    startTime: frameToKtime(startFrame, frameRate),
    stopTime: frameToKtime(endFrame, frameRate)
  };
}

export function sceneTimeSpan(scene = {}) {
  const frameRate = normalizeFrameRate(scene.frameRate);
  const spans = (scene.animations || []).map((clip) => animationClipTimeSpan(clip, frameRate));
  if (!spans.length) {
    return {
      startTime: 0,
      stopTime: FBX_KTIME
    };
  }
  return {
    startTime: Math.min(...spans.map((span) => span.startTime)),
    stopTime: Math.max(...spans.map((span) => span.stopTime))
  };
}

export function globalTimeSettings(scene = {}) {
  const frameRate = normalizeFrameRate(scene.frameRate);
  return {
    frameRate,
    ...fbxTimeMode(frameRate),
    ...sceneTimeSpan(scene)
  };
}
