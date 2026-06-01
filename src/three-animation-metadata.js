const THREE_INTERPOLATE_DISCRETE = 2300;
const THREE_INTERPOLATE_LINEAR = 2301;
const THREE_INTERPOLATE_SMOOTH = 2302;
const THREE_NORMAL_ANIMATION_BLEND_MODE = 2500;
const THREE_ADDITIVE_ANIMATION_BLEND_MODE = 2501;

function positiveNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) {
      return number;
    }
  }
  return null;
}

function nonZeroNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number !== 0) {
      return number;
    }
  }
  return null;
}

function finiteNumber(...values) {
  for (const value of values) {
    if (value == null) {
      continue;
    }
    const number = Number(value);
    if (Number.isFinite(number)) {
      return number;
    }
  }
  return null;
}

function frameFromSeconds(seconds, frameRate) {
  const value = Number(seconds);
  return Number.isFinite(value) ? value * frameRate : null;
}

function secondsFromFrame(frame, frameRate) {
  const value = Number(frame);
  return Number.isFinite(value) && frameRate > 0 ? value / frameRate : null;
}

export function threeClipFrameRate(clip, fallbackFrameRate = 30) {
  const data = clip.userData || {};
  return positiveNumber(
    data.frameRate,
    data.fps,
    data.exportFrameRate,
    clip.frameRate,
    clip.fps,
    fallbackFrameRate,
    30
  );
}

export function threeClipPlaybackRate(clip) {
  const data = clip.userData || {};
  return nonZeroNumber(
    data.timeScale,
    data.playbackRate,
    data.playSpeed,
    data.speed,
    data.exportTimeScale,
    clip.timeScale,
    clip.playbackRate,
    clip.playSpeed,
    clip.speed,
    1
  );
}

export function threeClipBakeFrameRate(clip, fallbackBakeFrameRate = null) {
  const data = clip.userData || {};
  return positiveNumber(
    data.bakeFrameRate,
    data.bakeSampleRate,
    data.sampleFrameRate,
    data.sampleRate,
    data.resampleFrameRate,
    data.resampleRate,
    clip.bakeFrameRate,
    clip.bakeSampleRate,
    clip.sampleFrameRate,
    clip.sampleRate,
    clip.resampleFrameRate,
    clip.resampleRate,
    fallbackBakeFrameRate
  );
}

export function threeClipSourceRange(clip, duration, frameRate) {
  const data = clip.userData || {};
  const explicitStart = finiteNumber(
    data.sourceStartTime,
    data.sourceStart,
    data.trimStartTime,
    data.trimStart,
    clip.sourceStartTime,
    clip.sourceStart,
    clip.trimStartTime,
    clip.trimStart,
    secondsFromFrame(data.sourceStartFrame, frameRate),
    secondsFromFrame(data.trimStartFrame, frameRate),
    secondsFromFrame(clip.sourceStartFrame, frameRate)
  );
  const explicitEnd = finiteNumber(
    data.sourceEndTime,
    data.sourceEnd,
    data.trimEndTime,
    data.trimEnd,
    clip.sourceEndTime,
    clip.sourceEnd,
    clip.trimEndTime,
    clip.trimEnd,
    secondsFromFrame(data.sourceEndFrame, frameRate),
    secondsFromFrame(data.trimEndFrame, frameRate),
    secondsFromFrame(clip.sourceEndFrame, frameRate)
  );
  const startTime = Math.max(0, explicitStart ?? 0);
  const endTime = Math.max(startTime, explicitEnd ?? duration);
  return {
    startTime,
    endTime,
    duration: Math.max(0, endTime - startTime),
    trimmed: explicitStart != null || explicitEnd != null
  };
}

export function threeClipFrameWindow(clip, frameRate, duration, options = {}) {
  const data = clip.userData || {};
  const playbackRate = Math.abs(nonZeroNumber(options.playbackRate, 1));
  const startFrame = finiteNumber(
    data.startFrame,
    data.frameStart,
    data.inFrame,
    clip.startFrame,
    clip.frameStart,
    frameFromSeconds(data.startTime, frameRate),
    frameFromSeconds(data.inTime, frameRate),
    frameFromSeconds(clip.startTime, frameRate)
  );
  const frameOffset = finiteNumber(
    data.frameOffset,
    data.offsetFrame,
    clip.frameOffset,
    clip.offsetFrame,
    frameFromSeconds(data.timeOffset, frameRate),
    frameFromSeconds(data.offsetTime, frameRate),
    frameFromSeconds(clip.timeOffset, frameRate),
    startFrame,
    0
  );
  const defaultEndFrame = frameOffset + duration * frameRate / playbackRate;
  const explicitEndFrame = finiteNumber(
    data.endFrame,
    data.stopFrame,
    data.frameEnd,
    data.outFrame,
    clip.endFrame,
    clip.stopFrame,
    clip.frameEnd,
    frameFromSeconds(data.endTime, frameRate),
    frameFromSeconds(data.stopTime, frameRate),
    frameFromSeconds(data.outTime, frameRate),
    frameFromSeconds(clip.endTime, frameRate)
  );
  const endFrame = explicitEndFrame ?? defaultEndFrame;
  const boundedEndFrame = Math.max(endFrame, startFrame ?? frameOffset);
  return {
    frameOffset,
    startFrame: startFrame ?? frameOffset,
    endFrame: boundedEndFrame,
    frameScale: duration > 0 ? Math.max(0, boundedEndFrame - frameOffset) / duration : frameRate / playbackRate
  };
}

