export function oggTheoraVideoDimensions(bytes) {
  if (bytes.length < 27 || !isOggPage(bytes, 0)) {
    return {};
  }

  let offset = 0;
  let packetChunks = [];
  while (offset + 27 <= bytes.length) {
    if (!isOggPage(bytes, offset)) {
      return {};
    }
    const pageSegments = bytes[offset + 26];
    const segmentTableStart = offset + 27;
    const payloadStart = segmentTableStart + pageSegments;
    if (payloadStart > bytes.length) {
      return {};
    }

    let payloadOffset = payloadStart;
    for (let index = 0; index < pageSegments; index += 1) {
      const segmentLength = bytes[segmentTableStart + index];
      const segmentEnd = payloadOffset + segmentLength;
      if (segmentEnd > bytes.length) {
        return {};
      }
      packetChunks.push(bytes.subarray(payloadOffset, segmentEnd));
      payloadOffset = segmentEnd;
      if (segmentLength < 255) {
        const dimensions = theoraPacketDimensions(packetChunks);
        if (dimensions) {
          return dimensions;
        }
        packetChunks = [];
      }
    }
    offset = payloadOffset;
  }
  return {};
}

function isOggPage(bytes, offset) {
  return bytes[offset] === 0x4f &&
    bytes[offset + 1] === 0x67 &&
    bytes[offset + 2] === 0x67 &&
    bytes[offset + 3] === 0x53 &&
    bytes[offset + 4] === 0;
}

function theoraPacketDimensions(chunks) {
  const packet = concatChunks(chunks);
  if (packet.length < 20 ||
    packet[0] !== 0x80 ||
    packet[1] !== 0x74 ||
    packet[2] !== 0x68 ||
    packet[3] !== 0x65 ||
    packet[4] !== 0x6f ||
    packet[5] !== 0x72 ||
    packet[6] !== 0x61) {
    return null;
  }

  const width = readUint24BE(packet, 14);
  const height = readUint24BE(packet, 17);
  const frameRateNumerator = readUint32BE(packet, 22);
  const frameRateDenominator = readUint32BE(packet, 26);
  const frameRate = frameRateDenominator > 0 ? frameRateNumerator / frameRateDenominator : 0;
  if (width > 0 && height > 0) {
    return frameRate > 0 ? { width, height, frameRate } : { width, height };
  }
  const macroblockWidth = readUint16BE(packet, 10);
  const macroblockHeight = readUint16BE(packet, 12);
  if (macroblockWidth <= 0 || macroblockHeight <= 0) {
    return null;
  }
  const dimensions = { width: macroblockWidth * 16, height: macroblockHeight * 16 };
  return frameRate > 0 ? { ...dimensions, frameRate } : dimensions;
}

function concatChunks(chunks) {
  if (chunks.length === 1) {
    return chunks[0];
  }
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function readUint16BE(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint24BE(bytes, offset) {
  return (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
}

function readUint32BE(bytes, offset) {
  return ((bytes[offset] << 24) >>> 0) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3];
}
