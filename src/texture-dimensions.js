import {
  isobmffImageDimensions,
  isobmffVideoDimensions
} from "./texture-bmff-dimensions.js";
import { webmVideoDimensions } from "./texture-ebml-dimensions.js";
import { oggTheoraVideoDimensions } from "./texture-ogg-dimensions.js";

export function textureMediaInfoFromPayload(mimeType, content) {
  const bytes = normalizeBytes(content);
  if (!bytes?.length) {
    return {};
  }

  const normalizedMime = String(mimeType || "").toLowerCase();
  const preferredParsers = [];
  if (normalizedMime.includes("png")) {
    preferredParsers.push(pngDimensions);
  }
  if (normalizedMime.includes("jpeg") || normalizedMime.includes("jpg")) {
    preferredParsers.push(jpegDimensions);
  }
  if (normalizedMime.includes("tga")) {
    preferredParsers.push(tgaDimensions);
  }
  if (normalizedMime.includes("bmp")) {
    preferredParsers.push(bmpDimensions);
  }
  if (normalizedMime.includes("gif")) {
    preferredParsers.push(gifDimensions);
  }
  if (normalizedMime.includes("webp")) {
    preferredParsers.push(webpDimensions);
  }
  if (normalizedMime.includes("tiff") || normalizedMime.includes("tif")) {
    preferredParsers.push(tiffDimensions);
  }
  if (normalizedMime.includes("exr")) {
    preferredParsers.push(exrDimensions);
  }
  if (normalizedMime.includes("radiance") || normalizedMime.includes("hdr")) {
    preferredParsers.push(radianceHdrDimensions);
  }
  if (normalizedMime.includes("avif") || normalizedMime.includes("heic") || normalizedMime.includes("heif")) {
    preferredParsers.push(isobmffImageDimensions);
  }
  if (normalizedMime.includes("mp4") || normalizedMime.includes("quicktime") || normalizedMime.includes("mov")) {
    preferredParsers.push(isobmffVideoDimensions);
  }
  if (normalizedMime.includes("webm")) {
    preferredParsers.push(webmVideoDimensions);
  }
  if (normalizedMime.includes("ogg") || normalizedMime.includes("ogv")) {
    preferredParsers.push(oggTheoraVideoDimensions);
  }
  if (normalizedMime.includes("dds")) {
    preferredParsers.push(ddsDimensions);
  }
  if (normalizedMime.includes("ktx")) {
    preferredParsers.push(ktxDimensions);
  }
  for (const parser of [
    ...preferredParsers,
    pngDimensions,
    jpegDimensions,
    tgaDimensions,
    bmpDimensions,
    gifDimensions,
    webpDimensions,
    tiffDimensions,
    exrDimensions,
    radianceHdrDimensions,
    isobmffImageDimensions,
    isobmffVideoDimensions,
    webmVideoDimensions,
    oggTheoraVideoDimensions,
    ddsDimensions,
    ktxDimensions
  ]) {
    const dimensions = parser(bytes);
    if (dimensions.width && dimensions.height) {
      return dimensions;
    }
  }
  return {};
}

export function textureDimensionsFromPayload(mimeType, content) {
  const info = textureMediaInfoFromPayload(mimeType, content);
  return info.width && info.height
    ? { width: info.width, height: info.height }
    : {};
}

function normalizeBytes(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

function readUint16LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readInt32LE(bytes, offset) {
  return (bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24));
}

function readUint32LE(bytes, offset) {
  return (bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    ((bytes[offset + 3] << 24) >>> 0)) >>> 0;
}

function readUint32(bytes, offset, littleEndian = true) {
  return littleEndian ? readUint32LE(bytes, offset) : readUint32BE(bytes, offset);
}

function readUint24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint16BE(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint16(bytes, offset, littleEndian = true) {
  return littleEndian ? readUint16LE(bytes, offset) : readUint16BE(bytes, offset);
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

function isPng(bytes) {
  return bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
}

function pngDimensions(bytes) {
  if (!isPng(bytes)) {
    return {};
  }
  return {
    width: readUint32BE(bytes, 16),
    height: readUint32BE(bytes, 20)
  };
}

function isJpeg(bytes) {
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function jpegDimensions(bytes) {
  if (!isJpeg(bytes)) {
    return {};
  }

  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) {
      offset += 1;
    }
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) {
      break;
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      continue;
    }
    if (offset + 1 >= bytes.length) {
      break;
    }
    const segmentLength = readUint16BE(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      break;
    }
    if (isJpegStartOfFrame(marker) && segmentLength >= 7) {
      return {
        height: readUint16BE(bytes, offset + 3),
        width: readUint16BE(bytes, offset + 5)
      };
    }
    offset += segmentLength;
  }
  return {};
}

function isJpegStartOfFrame(marker) {
  return (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf);
}

