const DEFAULT_SAMPLE_RATE = 30;
const TIME_PRECISION = 1e9;
const DISCRETE_INTERPOLATION = 2300;

function positiveNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) {
      return number;
    }
  }
  return null;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function trackTimes(track) {
  return Array.from(track.times || []);
}

export function trackValues(track) {
  return Array.from(track.values || []);
}

export function trackValueSize(track) {
  if (Number.isInteger(track.getValueSize?.())) {
    return track.getValueSize();
  }
  const times = trackTimes(track);
  return times.length ? Math.floor((track.values?.length || 0) / times.length) : 0;
}

export function clipDurationSeconds(clip) {
  if (Number.isFinite(clip.duration) && clip.duration >= 0) {
    return clip.duration;
  }
  return Math.max(0, ...(clip.tracks || []).flatMap((track) => trackTimes(track)));
}

export function animationSamples(track, frameRate, duration, options = {}) {
  const range = sourceRange(options, duration) ?? durationRange(track, duration);
  if (options.bakeAnimations === false || !track.createInterpolant) {
    return range
      ? rangedTrackSamples(track, range)
      : {
          times: trackTimes(track),
          values: trackValues(track),
          size: trackValueSize(track)
        };
  }

  const size = trackValueSize(track);
  if (!size) {
    return { times: [], values: [], size: 0 };
  }

  const data = track.userData || {};
  const sampleRate = positiveNumber(
    data.bakeFrameRate,
    data.bakeSampleRate,
    data.sampleFrameRate,
    data.sampleRate,
    data.resampleFrameRate,
    data.resampleRate,
    track.bakeFrameRate,
    track.bakeSampleRate,
    track.sampleFrameRate,
    track.sampleRate,
    track.resampleFrameRate,
    track.resampleRate,
    options.bakeFrameRate,
    frameRate,
    DEFAULT_SAMPLE_RATE
  );
  const times = sampleTimes(track, sampleRate, duration, range);
  const interpolant = track.createInterpolant(new Float32Array(size));
  const values = [];
  for (const time of times) {
    const sample = interpolant.evaluate(sourceTimeForOutput(time, range));
    for (let index = 0; index < size; index += 1) {
      values.push(sample[index] ?? 0);
    }
  }
  return { times, values, size };
}

function sourceRange(options, duration) {
  const sourceStartTime = finiteNumber(options.sourceStartTime);
  const sourceEndTime = finiteNumber(options.sourceEndTime);
  if (sourceStartTime == null && sourceEndTime == null) {
    return null;
  }
  const start = Math.max(0, sourceStartTime ?? 0);
  const end = Math.max(start, sourceEndTime ?? start + Math.max(0, duration));
  return { start, end, duration: Math.max(0, end - start) };
}

function durationRange(track, duration) {
  const end = finiteNumber(duration);
  if (end == null || end < 0) {
    return null;
  }
  const trackEnd = Math.max(0, ...trackTimes(track));
  return trackEnd > end ? { start: 0, end, duration: end } : null;
}

function sourceTimeForOutput(time, range) {
  return range ? time + range.start : time;
}

function rangedTrackSamples(track, range) {
  const size = trackValueSize(track);
  if (track.createInterpolant && size) {
    const times = uniqueSortedTimes([
      0,
      ...relativeSourceTimes(trackTimes(track), range),
      range.duration
    ]);
    const interpolant = track.createInterpolant(new Float32Array(size));
    const values = [];
    for (const time of times) {
      const sample = interpolant.evaluate(sourceTimeForOutput(time, range));
      for (let component = 0; component < size; component += 1) {
        values.push(sample[component] ?? 0);
      }
    }
    return { times, values, size };
  }

  const times = [];
  const values = [];
  const sourceTimes = trackTimes(track);
  const sourceValues = trackValues(track);
  for (const [index, time] of sourceTimes.entries()) {
    if (time < range.start || time > range.end) {
      continue;
    }
    times.push(time - range.start);
    for (let component = 0; component < size; component += 1) {
      values.push(sourceValues[index * size + component] ?? 0);
    }
  }
  return { times, values, size };
}

function sampleTimes(track, sampleRate, duration, range = null) {
  const sourceTimes = trackTimes(track);
  const endTime = range ? range.duration : Math.max(0, duration);
  const samples = [];
  const frameCount = Math.ceil(endTime * sampleRate);
  for (let frame = 0; frame <= frameCount; frame += 1) {
    samples.push(Math.min(frame / sampleRate, endTime));
  }
  samples.push(...relativeSourceTimes(sourceTimes, range));
  if (track.getInterpolation?.() === DISCRETE_INTERPOLATION) {
    samples.push(...relativeSourceTimes(stepHoldTimes(sourceTimes, sampleRate), range));
  }
  return uniqueSortedTimes(samples);
}

function relativeSourceTimes(times, range) {
  if (!range) {
    return times;
  }
  return times
    .filter((time) => time >= range.start && time <= range.end)
    .map((time) => time - range.start);
}

function stepHoldTimes(times, sampleRate) {
  const epsilon = 1 / ((sampleRate || DEFAULT_SAMPLE_RATE) * 1000);
  return times
    .filter((time) => time > 0)
    .map((time) => Math.max(0, time - epsilon));
}

function uniqueSortedTimes(times) {
  return Array.from(new Set(
    times
      .filter((time) => Number.isFinite(time) && time >= 0)
      .map((time) => Math.round(time * TIME_PRECISION) / TIME_PRECISION)
  )).sort((a, b) => a - b);
}
