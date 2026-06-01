export const ANIMATION_INTERPOLATION_FLAGS = Object.freeze({
  constant: 0x00000002,
  linear: 0x00000004,
  cubic: 0x00000008
});

const DEFAULT_TANGENT_FLAGS = 0x00000100 | 0x00002000 | 0x00004000;
const USER_TANGENT_FLAGS = 0x00000400 | 0x00002000 | 0x00004000;
const BREAK_TANGENT_FLAGS = 0x00000400 | 0x00000800 | 0x00002000 | 0x00004000;
const WEIGHTED_RIGHT = 0x01000000;
const WEIGHTED_NEXT_LEFT = 0x02000000;
const DEFAULT_KEY_ATTR_DATA = Object.freeze([0, 0, 9.419963346924634e-30, 0]);
const TANGENT_CHANNELS = ["X", "Y", "Z", "W"];

export function normalizeAnimationInterpolation(value, fallback = "linear") {
  if (Number.isInteger(value)) {
    if (value === ANIMATION_INTERPOLATION_FLAGS.constant) {
      return "constant";
    }
    if (value === ANIMATION_INTERPOLATION_FLAGS.cubic) {
      return "cubic";
    }
    return "linear";
  }
  if (value == null) {
    return fallback;
  }
  const text = String(value).toLowerCase();
  if (text.includes("step") || text.includes("hold") || text.includes("constant") || text.includes("discrete")) {
    return "constant";
  }
  if (text.includes("cubic") || text.includes("bezier") || text.includes("smooth") || text.includes("spline")) {
    return "cubic";
  }
  return "linear";
}

export function animationKeyAttributeFlag(interpolation = "linear", options = {}) {
  const normalized = normalizeAnimationInterpolation(interpolation);
  return (ANIMATION_INTERPOLATION_FLAGS[normalized] || ANIMATION_INTERPOLATION_FLAGS.linear) |
    tangentModeFlags(options.tangentMode) |
    tangentWeightFlags(options);
}

export function animationKeyAttributes(keyframes, track = {}, channel = null) {
  const fallbackInterpolation = normalizeAnimationInterpolation(
    track.interpolation ?? track.interpolationMode ?? track.curveInterpolation,
    "linear"
  );
  const groups = [];
  for (const keyframe of keyframes) {
    const flag = keyframeAttributeFlag(keyframe, track, fallbackInterpolation, channel);
    const data = keyframeAttributeData(keyframe, track, channel);
    const last = groups[groups.length - 1];
    if (last && last.flag === flag && sameArray(last.data, data)) {
      last.count += 1;
    } else {
      groups.push({ flag, data, count: 1 });
    }
  }
  return {
    flags: groups.map((group) => group.flag),
    dataFloat: groups.flatMap((group) => group.data),
    refCounts: groups.map((group) => group.count)
  };
}

function keyframeAttributeFlag(keyframe, track, fallbackInterpolation, channel) {
  const explicit = keyframe.keyAttrFlags ?? keyframe.keyAttributeFlags ?? track.keyAttrFlags ?? track.keyAttributeFlags;
  if (Number.isInteger(explicit)) {
    return explicit;
  }
  const data = tangentDataSource(keyframe, track, channel);
  return animationKeyAttributeFlag(
    keyframe.interpolation ??
    keyframe.interpolationMode ??
    keyframe.easing ??
    fallbackInterpolation,
    {
      tangentMode: keyframe.tangentMode ?? track.tangentMode ?? (data ? "user" : null),
      weightedRight: hasRightWeight(data, channel),
      weightedNextLeft: hasNextLeftWeight(data, channel)
    }
  );
}

function keyframeAttributeData(keyframe, track, channel) {
  const explicit = tangentDataSource(keyframe, track, channel);
  if (!explicit) {
    return [...DEFAULT_KEY_ATTR_DATA];
  }
  if (!isFlatTangentArray(explicit)) {
    return keyframeTangentData(explicit, channel);
  }
  return [0, 1, 2, 3].map((index) => finiteOrDefault(explicit[index], DEFAULT_KEY_ATTR_DATA[index]));
}

function tangentModeFlags(value) {
  if (Number.isInteger(value)) {
    return value;
  }
  const text = String(value || "").toLowerCase();
  if (text.includes("break")) {
    return BREAK_TANGENT_FLAGS;
  }
  if (text.includes("user") || text.includes("manual") || text.includes("custom")) {
    return USER_TANGENT_FLAGS;
  }
  return DEFAULT_TANGENT_FLAGS;
}

function tangentWeightFlags({ weightedRight = false, weightedNextLeft = false } = {}) {
  return (weightedRight ? WEIGHTED_RIGHT : 0) | (weightedNextLeft ? WEIGHTED_NEXT_LEFT : 0);
}

