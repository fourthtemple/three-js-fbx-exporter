const TIME_EPSILON = 1e-7;
const KEY_ENTRY_FIELDS = Object.freeze([
  "keyframes",
  "keys",
  "keyframeMetadata",
  "keyMetadata",
  "animationKeyMetadata",
  "keyframeTangents",
  "tangentKeyframes",
  "keyTangents"
]);
const TANGENT_DATA_FIELDS = Object.freeze([
  "keyAttrDataFloatByKey",
  "keyAttributeDataFloatByKey",
  "tangentDataByKey",
  "tangentsByKey",
  "keyTangentData",
  "keyTangents"
]);
const CHANNEL_TANGENT_FIELDS = Object.freeze([
  "keyAttrDataFloatByChannelByKey",
  "keyAttributeDataFloatByChannelByKey",
  "tangentDataByChannelByKey",
  "channelTangentsByKey"
]);
const SLOPE_FIELDS = Object.freeze({
  rightSlope: ["rightSlopeByKey", "rightSlopes", "outSlopeByKey", "outSlopes", "outTangents", "rightDerivatives"],
  nextLeftSlope: ["nextLeftSlopeByKey", "nextLeftSlopes", "leftSlopeByKey", "leftSlopes", "inTangents", "leftDerivatives"],
  rightWeight: ["rightWeightByKey", "rightWeights", "outWeightByKey", "outWeights"],
  nextLeftWeight: ["nextLeftWeightByKey", "nextLeftWeights", "leftWeightByKey", "leftWeights", "inWeights"]
});

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function trackTimes(track) {
  return Array.from(track?.times || []);
}

function sampleSourceTime(sampleTime, options = {}) {
  const sourceStart = finiteNumber(options.sourceStartTime) ?? 0;
  return (finiteNumber(sampleTime) ?? 0) + sourceStart;
}

function sourceKeyIndex(track, sourceTime) {
  return trackTimes(track).findIndex((time) => Math.abs(time - sourceTime) <= TIME_EPSILON);
}

function isArrayLike(value) {
  return Array.isArray(value) || ArrayBuffer.isView(value);
}

function firstDefined(...values) {
  return values.find((value) => value != null);
}

function indexedValue(value, index) {
  if (!isArrayLike(value) || index < 0) {
    return null;
  }
  return value[index] ?? null;
}

function indexedTuple(value, index, size) {
  if (!isArrayLike(value) || index < 0) {
    return null;
  }
  const entry = value[index];
  if (isArrayLike(entry) || (entry && typeof entry === "object")) {
    return entry;
  }
  const start = index * size;
  return value.length >= start + size ? Array.from(value.slice(start, start + size)) : null;
}

function timeEntry(value, sourceTime) {
  if (!value || typeof value !== "object" || isArrayLike(value)) {
    return null;
  }
  for (const [key, entry] of Object.entries(value)) {
    const time = finiteNumber(key);
    if (time != null && Math.abs(time - sourceTime) <= TIME_EPSILON) {
      return entry;
    }
  }
  return null;
}

function keyedEntry(source, index, sourceTime) {
  for (const field of KEY_ENTRY_FIELDS) {
    const value = source?.[field];
    const entry = isArrayLike(value)
      ? indexedValue(value, index)
      : timeEntry(value, sourceTime);
    if (entry && typeof entry === "object") {
      return entry;
    }
  }
  return null;
}

function fieldArrayEntry(source, fields, index) {
  for (const field of fields) {
    const value = indexedValue(source?.[field], index);
    if (value != null) {
      return value;
    }
  }
  return undefined;
}

function tangentDataByKey(source, index) {
  for (const field of TANGENT_DATA_FIELDS) {
    const value = indexedTuple(source?.[field], index, 4);
    if (value != null) {
      return value;
    }
  }
  const data = Object.fromEntries(
    Object.entries(SLOPE_FIELDS).map(([target, fields]) => [target, fieldArrayEntry(source, fields, index)])
  );
  return Object.values(data).some((value) => value != null) ? data : null;
}

function channelTangentsByKey(source, index) {
  for (const field of CHANNEL_TANGENT_FIELDS) {
    const value = indexedValue(source?.[field], index);
    if (value != null) {
      return value;
    }
  }
  return null;
}

function entryInterpolation(entry) {
  return firstDefined(entry?.interpolation, entry?.interpolationMode, entry?.easing, entry?.curveInterpolation);
}

function metadataFromEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return {};
  }
  const metadata = {};
  const flags = firstDefined(entry.keyAttrFlags, entry.keyAttributeFlags);
  if (Number.isInteger(flags)) {
    metadata.keyAttrFlags = flags;
  }
  const interpolation = entryInterpolation(entry);
  if (interpolation != null) {
    metadata.interpolation = interpolation;
  }
  const channelTangents = firstDefined(
    entry.keyAttrDataFloatByChannel,
    entry.keyAttributeDataFloatByChannel,
    entry.tangentDataByChannel,
    entry.tangentsByChannel,
    entry.channelTangents
  );
  if (channelTangents != null) {
    metadata.tangentDataByChannel = channelTangents;
  }
  const tangentData = firstDefined(
    entry.keyAttrDataFloat,
    entry.keyAttributeDataFloat,
    entry.tangentData,
    entry.tangents,
    entry.tangent,
    inlineTangentData(entry)
  );
  if (tangentData != null) {
    metadata.tangentData = tangentData;
  }
  if (entry.tangentMode != null) {
    metadata.tangentMode = entry.tangentMode;
  }
  return metadata;
}

function inlineTangentData(entry) {
  const data = {
    rightSlope: firstDefined(entry.rightSlope, entry.outSlope, entry.outTangent, entry.rightDerivative),
    nextLeftSlope: firstDefined(entry.nextLeftSlope, entry.leftSlope, entry.inSlope, entry.inTangent, entry.leftDerivative),
    rightWeight: firstDefined(entry.rightWeight, entry.outWeight),
    nextLeftWeight: firstDefined(entry.nextLeftWeight, entry.leftWeight, entry.inWeight)
  };
  return Object.values(data).some((value) => value != null) ? data : null;
}

function metadataFromIndexedArrays(source, index) {
  const metadata = {};
  const keyAttrFlags = indexedValue(source?.keyAttrFlagsByKey ?? source?.keyAttributeFlagsByKey, index);
  if (Number.isInteger(keyAttrFlags)) {
    metadata.keyAttrFlags = keyAttrFlags;
  }
  const interpolation = indexedValue(source?.interpolationByKey ?? source?.interpolations, index);
  if (interpolation != null) {
    metadata.interpolation = interpolation;
  }
  const tangentMode = indexedValue(source?.tangentModeByKey ?? source?.tangentModes, index);
  if (tangentMode != null) {
    metadata.tangentMode = tangentMode;
  }
  const channelTangents = channelTangentsByKey(source, index);
  if (channelTangents != null) {
    metadata.tangentDataByChannel = channelTangents;
  }
  const tangentData = tangentDataByKey(source, index);
  if (tangentData != null) {
    metadata.tangentData = tangentData;
  }
  return metadata;
}

export function threeKeyframeMetadata(track, sampleTime, options = {}) {
  const sourceTime = sampleSourceTime(sampleTime, options);
  const index = sourceKeyIndex(track, sourceTime);
  if (index < 0) {
    return {};
  }
  return [track, track?.userData].reduce((metadata, source) => ({
    ...metadata,
    ...metadataFromIndexedArrays(source, index),
    ...metadataFromEntry(keyedEntry(source, index, sourceTime))
  }), {});
}
