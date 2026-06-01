import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dataUrlToTexturePayload,
  extensionForMime,
  textureDimensionsFromPayload,
  textureMediaInfoFromPayload
} from "../src/texture/texture-content.js";

function pngBytes(width = 3, height = 5) {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
    (width >>> 24) & 0xff, (width >>> 16) & 0xff, (width >>> 8) & 0xff, width & 0xff,
    (height >>> 24) & 0xff, (height >>> 16) & 0xff, (height >>> 8) & 0xff, height & 0xff
  ]);
}

function jpegBytes() {
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x02,
    0xff, 0xc0, 0x00, 0x0b, 0x08,
    0x00, 0x07,
    0x00, 0x09,
    0x03, 0x01, 0x11, 0x00
  ]);
}

function bmpBytes() {
  return Uint8Array.from([
    0x42, 0x4d, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0x28, 0x00, 0x00, 0x00,
    0x04, 0x00, 0x00, 0x00,
    0xfa, 0xff, 0xff, 0xff
  ]);
}

function gifBytes() {
  return Uint8Array.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61,
    0x0b, 0x00,
    0x0d, 0x00
  ]);
}

function webpVp8xBytes() {
  return Uint8Array.from([
    0x52, 0x49, 0x46, 0x46,
    0x1e, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x58,
    0x0a, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x0a, 0x00, 0x00,
    0x0c, 0x00, 0x00
  ]);
}

function writeUint32LE(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function writeUint16(bytes, offset, value, littleEndian = true) {
  if (littleEndian) {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >>> 8) & 0xff;
    return;
  }
  bytes[offset] = (value >>> 8) & 0xff;
  bytes[offset + 1] = value & 0xff;
}

