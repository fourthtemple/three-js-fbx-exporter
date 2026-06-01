const BMFF_CONTAINER_BOXES = new Set([
  "moov",
  "trak",
  "mdia",
  "minf",
  "stbl",
  "edts",
  "udta",
  "meta",
  "iprp",
  "ipco"
]);

export function isobmffImageDimensions(bytes) {
  if (bytes.length < 16 || readAscii(bytes, 4, 4) !== "ftyp") {
    return {};
  }
  return findBmffValue(bytes, 0, bytes.length, 0, (box) => {
    if (box.type !== "ispe" || box.dataStart + 12 > box.end) {
      return null;
    }
    const width = readUint32BE(bytes, box.dataStart + 4);
    const height = readUint32BE(bytes, box.dataStart + 8);
    return width > 0 && height > 0 ? { width, height } : null;
  }) || {};
}

export function isobmffVideoDimensions(bytes) {
  if (bytes.length < 8 || !["ftyp", "moov"].includes(readAscii(bytes, 4, 4))) {
    return {};
  }
  return findBmffValue(bytes, 0, bytes.length, 0, (box) => {
    if (box.type !== "trak") {
      return null;
    }
    return readVideoTrackInfo(bytes, box);
  }) || {};
}

function findBmffValue(bytes, start, end, depth, visitor) {
  if (depth > 8) {
    return null;
  }
  let offset = start;
  while (offset + 8 <= end) {
    const box = readBmffBox(bytes, offset, end);
    if (!box) {
      return null;
    }
    const value = visitor(box);
    if (value) {
      return value;
    }
    if (BMFF_CONTAINER_BOXES.has(box.type)) {
      const childStart = box.type === "meta" ? box.dataStart + 4 : box.dataStart;
      if (childStart <= box.end) {
        const nested = findBmffValue(bytes, childStart, box.end, depth + 1, visitor);
        if (nested) {
          return nested;
        }
      }
    }
    offset = box.end;
  }
  return null;
}

function walkBmffBoxes(bytes, start, end, depth, visitor) {
  if (depth > 8) {
    return;
  }
  let offset = start;
  while (offset + 8 <= end) {
    const box = readBmffBox(bytes, offset, end);
    if (!box) {
      return;
    }
    visitor(box);
    if (BMFF_CONTAINER_BOXES.has(box.type)) {
      const childStart = box.type === "meta" ? box.dataStart + 4 : box.dataStart;
      if (childStart <= box.end) {
        walkBmffBoxes(bytes, childStart, box.end, depth + 1, visitor);
      }
    }
    offset = box.end;
  }
}

function readVideoTrackInfo(bytes, trackBox) {
  let dimensions = null;
  let timescale = 0;
  let sampleTiming = null;
  walkBmffBoxes(bytes, trackBox.dataStart, trackBox.end, 0, (box) => {
    if (box.type === "tkhd" && !dimensions) {
      dimensions = tkhdDimensions(bytes, box);
    } else if (box.type === "mdhd") {
      timescale = mdhdTimescale(bytes, box) || timescale;
    } else if (box.type === "stts") {
      sampleTiming = sttsSampleTiming(bytes, box) || sampleTiming;
    }
  });
  if (!dimensions) {
    return null;
  }
  return {
    ...dimensions,
    ...sampleTimingInfo(timescale, sampleTiming)
  };
}

function tkhdDimensions(bytes, box) {
  const version = bytes[box.dataStart];
  if (version !== 0 && version !== 1) {
    return null;
  }
  const widthOffset = box.dataStart + (version === 1 ? 88 : 76);
  if (widthOffset + 8 > box.end) {
    return null;
  }
  const width = fixedPoint16(readUint32BE(bytes, widthOffset));
  const height = fixedPoint16(readUint32BE(bytes, widthOffset + 4));
  return width > 0 && height > 0 ? { width, height } : null;
}

function mdhdTimescale(bytes, box) {
  const version = bytes[box.dataStart];
  if (version !== 0 && version !== 1) {
    return 0;
  }
  const timescaleOffset = box.dataStart + (version === 1 ? 20 : 12);
  if (timescaleOffset + 4 > box.end) {
    return 0;
  }
  return readUint32BE(bytes, timescaleOffset);
}

function sttsSampleTiming(bytes, box) {
  if (box.dataStart + 8 > box.end) {
    return null;
  }
  const entryCount = readUint32BE(bytes, box.dataStart + 4);
  let offset = box.dataStart + 8;
  let sampleCount = 0;
  let duration = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 8 > box.end) {
      return null;
    }
    const count = readUint32BE(bytes, offset);
    const delta = readUint32BE(bytes, offset + 4);
    sampleCount += count;
    duration += count * delta;
    offset += 8;
  }
  return sampleCount > 0 && duration > 0 ? { sampleCount, duration } : null;
}

function sampleTimingInfo(timescale, timing) {
  const frameRate = timing?.sampleCount > 0 && timing.duration > 0 && timescale > 0
    ? (timing.sampleCount * timescale) / timing.duration
    : 0;
  if (!Number.isFinite(frameRate) || frameRate <= 0) {
    return {};
  }
  const duration = timing.duration / timescale;
  return {
    frameRate,
    frameCount: timing.sampleCount,
    duration,
    stopFrame: timing.sampleCount,
    lastFrame: timing.sampleCount
  };
}

function fixedPoint16(value) {
  return Math.round(value / 65536);
}

function readBmffBox(bytes, offset, parentEnd) {
  let size = readUint32BE(bytes, offset);
  const type = readAscii(bytes, offset + 4, 4);
  let dataStart = offset + 8;
  if (!type.trim()) {
    return null;
  }
  if (size === 1) {
    if (offset + 16 > parentEnd) {
      return null;
    }
    const high = readUint32BE(bytes, offset + 8);
    const low = readUint32BE(bytes, offset + 12);
    if (high > 0x1fffff) {
      return null;
    }
    size = high * 0x100000000 + low;
    dataStart = offset + 16;
  } else if (size === 0) {
    size = parentEnd - offset;
  }
  const boxEnd = offset + size;
  if (size < dataStart - offset || boxEnd > parentEnd || boxEnd <= offset) {
    return null;
  }
  return { type, dataStart, end: boxEnd };
}

function readUint32BE(bytes, offset) {
  return ((bytes[offset] << 24) >>> 0) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3];
}

function readAscii(bytes, offset, length) {
  if (offset + length > bytes.length) {
    return "";
  }
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(bytes[offset + index]);
  }
  return value;
}