export function threeClipLayer(clip) {
  const data = clip.userData || {};
  return data.layer || data.animationLayer
    ? layerWithThreeBlendMode(data.layer || data.animationLayer, clip, data)
    : {
        name: data.layerName,
        weight: data.layerWeight,
        mute: data.layerMute,
        solo: data.layerSolo,
        lock: data.layerLock,
        color: data.layerColor,
        blendMode: threeLayerBlendMode(
          data.layerBlendMode,
          data.blendMode,
          data.animationBlendMode,
          clip.layerBlendMode,
          clip.blendMode
        ),
        rotationAccumulationMode: data.layerRotationAccumulationMode,
        scaleAccumulationMode: data.layerScaleAccumulationMode
      };
}

function firstArray(...values) {
  return values.find(Array.isArray) || null;
}

function referenceList(...values) {
  const value = values.find((candidate) => candidate != null);
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function layerTrackReference(reference, clipTracks) {
  if (typeof reference === "string") {
    return clipTracks.filter((track) => track.name === reference);
  }
  if (Number.isInteger(reference)) {
    return clipTracks[reference] ? [clipTracks[reference]] : [];
  }
  return reference?.name ? [reference] : [];
}

function layerTracks(layer, clipTracks) {
  const explicit = firstArray(layer.tracks, layer.animationTracks);
  if (explicit) {
    return explicit.flatMap((reference) => layerTrackReference(reference, clipTracks));
  }
  return [
    ...referenceList(layer.trackNames, layer.trackName),
    ...referenceList(layer.trackIndices, layer.trackIndex)
  ].flatMap((reference) => layerTrackReference(reference, clipTracks));
}

export function threeClipLayers(clip) {
  const data = clip.userData || {};
  const layers = firstArray(data.layers, data.animationLayers, clip.layers, clip.animationLayers);
  if (!layers?.length) {
    return null;
  }
  return layers.map((layer, index) => {
    const source = typeof layer === "string" ? { name: layer } : layer || {};
    return {
      ...layerWithThreeBlendMode({
        name: source.name ?? source.layerName ?? source.animationLayerName ?? `${clip.name || "Clip"}Layer_${index + 1}`,
        weight: source.weight ?? source.layerWeight ?? source.animationLayerWeight,
        mute: source.mute ?? source.layerMute,
        solo: source.solo ?? source.layerSolo,
        lock: source.lock ?? source.layerLock,
        color: source.color ?? source.layerColor,
        blendMode: source.blendMode ?? source.layerBlendMode ?? source.animationBlendMode,
        rotationAccumulationMode: source.rotationAccumulationMode ?? source.layerRotationAccumulationMode,
        scaleAccumulationMode: source.scaleAccumulationMode ?? source.layerScaleAccumulationMode
      }, clip, data),
      tracks: layerTracks(source, clip.tracks || [])
    };
  }).filter((layer) => layer.tracks.length);
}

function layerWithThreeBlendMode(layer, clip, data) {
  return {
    ...layer,
    blendMode: threeLayerBlendMode(
      layer.blendMode,
      layer.animationBlendMode,
      data.layerBlendMode,
      data.blendMode,
      data.animationBlendMode,
      clip.layerBlendMode,
      clip.blendMode
    )
  };
}

function threeLayerBlendMode(...values) {
  for (const value of values) {
    if (value == null) {
      continue;
    }
    const number = Number(value);
    if (number === THREE_ADDITIVE_ANIMATION_BLEND_MODE) {
      return "additive";
    }
    if (number === THREE_NORMAL_ANIMATION_BLEND_MODE) {
      return "normal";
    }
    return value;
  }
  return undefined;
}

export function threeTrackInterpolation(track, options) {
  if (options.bakeAnimations !== false) {
    return "linear";
  }
  const interpolation = track.getInterpolation?.();
  if (interpolation === THREE_INTERPOLATE_DISCRETE) {
    return "constant";
  }
  if (interpolation === THREE_INTERPOLATE_SMOOTH) {
    return "cubic";
  }
  if (interpolation === THREE_INTERPOLATE_LINEAR) {
    return "linear";
  }
  return "linear";
}

export function withTrackInterpolation(converted, interpolation) {
  if (!converted) {
    return [];
  }
  const tracks = Array.isArray(converted) ? converted : [converted];
  return tracks.map((track) => ({ ...track, interpolation }));
}