function looksLikeTga(bytes) {
  if (bytes.length < 18) {
    return false;
  }
  const colorMapType = bytes[1];
  const imageType = bytes[2];
  const pixelDepth = bytes[16];
  const width = readUint16LE(bytes, 12);
  const height = readUint16LE(bytes, 14);
  return colorMapType <= 1 &&
    [1, 2, 3, 9, 10, 11].includes(imageType) &&
    [8, 15, 16, 24, 32].includes(pixelDepth) &&
    width > 0 &&
    height > 0;
}

function tgaDimensions(bytes) {
  if (!looksLikeTga(bytes)) {
    return {};
  }
  return {
    width: readUint16LE(bytes, 12),
    height: readUint16LE(bytes, 14)
  };
}

function bmpDimensions(bytes) {
  if (bytes.length < 26 || bytes[0] !== 0x42 || bytes[1] !== 0x4d) {
    return {};
  }
  const dibHeaderSize = readInt32LE(bytes, 14);
  if (dibHeaderSize === 12 && bytes.length >= 26) {
    return {
      width: readUint16LE(bytes, 18),
      height: readUint16LE(bytes, 20)
    };
  }
  if (dibHeaderSize < 40 || bytes.length < 26) {
    return {};
  }
  const width = readInt32LE(bytes, 18);
  const height = readInt32LE(bytes, 22);
  return width > 0 && height !== 0
    ? { width, height: Math.abs(height) }
    : {};
}

function gifDimensions(bytes) {
  if (bytes.length < 10 ||
    bytes[0] !== 0x47 ||
    bytes[1] !== 0x49 ||
    bytes[2] !== 0x46 ||
    bytes[3] !== 0x38 ||
    ![0x37, 0x39].includes(bytes[4]) ||
    bytes[5] !== 0x61) {
    return {};
  }
  return {
    width: readUint16LE(bytes, 6),
    height: readUint16LE(bytes, 8)
  };
}

function webpDimensions(bytes) {
  if (bytes.length < 16 ||
    bytes[0] !== 0x52 ||
    bytes[1] !== 0x49 ||
    bytes[2] !== 0x46 ||
    bytes[3] !== 0x46 ||
    bytes[8] !== 0x57 ||
    bytes[9] !== 0x45 ||
    bytes[10] !== 0x42 ||
    bytes[11] !== 0x50) {
    return {};
  }

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunk = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const size = readInt32LE(bytes, offset + 4);
    const dataOffset = offset + 8;
    if (size < 0 || dataOffset + size > bytes.length) {
      return {};
    }
    if (chunk === "VP8X" && size >= 10) {
      return {
        width: readUint24LE(bytes, dataOffset + 4) + 1,
        height: readUint24LE(bytes, dataOffset + 7) + 1
      };
    }
    if (chunk === "VP8L" && size >= 5 && bytes[dataOffset] === 0x2f) {
      const b1 = bytes[dataOffset + 1];
      const b2 = bytes[dataOffset + 2];
      const b3 = bytes[dataOffset + 3];
      const b4 = bytes[dataOffset + 4];
      return {
        width: 1 + b1 + ((b2 & 0x3f) << 8),
        height: 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10))
      };
    }
    if (chunk === "VP8 " && size >= 10 &&
      bytes[dataOffset + 3] === 0x9d &&
      bytes[dataOffset + 4] === 0x01 &&
      bytes[dataOffset + 5] === 0x2a) {
      return {
        width: readUint16LE(bytes, dataOffset + 6) & 0x3fff,
        height: readUint16LE(bytes, dataOffset + 8) & 0x3fff
      };
    }
    offset = dataOffset + size + (size % 2);
  }
  return {};
}

function tiffDimensions(bytes) {
  if (bytes.length < 14) {
    return {};
  }

  const littleEndian = bytes[0] === 0x49 && bytes[1] === 0x49;
  const bigEndian = bytes[0] === 0x4d && bytes[1] === 0x4d;
  if (!littleEndian && !bigEndian) {
    return {};
  }
  if (readUint16(bytes, 2, littleEndian) !== 42) {
    return {};
  }

  const ifdOffset = readUint32(bytes, 4, littleEndian);
  if (ifdOffset < 8 || ifdOffset + 2 > bytes.length) {
    return {};
  }

  const entryCount = readUint16(bytes, ifdOffset, littleEndian);
  const entriesOffset = ifdOffset + 2;
  if (entriesOffset + entryCount * 12 > bytes.length) {
    return {};
  }

  let width = 0;
  let height = 0;
  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = entriesOffset + index * 12;
    const tag = readUint16(bytes, entryOffset, littleEndian);
    if (tag !== 256 && tag !== 257) {
      continue;
    }
    const value = tiffEntryFirstInteger(bytes, entryOffset, littleEndian);
    if (tag === 256) {
      width = value;
    } else {
      height = value;
    }
  }

  return width > 0 && height > 0 ? { width, height } : {};
}

function tiffEntryFirstInteger(bytes, entryOffset, littleEndian) {
  const type = readUint16(bytes, entryOffset + 2, littleEndian);
  const count = readUint32(bytes, entryOffset + 4, littleEndian);
  if (count < 1) {
    return 0;
  }
  if (type === 3) {
    return readUint16(bytes, entryOffset + 8, littleEndian);
  }
  if (type === 4) {
    return readUint32(bytes, entryOffset + 8, littleEndian);
  }
  return 0;
}