function tangentDataSource(keyframe, track, channel) {
  return channelTangentData(keyframe, channel) ??
    channelTangentData(track, channel) ??
    channelTangentEntry(keyframe.keyAttrDataFloat, channel) ??
    channelTangentEntry(keyframe.keyAttributeDataFloat, channel) ??
    channelTangentEntry(keyframe.tangentData, channel) ??
    channelTangentEntry(keyframe.tangents, channel) ??
    channelTangentEntry(keyframe.tangent, channel) ??
    keyframe.keyAttrDataFloat ??
    keyframe.keyAttributeDataFloat ??
    keyframe.tangentData ??
    keyframe.tangents ??
    keyframe.tangent ??
    inlineTangentData(keyframe, channel) ??
    channelTangentEntry(track.keyAttrDataFloat, channel) ??
    channelTangentEntry(track.keyAttributeDataFloat, channel) ??
    channelTangentEntry(track.tangentData, channel) ??
    channelTangentEntry(track.tangents, channel) ??
    channelTangentEntry(track.tangent, channel) ??
    track.keyAttrDataFloat ??
    track.keyAttributeDataFloat ??
    track.tangentData ??
    track.tangents ??
    track.tangent ??
    inlineTangentData(track, channel);
}

function inlineTangentData(source, channel) {
  if (!source) {
    return null;
  }
  const data = {
    rightSlope: channelValue(firstDefined(source.rightSlope, source.outSlope, source.outTangent, source.rightDerivative), channel),
    nextLeftSlope: channelValue(firstDefined(source.nextLeftSlope, source.leftSlope, source.inSlope, source.inTangent, source.leftDerivative), channel),
    rightWeight: channelValue(firstDefined(source.rightWeight, source.outWeight), channel),
    nextLeftWeight: channelValue(firstDefined(source.nextLeftWeight, source.leftWeight, source.inWeight), channel)
  };
  return Object.values(data).some((value) => value != null) ? data : null;
}

function keyframeTangentData(data, channel) {
  return [
    finiteOrDefault(channelValue(data.rightSlope ?? data.outSlope ?? data.outTangent ?? data.rightDerivative, channel), DEFAULT_KEY_ATTR_DATA[0]),
    finiteOrDefault(channelValue(data.nextLeftSlope ?? data.leftSlope ?? data.inSlope ?? data.inTangent ?? data.leftDerivative, channel), DEFAULT_KEY_ATTR_DATA[1]),
    finiteOrDefault(channelValue(data.rightWeight ?? data.outWeight, channel), DEFAULT_KEY_ATTR_DATA[2]),
    finiteOrDefault(channelValue(data.nextLeftWeight ?? data.leftWeight ?? data.inWeight, channel), DEFAULT_KEY_ATTR_DATA[3])
  ];
}

function firstDefined(...values) {
  return values.find((value) => value != null);
}

function hasFiniteValue(value) {
  return Number.isFinite(Number(value));
}

function hasRightWeight(data, channel) {
  return isFlatTangentArray(data)
    ? hasFiniteValue(data[2])
    : hasFiniteValue(channelValue(data?.rightWeight ?? data?.outWeight, channel));
}

function hasNextLeftWeight(data, channel) {
  return isFlatTangentArray(data)
    ? hasFiniteValue(data[3])
    : hasFiniteValue(channelValue(data?.nextLeftWeight ?? data?.leftWeight ?? data?.inWeight, channel));
}

function finiteOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sameArray(a, b) {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

function channelTangentData(source, channel) {
  return channelTangentEntry(
    source?.keyAttrDataFloatByChannel ??
    source?.keyAttributeDataFloatByChannel ??
    source?.tangentDataByChannel ??
    source?.tangentsByChannel ??
    source?.channelTangents,
    channel
  );
}

function channelTangentEntry(value, channel) {
  if (channel == null || value == null) {
    return null;
  }
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    const entry = value[channel];
    return entry && typeof entry === "object" ? entry : null;
  }
  if (typeof value !== "object" || hasTangentFields(value)) {
    return null;
  }
  const axis = TANGENT_CHANNELS[channel];
  return value[channel] ??
    value[String(channel)] ??
    value[axis] ??
    value[axis?.toLowerCase()] ??
    null;
}

function isFlatTangentArray(value) {
  return Array.isArray(value) || ArrayBuffer.isView(value);
}

function hasTangentFields(value) {
  return value && typeof value === "object" && [
    "rightSlope",
    "outSlope",
    "outTangent",
    "rightDerivative",
    "nextLeftSlope",
    "leftSlope",
    "inSlope",
    "inTangent",
    "leftDerivative",
    "rightWeight",
    "outWeight",
    "nextLeftWeight",
    "leftWeight",
    "inWeight"
  ].some((field) => value[field] != null);
}

function channelValue(value, channel) {
  if (channel == null || value == null) {
    return value;
  }
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    return value[channel];
  }
  if (typeof value === "object") {
    const axis = TANGENT_CHANNELS[channel];
    return value[channel] ?? value[String(channel)] ?? value[axis] ?? value[axis?.toLowerCase()];
  }
  return value;
}