function writeUint32(bytes, offset, value, littleEndian = true) {
  if (littleEndian) {
    writeUint32LE(bytes, offset, value);
    return;
  }
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function writeUint32BE(bytes, offset, value) {
  writeUint32(bytes, offset, value, false);
}

function asciiBytes(value) {
  return Uint8Array.from(String(value), (char) => char.charCodeAt(0));
}

function concatBytes(...chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function bmffBox(type, ...payloads) {
  const payload = concatBytes(...payloads);
  const bytes = new Uint8Array(8 + payload.length);
  writeUint32BE(bytes, 0, bytes.length);
  bytes.set(asciiBytes(type), 4);
  bytes.set(payload, 8);
  return bytes;
}

function bmffFullBox(type, ...payloads) {
  return bmffBox(type, Uint8Array.from([0, 0, 0, 0]), ...payloads);
}

function ispeBox(width, height) {
  const payload = new Uint8Array(12);
  writeUint32BE(payload, 4, width);
  writeUint32BE(payload, 8, height);
  return bmffBox("ispe", payload);
}

function tkhdBox(width, height) {
  const payload = new Uint8Array(84);
  payload[3] = 0x07;
  writeUint32BE(payload, 76, width * 65536);
  writeUint32BE(payload, 80, height * 65536);
  return bmffBox("tkhd", payload);
}

function mdhdBox(timescale, duration) {
  const payload = new Uint8Array(24);
  writeUint32BE(payload, 12, timescale);
  writeUint32BE(payload, 16, duration);
  return bmffBox("mdhd", payload);
}

function sttsBox(sampleCount, sampleDuration) {
  const payload = new Uint8Array(16);
  writeUint32BE(payload, 4, 1);
  writeUint32BE(payload, 8, sampleCount);
  writeUint32BE(payload, 12, sampleDuration);
  return bmffBox("stts", payload);
}

function mdiaTimingBox(frameRate) {
  const sampleCount = 30;
  const sampleDuration = 1000;
  const timescale = Math.round(frameRate * sampleDuration);
  return bmffBox(
    "mdia",
    mdhdBox(timescale, sampleCount * sampleDuration),
    bmffBox("minf", bmffBox("stbl", sttsBox(sampleCount, sampleDuration)))
  );
}

function ebmlElement(id, ...payloads) {
  const payload = concatBytes(...payloads);
  return concatBytes(Uint8Array.from(id), ebmlSize(payload.length), payload);
}

function ebmlSize(size) {
  if (size < 0x7f) {
    return Uint8Array.from([0x80 | size]);
  }
  if (size < 0x3fff) {
    return Uint8Array.from([0x40 | (size >> 8), size & 0xff]);
  }
  throw new Error("Test EBML size is too large");
}

function unsignedIntBytes(value) {
  const bytes = [];
  let number = value;
  do {
    bytes.unshift(number & 0xff);
    number = Math.floor(number / 256);
  } while (number > 0);
  return Uint8Array.from(bytes);
}

function unsignedIntElement(id, value) {
  return ebmlElement(id, unsignedIntBytes(value));
}

function float64Bytes(value) {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, value, false);
  return bytes;
}

function webmInfoElement(frameRate, frameCount = 30) {
  const timestampScale = 1000000;
  const duration = (frameCount / frameRate) * (1000000000 / timestampScale);
  return ebmlElement(
    [0x15, 0x49, 0xa9, 0x66],
    unsignedIntElement([0x2a, 0xd7, 0xb1], timestampScale),
    ebmlElement([0x44, 0x89], float64Bytes(duration))
  );
}

function oggPage(payload) {
  const bytes = new Uint8Array(28 + payload.length);
  bytes.set([0x4f, 0x67, 0x67, 0x53, 0, 2], 0);
  bytes[26] = 1;
  bytes[27] = payload.length;
  bytes.set(payload, 28);
  return bytes;
}

function theoraIdentificationPacket(width, height, frameRate = 24) {
  const bytes = new Uint8Array(42);
  bytes.set([0x80, 0x74, 0x68, 0x65, 0x6f, 0x72, 0x61], 0);
  bytes.set([3, 2, 1], 7);
  writeUint16(bytes, 10, Math.ceil(width / 16), false);
  writeUint16(bytes, 12, Math.ceil(height / 16), false);
  writeUint24BE(bytes, 14, width);
  writeUint24BE(bytes, 17, height);
  writeUint32BE(bytes, 22, frameRate);
  writeUint32BE(bytes, 26, 1);
  return bytes;
}

function writeUint24BE(bytes, offset, value) {
  bytes[offset] = (value >>> 16) & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = value & 0xff;
}

function ktx1Bytes(width = 17, height = 19) {
  const bytes = new Uint8Array(64);
  bytes.set([0xab, 0x4b, 0x54, 0x58, 0x20, 0x31, 0x31, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x01, 0x02, 0x03, 0x04], 12);
  writeUint32LE(bytes, 36, width);
  writeUint32LE(bytes, 40, height);
  return bytes;
}

function ddsBytes(width = 31, height = 37) {
  const bytes = new Uint8Array(128);
  bytes.set([0x44, 0x44, 0x53, 0x20], 0);
  writeUint32LE(bytes, 4, 124);
  writeUint32LE(bytes, 12, height);
  writeUint32LE(bytes, 16, width);
  return bytes;
}

function tiffBytes(width = 41, height = 43, littleEndian = true) {
  const bytes = new Uint8Array(38);
  bytes.set(littleEndian ? [0x49, 0x49] : [0x4d, 0x4d], 0);
  writeUint16(bytes, 2, 42, littleEndian);
  writeUint32(bytes, 4, 8, littleEndian);
  writeUint16(bytes, 8, 2, littleEndian);
  writeTiffLongEntry(bytes, 10, 256, width, littleEndian);
  writeTiffLongEntry(bytes, 22, 257, height, littleEndian);
  return bytes;
}

function writeTiffLongEntry(bytes, offset, tag, value, littleEndian) {
  writeUint16(bytes, offset, tag, littleEndian);
  writeUint16(bytes, offset + 2, 4, littleEndian);
  writeUint32(bytes, offset + 4, 1, littleEndian);
  writeUint32(bytes, offset + 8, value, littleEndian);
}

function exrBytes(width = 53, height = 59) {
  const header = new TextEncoder().encode("dataWindow\0box2i\0");
  const bytes = new Uint8Array(8 + header.length + 4 + 16 + 1);
  bytes.set([0x76, 0x2f, 0x31, 0x01, 0x02, 0x00, 0x00, 0x00], 0);
  bytes.set(header, 8);
  const sizeOffset = 8 + header.length;
  writeUint32LE(bytes, sizeOffset, 16);
  writeUint32LE(bytes, sizeOffset + 4, 0);
  writeUint32LE(bytes, sizeOffset + 8, 0);
  writeUint32LE(bytes, sizeOffset + 12, width - 1);
  writeUint32LE(bytes, sizeOffset + 16, height - 1);
  return bytes;
}

function radianceHdrBytes(width = 61, height = 67) {
  return asciiBytes(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`);
}

function avifBytes(width = 71, height = 73) {
  return concatBytes(
    bmffBox("ftyp", asciiBytes("avif"), Uint8Array.from([0, 0, 0, 0]), asciiBytes("avifmif1")),
    bmffFullBox("meta", bmffBox("iprp", bmffBox("ipco", ispeBox(width, height))))
  );
}

function mp4VideoBytes(width = 89, height = 97, frameRate = 30) {
  return concatBytes(
    bmffBox("ftyp", asciiBytes("mp42"), Uint8Array.from([0, 0, 0, 0]), asciiBytes("mp42isom")),
    bmffBox("moov", bmffBox("trak", tkhdBox(width, height), mdiaTimingBox(frameRate)))
  );
}

function webmVideoBytes(width = 131, height = 137, frameRate = 25) {
  const defaultDuration = Math.round(1000000000 / frameRate);
  return concatBytes(
    ebmlElement([0x1a, 0x45, 0xdf, 0xa3], ebmlElement([0x42, 0x82], asciiBytes("webm"))),
    ebmlElement(
      [0x18, 0x53, 0x80, 0x67],
      webmInfoElement(frameRate),
      ebmlElement(
        [0x16, 0x54, 0xae, 0x6b],
        ebmlElement(
          [0xae],
          unsignedIntElement([0x23, 0xe3, 0x83], defaultDuration),
          ebmlElement(
            [0xe0],
            unsignedIntElement([0xb0], width),
            unsignedIntElement([0xba], height)
          )
        )
      )
    )
  );
}

function oggTheoraBytes(width = 151, height = 157, frameRate = 24) {
  return oggPage(theoraIdentificationPacket(width, height, frameRate));
}

function ktx2Bytes(width = 23, height = 29) {
  const bytes = new Uint8Array(68);
  bytes.set([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  writeUint32LE(bytes, 20, width);
  writeUint32LE(bytes, 24, height);
  return bytes;
}

function dataUrl(mimeType, bytes) {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}

test("extracts dimensions from common embedded texture headers", () => {
  assert.deepEqual(textureDimensionsFromPayload("image/png", pngBytes()), { width: 3, height: 5 });
  assert.deepEqual(textureDimensionsFromPayload("image/jpeg", jpegBytes()), { width: 9, height: 7 });
  assert.deepEqual(textureDimensionsFromPayload("image/bmp", bmpBytes()), { width: 4, height: 6 });
  assert.deepEqual(textureDimensionsFromPayload("image/gif", gifBytes()), { width: 11, height: 13 });
  assert.deepEqual(textureDimensionsFromPayload("image/webp", webpVp8xBytes()), { width: 11, height: 13 });
  assert.deepEqual(textureDimensionsFromPayload("image/tiff", tiffBytes()), { width: 41, height: 43 });
  assert.deepEqual(textureDimensionsFromPayload("", tiffBytes(47, 49, false)), { width: 47, height: 49 });
  assert.deepEqual(textureDimensionsFromPayload("image/x-exr", exrBytes()), { width: 53, height: 59 });
  assert.deepEqual(textureDimensionsFromPayload("image/vnd.radiance", radianceHdrBytes()), { width: 61, height: 67 });
  assert.deepEqual(textureDimensionsFromPayload("image/avif", avifBytes()), { width: 71, height: 73 });
  assert.deepEqual(textureDimensionsFromPayload("image/heic", avifBytes(79, 83)), { width: 79, height: 83 });
  assert.deepEqual(textureDimensionsFromPayload("video/mp4", mp4VideoBytes()), { width: 89, height: 97 });
  assert.deepEqual(textureDimensionsFromPayload("video/quicktime", mp4VideoBytes(101, 103)), { width: 101, height: 103 });
  assert.deepEqual(textureDimensionsFromPayload("video/webm", webmVideoBytes()), { width: 131, height: 137 });
  assert.deepEqual(textureDimensionsFromPayload("video/ogg", oggTheoraBytes()), { width: 151, height: 157 });
  assert.deepEqual(textureDimensionsFromPayload("image/vnd-ms.dds", ddsBytes()), { width: 31, height: 37 });
  assert.deepEqual(textureDimensionsFromPayload("image/ktx", ktx1Bytes()), { width: 17, height: 19 });
  assert.deepEqual(textureDimensionsFromPayload("image/ktx2", ktx2Bytes()), { width: 23, height: 29 });
});

test("extracts richer media metadata without changing the dimensions API", () => {
  assert.deepEqual(textureMediaInfoFromPayload("video/mp4", mp4VideoBytes(113, 127, 30)), {
    width: 113,
    height: 127,
    frameRate: 30,
    frameCount: 30,
    duration: 1,
    stopFrame: 30,
    lastFrame: 30
  });
  assert.deepEqual(textureMediaInfoFromPayload("video/quicktime", mp4VideoBytes(101, 103, 24)), {
    width: 101,
    height: 103,
    frameRate: 24,
    frameCount: 30,
    duration: 1.25,
    stopFrame: 30,
    lastFrame: 30
  });
  assert.deepEqual(textureDimensionsFromPayload("video/webm", webmVideoBytes(131, 137, 25)), {
    width: 131,
    height: 137
  });
  assert.deepEqual(textureMediaInfoFromPayload("video/webm", webmVideoBytes(131, 137, 25)), {
    width: 131,
    height: 137,
    frameRate: 25,
    duration: 1.2,
    frameCount: 30,
    stopFrame: 30,
    lastFrame: 30
  });
  assert.deepEqual(textureMediaInfoFromPayload("application/ogg", oggTheoraBytes(151, 157, 24)), {
    width: 151,
    height: 157,
    frameRate: 24
  });
});

test("decodes data URL payload dimensions and file extensions", () => {
  const payload = dataUrlToTexturePayload(dataUrl("image/gif", gifBytes()));

  assert.equal(payload.mimeType, "image/gif");
  assert.equal(payload.extension, "gif");
  assert.equal(payload.width, 11);
  assert.equal(payload.height, 13);
  assert.equal(extensionForMime("image/webp"), "webp");
  assert.equal(extensionForMime("image/avif"), "avif");
  assert.equal(extensionForMime("image/svg+xml"), "svg");
  assert.equal(extensionForMime("image/tiff"), "tiff");
  assert.equal(extensionForMime("image/x-exr"), "exr");
  assert.equal(extensionForMime("image/openexr"), "exr");
  assert.equal(extensionForMime("image/x-hdr"), "hdr");
  assert.equal(extensionForMime("image/vnd-ms.dds"), "dds");
  assert.equal(extensionForMime("image/ktx2"), "ktx2");
  assert.equal(extensionForMime("video/mp4"), "mp4");
  assert.equal(extensionForMime("video/quicktime"), "mov");
  assert.equal(extensionForMime("video/webm"), "webm");
  assert.equal(extensionForMime("application/ogg"), "ogv");
});

test("decodes text data URLs for vector texture payloads", () => {
  const payload = dataUrlToTexturePayload("data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%201%201%22%2F%3E");

  assert.equal(payload.mimeType, "image/svg+xml");
  assert.equal(payload.extension, "svg");
  assert.equal(new TextDecoder().decode(payload.content), '<svg viewBox="0 0 1 1"/>');
});

test("decodes video data URLs with media file extensions", () => {
  const bytes = mp4VideoBytes(113, 127, 30);
  const payload = dataUrlToTexturePayload(dataUrl("video/mp4", bytes));

  assert.equal(payload.mimeType, "video/mp4");
  assert.equal(payload.extension, "mp4");
  assert.equal(payload.width, 113);
  assert.equal(payload.height, 127);
  assert.equal(payload.frameRate, 30);
  assert.equal(payload.frameCount, 30);
  assert.equal(payload.duration, 1);
  assert.equal(payload.stopFrame, 30);
  assert.equal(payload.lastFrame, 30);
  assert.deepEqual(Array.from(payload.content), Array.from(bytes));

  const webmPayload = dataUrlToTexturePayload(dataUrl("video/webm", webmVideoBytes(139, 149, 25)));
  assert.equal(webmPayload.mimeType, "video/webm");
  assert.equal(webmPayload.extension, "webm");
  assert.equal(webmPayload.width, 139);
  assert.equal(webmPayload.height, 149);
  assert.equal(webmPayload.frameRate, 25);
  assert.equal(webmPayload.duration, 1.2);
  assert.equal(webmPayload.frameCount, 30);
  assert.equal(webmPayload.stopFrame, 30);
  assert.equal(webmPayload.lastFrame, 30);

  const oggPayload = dataUrlToTexturePayload(dataUrl("application/ogg", oggTheoraBytes(163, 167, 24)));
  assert.equal(oggPayload.mimeType, "application/ogg");
  assert.equal(oggPayload.extension, "ogv");
  assert.equal(oggPayload.width, 163);
  assert.equal(oggPayload.height, 167);
  assert.equal(oggPayload.frameRate, 24);
});
