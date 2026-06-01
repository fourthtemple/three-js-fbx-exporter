const EBML_HEADER_ID = "1a45dfa3";
const SEGMENT_ID = "18538067";
const INFO_ID = "1549a966";
const TRACKS_ID = "1654ae6b";
const TRACK_ENTRY_ID = "ae";
const VIDEO_ID = "e0";
const PIXEL_WIDTH_ID = "b0";
const PIXEL_HEIGHT_ID = "ba";
const DEFAULT_DURATION_ID = "23e383";
const TIMESTAMP_SCALE_ID = "2ad7b1";
const DURATION_ID = "4489";
const DEFAULT_TIMESTAMP_SCALE = 1000000;

const CONTAINER_IDS = new Set([
  EBML_HEADER_ID,
  SEGMENT_ID,
  TRACKS_ID,
  TRACK_ENTRY_ID
]);

export function webmVideoDimensions(bytes) {
  const first = readElementHeader(bytes, 0, bytes.length);
  if (!first || ![EBML_HEADER_ID, SEGMENT_ID].includes(first.id)) {
    return {};
  }
  const segmentInfo = findSegmentInfo(bytes, 0, bytes.length, 0) || {};
  return findVideoDimensions(bytes, 0, bytes.length, 0, segmentInfo) || {};
}

function findSegmentInfo(bytes, start, end, depth) {
  if (depth > 8) {
    return null;
  }
  let offset = start;
  while (offset < end) {
    const element = readElementHeader(bytes, offset, end);
    if (!element) {
      return null;
    }
    if (element.id === INFO_ID) {
      return readSegmentInfo(bytes, element.dataStart, element.end);
    }
    if (CONTAINER_IDS.has(element.id)) {
      const info = findSegmentInfo(bytes, element.dataStart, element.end, depth + 1);
      if (info) {
        return info;
      }
    }
    offset = element.end;
  }
  return null;
}

function findVideoDimensions(bytes, start, end, depth, segmentInfo) {
  if (depth > 8) {
    return null;
  }
  let offset = start;
  while (offset < end) {
    const element = readElementHeader(bytes, offset, end);
    if (!element) {
      return null;
    }
    if (element.id === TRACK_ENTRY_ID) {
      const info = readTrackEntryInfo(bytes, element.dataStart, element.end, segmentInfo);
      if (info) {
        return info;
      }
    } else if (CONTAINER_IDS.has(element.id)) {
      const dimensions = findVideoDimensions(bytes, element.dataStart, element.end, depth + 1, segmentInfo);
      if (dimensions) {
        return dimensions;
      }
    }
    offset = element.end;
  }
  return null;
}

function readSegmentInfo(bytes, start, end) {
  let offset = start;
  let timestampScale = DEFAULT_TIMESTAMP_SCALE;
  let durationTicks = 0;
  while (offset < end) {
    const element = readElementHeader(bytes, offset, end);
    if (!element) {
      return null;
    }
    if (element.id === TIMESTAMP_SCALE_ID) {
      timestampScale = readUnsignedInteger(bytes, element.dataStart, element.end) || timestampScale;
    } else if (element.id === DURATION_ID) {
      durationTicks = readFloat(bytes, element.dataStart, element.end);
    }
    offset = element.end;
  }
  const duration = durationTicks > 0 && timestampScale > 0
    ? (durationTicks * timestampScale) / 1000000000
    : 0;
  return duration > 0 ? { duration } : {};
}

function readTrackEntryInfo(bytes, start, end, segmentInfo = {}) {
  let offset = start;
  let video = null;
  let defaultDuration = 0;
  while (offset < end) {
    const element = readElementHeader(bytes, offset, end);
    if (!element) {
      return null;
    }
    if (element.id === VIDEO_ID) {
      video = readVideoElementDimensions(bytes, element.dataStart, element.end);
    } else if (element.id === DEFAULT_DURATION_ID) {
      defaultDuration = readUnsignedInteger(bytes, element.dataStart, element.end);
    }
    offset = element.end;
  }
  if (!video) {
    return null;
  }
  const frameRate = defaultDuration > 0 ? 1000000000 / defaultDuration : 0;
  return {
    ...video,
    ...(frameRate > 0 ? { frameRate } : {}),
    ...videoTimingInfo(frameRate, segmentInfo)
  };
}

function videoTimingInfo(frameRate, segmentInfo) {
  const duration = Number(segmentInfo?.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    return {};
  }
  const frameCount = frameRate > 0 ? Math.round(duration * frameRate) : 0;
  return frameCount > 0
    ? { duration, frameCount, stopFrame: frameCount, lastFrame: frameCount }
    : { duration };
}

function readVideoElementDimensions(bytes, start, end) {
  let offset = start;
  let width = 0;
  let height = 0;
  while (offset < end) {
    const element = readElementHeader(bytes, offset, end);
    if (!element) {
      return null;
    }
    if (element.id === PIXEL_WIDTH_ID) {
      width = readUnsignedInteger(bytes, element.dataStart, element.end);
    } else if (element.id === PIXEL_HEIGHT_ID) {
      height = readUnsignedInteger(bytes, element.dataStart, element.end);
    }
    if (width > 0 && height > 0) {
      return { width, height };
    }
    offset = element.end;
  }
  return null;
}

function readElementHeader(bytes, offset, parentEnd) {
  const id = readVint(bytes, offset, parentEnd, { maxLength: 4, keepMarker: true });
  if (!id) {
    return null;
  }
  const size = readVint(bytes, id.next, parentEnd, { maxLength: 8, keepMarker: false });
  if (!size) {
    return null;
  }
  const dataStart = size.next;
  const dataEnd = size.unknown ? parentEnd : dataStart + size.value;
  if (dataEnd > parentEnd || dataEnd < dataStart) {
    return null;
  }
  return {
    id: hexId(bytes, offset, id.length),
    dataStart,
    end: dataEnd
  };
}

function readVint(bytes, offset, end, { maxLength, keepMarker }) {
  if (offset >= end) {
    return null;
  }
  const first = bytes[offset];
  let marker = 0x80;
  let length = 1;
  while (length <= maxLength && (first & marker) === 0) {
    marker >>= 1;
    length += 1;
  }
  if (length > maxLength || offset + length > end) {
    return null;
  }

  let value = keepMarker ? first : first & (marker - 1);
  let unknown = !keepMarker && value === marker - 1;
  for (let index = 1; index < length; index += 1) {
    value = value * 256 + bytes[offset + index];
    unknown = unknown && bytes[offset + index] === 0xff;
  }
  return {
    length,
    value,
    unknown,
    next: offset + length
  };
}

function readUnsignedInteger(bytes, start, end) {
  if (end <= start || end - start > 6) {
    return 0;
  }
  let value = 0;
  for (let offset = start; offset < end; offset += 1) {
    value = value * 256 + bytes[offset];
  }
  return value;
}

function readFloat(bytes, start, end) {
  const length = end - start;
  if (length !== 4 && length !== 8) {
    return 0;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset + start, length);
  return length === 4 ? view.getFloat32(0, false) : view.getFloat64(0, false);
}

function hexId(bytes, offset, length) {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += bytes[offset + index].toString(16).padStart(2, "0");
  }
  return value;
}
