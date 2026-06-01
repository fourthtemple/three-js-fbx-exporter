import { FBX_KTIME } from "../core/fbx-values.js";

function objectValue(value) {
  return value && typeof value === "object" && !ArrayBuffer.isView(value) ? value : {};
}

function firstValue(sources, keys) {
  for (const source of sources) {
    for (const key of keys) {
      if (source?.[key] != null) {
        return source[key];
      }
    }
  }
  return undefined;
}

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : fallback;
}

function positiveInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function derivedFrameCount(duration, frameRate) {
  return duration > 0 && frameRate > 0 ? Math.round(duration * frameRate) : 0;
}

function secondsToKtime(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * FBX_KTIME) : 0;
}

function videoOffsetValue(sources) {
  const explicit = firstValue(sources, ["videoOffset", "timeOffset", "sequenceTimeOffset"]);
  return explicit == null
    ? secondsToKtime(firstValue(sources, ["currentTime", "currentTimeSeconds", "mediaCurrentTime", "videoCurrentTime"]))
    : nonNegativeInteger(explicit);
}

export function normalizeVideoAccessMode(value, hasContent = false) {
  if (Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (value == null) {
    return hasContent ? 1 : 0;
  }
  const text = String(value).toLowerCase();
  if (text.includes("mem") || text.includes("embed") || text.includes("pack")) {
    return 1;
  }
  if (text.includes("async")) {
    return 2;
  }
  if (text.includes("disk") || text.includes("file")) {
    return 0;
  }
  return hasContent ? 1 : 0;
}

export function normalizeTextureVideo(source = {}, hasContent = false) {
  const base = objectValue(source);
  const userData = objectValue(base.userData);
  const video = objectValue(base.video ?? base.media);
  const sequence = objectValue(base.imageSequence ?? base.sequence ?? base.videoSequence);
  const userVideo = objectValue(userData.video ?? userData.media);
  const userSequence = objectValue(userData.imageSequence ?? userData.sequence ?? userData.videoSequence);
  const userImage = objectValue(userData.image);
  const userSource = objectValue(userData.source);
  const userSourceData = objectValue(userData.source?.data);
  const userElement = objectValue(userData.element);
  const userMediaElement = objectValue(userData.mediaElement);
  const sourceOwner = objectValue(base.source);
  const imageOwner = objectValue(base.image);
  const sourceDataOwner = objectValue(base.source?.data);
  const elementOwner = objectValue(base.element);
  const mediaElementOwner = objectValue(base.mediaElement);
  const sources = [
    userData,
    userVideo,
    userSequence,
    userImage,
    userSource,
    userSourceData,
    userElement,
    userMediaElement,
    base,
    video,
    sequence,
    sourceOwner,
    imageOwner,
    sourceDataOwner,
    elementOwner,
    mediaElementOwner
  ];
  const explicitSequence = firstValue(sources, ["imageSequence", "sequence", "isImageSequence"]);
  const frameRate = Math.max(0, finiteNumber(firstValue(sources, ["frameRate", "sequenceFrameRate", "fps"]), 0));
  const duration = positiveNumber(firstValue(sources, ["duration", "videoDuration", "mediaDuration", "durationSeconds"]));
  const frameCount = positiveInteger(
    firstValue(sources, ["frameCount", "videoFrameCount", "sequenceFrameCount", "totalFrames", "frames"]),
    derivedFrameCount(duration, frameRate)
  );
  return {
    accessMode: normalizeVideoAccessMode(firstValue(sources, ["accessMode", "videoAccessMode"]), hasContent),
    startFrame: nonNegativeInteger(firstValue(sources, ["startFrame", "videoStartFrame", "sequenceStartFrame"])),
    stopFrame: nonNegativeInteger(firstValue(sources, ["stopFrame", "videoStopFrame", "sequenceStopFrame", "endFrame"]), frameCount),
    videoOffset: videoOffsetValue(sources),
    playSpeed: finiteNumber(firstValue(sources, ["playSpeed", "videoPlaySpeed", "playbackRate"]), 0),
    freeRunning: Boolean(firstValue(sources, ["freeRunning", "videoFreeRunning"])),
    loop: Boolean(firstValue(sources, ["loop", "videoLoop"])),
    interlaceMode: nonNegativeInteger(firstValue(sources, ["interlaceMode", "videoInterlaceMode"])),
    imageSequence: Boolean(explicitSequence && typeof explicitSequence === "object" ? true : explicitSequence),
    imageSequenceOffset: nonNegativeInteger(firstValue(sources, [
      "imageSequenceOffset",
      "sequenceOffset",
      "currentFrame",
      "currentSequenceFrame",
      "sequenceFrame",
      "imageSequenceFrame",
      "frameIndex"
    ])),
    frameRate,
    lastFrame: nonNegativeInteger(firstValue(sources, ["lastFrame", "sequenceLastFrame"]), frameCount),
    ...(duration > 0 ? { duration } : {}),
    ...(frameCount > 0 ? { frameCount } : {})
  };
}
