import {
  trackTimes,
  trackValues,
  trackValueSize
} from "./three-animation-sampler.js";

const COMPONENT_INDEX = Object.freeze({
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  x: 0,
  y: 1,
  z: 2,
  w: 3
});

export function parseQuaternionComponentSuffix(suffix) {
  const match = suffix?.match(/^(?:\.([xyzwXYZW])|\[([xyzwXYZW0123])\])$/);
  const key = match ? (match[1] || match[2]).toLowerCase() : null;
  return key == null ? null : COMPONENT_INDEX[key] ?? null;
}

function uniqueSortedTimes(times) {
  return Array.from(new Set(
    times.filter((time) => Number.isFinite(time) && time >= 0)
  )).sort((a, b) => a - b);
}

function rawScalarAt(track, time, component, fallback) {
  const times = trackTimes(track);
  const values = trackValues(track);
  const size = trackValueSize(track) || 1;
  if (!times.length) {
    return fallback;
  }
  if (time <= times[0]) {
    return values[size === 1 ? 0 : component] ?? fallback;
  }
  for (let index = 1; index < times.length; index += 1) {
    const previousTime = times[index - 1];
    const nextTime = times[index];
    if (time > nextTime) {
      continue;
    }
    const previous = values[(index - 1) * size + (size === 1 ? 0 : component)] ?? fallback;
    const next = values[index * size + (size === 1 ? 0 : component)] ?? fallback;
    const span = nextTime - previousTime || 1;
    const amount = Math.min(1, Math.max(0, (time - previousTime) / span));
    return previous + (next - previous) * amount;
  }
  return values[(times.length - 1) * size + (size === 1 ? 0 : component)] ?? fallback;
}

function scalarSampler(track, component, fallback) {
  if (!track) {
    return () => fallback;
  }
  if (!track?.createInterpolant) {
    return (time) => rawScalarAt(track, time, component, fallback);
  }
  const size = trackValueSize(track) || 1;
  const interpolant = track.createInterpolant(new Float32Array(size));
  return (time) => {
    const sample = interpolant.evaluate(time);
    return sample[size === 1 ? 0 : component] ?? fallback;
  };
}

function quaternionValuesAt(samplers, time) {
  return [
    samplers[0](time),
    samplers[1](time),
    samplers[2](time),
    samplers[3](time)
  ];
}

export function createQuaternionComponentTrack(target, components, defaultQuaternion = [0, 0, 0, 1]) {
  const byComponent = new Map();
  for (const component of components) {
    byComponent.set(component.component, component.track);
  }
  const samplers = defaultQuaternion.map((fallback, component) => {
    return scalarSampler(byComponent.get(component), component, fallback);
  });
  const times = uniqueSortedTimes(components.flatMap(({ track }) => trackTimes(track)));
  const values = times.flatMap((time) => quaternionValuesAt(samplers, time));
  const interpolationSource = components[0]?.track;

  return {
    name: `${target}.quaternion`,
    times,
    values,
    ValueTypeName: "quaternion",
    userData: interpolationSource?.userData || {},
    getValueSize() {
      return 4;
    },
    getInterpolation() {
      return interpolationSource?.getInterpolation?.();
    },
    createInterpolant() {
      return {
        evaluate(time) {
          return Float32Array.from(quaternionValuesAt(samplers, time));
        }
      };
    }
  };
}