function exrDimensions(bytes) {
  if (bytes.length < 10 ||
    bytes[0] !== 0x76 ||
    bytes[1] !== 0x2f ||
    bytes[2] !== 0x31 ||
    bytes[3] !== 0x01) {
    return {};
  }

  let offset = 8;
  while (offset < bytes.length && bytes[offset] !== 0) {
    const name = readNullTerminatedAscii(bytes, offset);
    if (!name) {
      return {};
    }
    offset = name.next;
    const type = readNullTerminatedAscii(bytes, offset);
    if (!type || type.next + 4 > bytes.length) {
      return {};
    }
    offset = type.next;
    const size = readUint32LE(bytes, offset);
    offset += 4;
    if (offset + size > bytes.length) {
      return {};
    }
    if (name.value === "dataWindow" && type.value === "box2i" && size >= 16) {
      const minX = readInt32LE(bytes, offset);
      const minY = readInt32LE(bytes, offset + 4);
      const maxX = readInt32LE(bytes, offset + 8);
      const maxY = readInt32LE(bytes, offset + 12);
      const width = maxX - minX + 1;
      const height = maxY - minY + 1;
      return width > 0 && height > 0 ? { width, height } : {};
    }
    offset += size;
  }
  return {};
}

function readNullTerminatedAscii(bytes, offset) {
  let end = offset;
  while (end < bytes.length && bytes[end] !== 0) {
    end += 1;
  }
  if (end >= bytes.length || end === offset) {
    return null;
  }
  let value = "";
  for (let index = offset; index < end; index += 1) {
    value += String.fromCharCode(bytes[index]);
  }
  return { value, next: end + 1 };
}

function radianceHdrDimensions(bytes) {
  if (bytes.length < 12 || bytes[0] !== 0x23 || bytes[1] !== 0x3f) {
    return {};
  }

  const text = readAscii(bytes, 0, Math.min(bytes.length, 4096));
  if (!/^#\?(?:RADIANCE|RGBE)/.test(text)) {
    return {};
  }
  const match = text.match(/(?:^|[\r\n])([+-][XY])\s+(\d+)\s+([+-][XY])\s+(\d+)(?:\r?\n|$)/);
  if (!match) {
    return {};
  }

  const firstAxis = match[1][1];
  const firstValue = Number(match[2]);
  const secondAxis = match[3][1];
  const secondValue = Number(match[4]);
  const width = firstAxis === "X" ? firstValue : secondAxis === "X" ? secondValue : 0;
  const height = firstAxis === "Y" ? firstValue : secondAxis === "Y" ? secondValue : 0;
  return width > 0 && height > 0 ? { width, height } : {};
}

function ddsDimensions(bytes) {
  if (bytes.length < 20 ||
    bytes[0] !== 0x44 ||
    bytes[1] !== 0x44 ||
    bytes[2] !== 0x53 ||
    bytes[3] !== 0x20 ||
    readUint32LE(bytes, 4) !== 124) {
    return {};
  }
  const height = readUint32LE(bytes, 12);
  const width = readUint32LE(bytes, 16);
  return width > 0 && height > 0 ? { width, height } : {};
}

const KTX_IDENTIFIER = [0xab, 0x4b, 0x54, 0x58, 0x20];
const KTX1_VERSION = [0x31, 0x31];
const KTX2_VERSION = [0x32, 0x30];
const KTX_IDENTIFIER_SUFFIX = [0xbb, 0x0d, 0x0a, 0x1a, 0x0a];

function hasKtxIdentifier(bytes, version) {
  if (bytes.length < 12) {
    return false;
  }
  const expected = [...KTX_IDENTIFIER, ...version, ...KTX_IDENTIFIER_SUFFIX];
  return expected.every((value, index) => bytes[index] === value);
}

function ktxDimensions(bytes) {
  if (hasKtxIdentifier(bytes, KTX2_VERSION)) {
    if (bytes.length < 28) {
      return {};
    }
    const width = readUint32LE(bytes, 20);
    const height = readUint32LE(bytes, 24);
    return width > 0 && height > 0 ? { width, height } : {};
  }
  if (hasKtxIdentifier(bytes, KTX1_VERSION)) {
    if (bytes.length < 44) {
      return {};
    }
    const littleEndian = bytes[12] === 0x01 && bytes[13] === 0x02 && bytes[14] === 0x03 && bytes[15] === 0x04;
    const bigEndian = bytes[12] === 0x04 && bytes[13] === 0x03 && bytes[14] === 0x02 && bytes[15] === 0x01;
    if (!littleEndian && !bigEndian) {
      return {};
    }
    const width = readUint32(bytes, 36, littleEndian);
    const height = readUint32(bytes, 40, littleEndian);
    return width > 0 && height > 0 ? { width, height } : {};
  }
  return {};
}
