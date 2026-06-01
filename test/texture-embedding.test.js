import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  BufferGeometry,
  DataTexture,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Scene,
  Texture
} from "three";
import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { createNodeTextureResolver } from "../src/node/node-texture-resolver.js";
import { dataUrlToTexturePayload, safeTextureFileName } from "../src/texture/texture-content.js";
import {
  arrayBufferFrom,
  blenderPath,
  blenderTestArgs,
  checkerTga,
  decode,
  hasBlender,
  withMockDocument
} from "./fbx-test-helpers.js";

function checkerDataUrl() {
  return `data:image/x-tga;base64,${Buffer.from(checkerTga()).toString("base64")}`;
}

function mp4Bytes(width = 320, height = 180, frameRate = 30) {
  return concatBytes(
    bmffBox("ftyp", asciiBytes("mp42"), Uint8Array.from([0, 0, 0, 0]), asciiBytes("mp42isom")),
    bmffBox("moov", bmffBox("trak", tkhdBox(width, height), mdiaTimingBox(frameRate)))
  );
}

function mp4DataUrl() {
  return `data:video/mp4;base64,${Buffer.from(mp4Bytes()).toString("base64")}`;
}

function writeUint32LE(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function writeUint16LE(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint16BE(bytes, offset, value) {
  bytes[offset] = (value >>> 8) & 0xff;
  bytes[offset + 1] = value & 0xff;
}

function writeUint24BE(bytes, offset, value) {
  bytes[offset] = (value >>> 16) & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = value & 0xff;
}

function writeUint32BE(bytes, offset, value) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
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

function byteBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
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
  writeUint16BE(bytes, 10, Math.ceil(width / 16));
  writeUint16BE(bytes, 12, Math.ceil(height / 16));
  writeUint24BE(bytes, 14, width);
  writeUint24BE(bytes, 17, height);
  writeUint32BE(bytes, 22, frameRate);
  writeUint32BE(bytes, 26, 1);
  return bytes;
}

function ktx2Bytes(width = 64, height = 32) {
  const bytes = new Uint8Array(68);
  bytes.set([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  writeUint32LE(bytes, 20, width);
  writeUint32LE(bytes, 24, height);
  return bytes;
}

function tiffBytes(width = 256, height = 128) {
  const bytes = new Uint8Array(38);
  bytes.set([0x49, 0x49], 0);
  writeUint16LE(bytes, 2, 42);
  writeUint32LE(bytes, 4, 8);
  writeUint16LE(bytes, 8, 2);
  writeTiffLongEntry(bytes, 10, 256, width);
  writeTiffLongEntry(bytes, 22, 257, height);
  return bytes;
}

function writeTiffLongEntry(bytes, offset, tag, value) {
  writeUint16LE(bytes, offset, tag);
  writeUint16LE(bytes, offset + 2, 4);
  writeUint32LE(bytes, offset + 4, 1);
  writeUint32LE(bytes, offset + 8, value);
}

function exrBytes(width = 96, height = 48) {
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

function radianceHdrBytes(width = 384, height = 192) {
  return asciiBytes(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`);
}

function avifBytes(width = 512, height = 256) {
  return concatBytes(
    bmffBox("ftyp", asciiBytes("avif"), Uint8Array.from([0, 0, 0, 0]), asciiBytes("avifmif1")),
    bmffFullBox("meta", bmffBox("iprp", bmffBox("ipco", ispeBox(width, height))))
  );
}

function webmBytes(width = 426, height = 240, frameRate = 25) {
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

function oggTheoraBytes(width = 854, height = 480, frameRate = 24) {
  return oggPage(theoraIdentificationPacket(width, height, frameRate));
}

function ddsBytes(width = 128, height = 64) {
  const bytes = new Uint8Array(128);
  bytes.set([0x44, 0x44, 0x53, 0x20], 0);
  writeUint32LE(bytes, 4, 124);
  writeUint32LE(bytes, 12, height);
  writeUint32LE(bytes, 16, width);
  return bytes;
}

function rawRgbaPixels() {
  return new Uint8Array([
    255, 0, 0, 255,
    0, 255, 0, 255,
    0, 0, 255, 128,
    255, 255, 255, 64
  ]);
}

function rawLuminanceAlphaPixels() {
  return new Uint8Array([
    32, 128,
    220, 64
  ]);
}

function dataUrlTextureScene() {
  return {
    name: "DataUrlTextureScene",
    meshes: [
      {
        name: "Quad",
        materials: [
          {
            name: "EmbeddedMaterial",
            diffuseTexture: {
              name: "embedded_checker",
              src: checkerDataUrl()
            }
          }
        ],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0]
        }
      }
    ]
  };
}

function videoDataUrlTextureScene() {
  return {
    name: "VideoDataUrlTextureScene",
    meshes: [
      {
        name: "Quad",
        materials: [
          {
            name: "VideoMaterial",
            diffuseTexture: {
              name: "embedded_video",
              src: mp4DataUrl(),
              videoWidth: 640,
              videoHeight: 360,
              playSpeed: 1,
              loop: true
            }
          }
        ],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0]
        }
      }
    ]
  };
}

function byteBackedVideoTextureScene() {
  return {
    name: "ByteBackedVideoTextureScene",
    meshes: [
      {
        name: "Quad",
        materials: [
          {
            name: "VideoMaterial",
            diffuseTexture: {
              name: "packed_video",
              mimeType: "video/mp4",
              content: mp4Bytes(),
              playSpeed: 0.5
            }
          }
        ],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0]
        }
      }
    ]
  };
}

function userDataByteBackedVideoTextureScene() {
  const scene = byteBackedVideoTextureScene();
  const texture = scene.meshes[0].materials[0].diffuseTexture;
  delete texture.mimeType;
  delete texture.content;
  texture.userData = {
    mimeType: "video/mp4",
    bytes: mp4Bytes()
  };
  return scene;
}

function byteBackedWebmTextureScene() {
  return {
    name: "ByteBackedWebmTextureScene",
    meshes: [
      {
        name: "Quad",
        materials: [
          {
            name: "WebmMaterial",
            diffuseTexture: {
              name: "packed_webm",
              mimeType: "video/webm",
              content: webmBytes(),
              playSpeed: 1.25
            }
          }
        ],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0]
        }
      }
    ]
  };
}

function byteBackedOggTextureScene() {
  return {
    name: "ByteBackedOggTextureScene",
    meshes: [
      {
        name: "Quad",
        materials: [
          {
            name: "OggMaterial",
            diffuseTexture: {
              name: "packed_ogv",
              mimeType: "application/ogg",
              content: oggTheoraBytes(),
              playSpeed: 0.75
            }
          }
        ],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0]
        }
      }
    ]
  };
}

function byteBackedKtxTextureScene() {
  return {
    name: "ByteBackedKtxTextureScene",
    meshes: [
      {
        name: "Quad",
        materials: [
          {
            name: "KtxMaterial",
            diffuseTexture: {
              name: "packed_basis",
              mimeType: "image/ktx2",
              content: ktx2Bytes()
            }
          }
        ],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0]
        }
      }
    ]
  };
}

function byteBackedTiffTextureScene() {
  return {
    name: "ByteBackedTiffTextureScene",
    meshes: [
      {
        name: "Quad",
        materials: [
          {
            name: "TiffMaterial",
            diffuseTexture: {
              name: "packed_scan",
              mimeType: "image/tiff",
              content: tiffBytes()
            }
          }
        ],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0]
        }
      }
    ]
  };
}

function byteBackedExrTextureScene() {
  return {
    name: "ByteBackedExrTextureScene",
    meshes: [
      {
        name: "Quad",
        materials: [
          {
            name: "ExrMaterial",
            diffuseTexture: {
              name: "packed_linear",
              mimeType: "image/openexr",
              content: exrBytes()
            }
          }
        ],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0]
        }
      }
    ]
  };
}

function byteBackedHdrTextureScene() {
  return {
    name: "ByteBackedHdrTextureScene",
    meshes: [
      {
        name: "Quad",
        materials: [
          {
            name: "HdrMaterial",
            diffuseTexture: {
              name: "packed_environment",
              mimeType: "image/vnd.radiance",
              content: radianceHdrBytes()
            }
          }
        ],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0]
        }
      }
    ]
  };
}

function byteBackedAvifTextureScene() {
  return {
    name: "ByteBackedAvifTextureScene",
    meshes: [
      {
        name: "Quad",
        materials: [
          {
            name: "AvifMaterial",
            diffuseTexture: {
              name: "packed_compressed",
              mimeType: "image/avif",
              content: avifBytes()
            }
          }
        ],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0]
        }
      }
    ]
  };
}

function byteBackedDdsTextureScene() {
  return {
    name: "ByteBackedDdsTextureScene",
    meshes: [
      {
        name: "Quad",
        materials: [
          {
            name: "DdsMaterial",
            diffuseTexture: {
              name: "packed_blocks",
              mimeType: "image/vnd-ms.dds",
              content: ddsBytes()
            }
          }
        ],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0]
        }
      }
    ]
  };
}

function fileBackedTextureScene() {
  return {
    name: "FileBackedTextureScene",
    meshes: [
      {
        name: "Quad",
        materials: [
          {
            name: "FileMaterial",
            diffuseTexture: "checker.tga"
          }
        ],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0]
        }
      }
    ]
  };
}

function userDataSourceTextureScene(assignSource) {
  const scene = fileBackedTextureScene();
  scene.name = "UserDataSourceTextureScene";
  scene.meshes[0].materials[0].diffuseTexture = { userData: {} };
  assignSource(scene.meshes[0].materials[0].diffuseTexture);
  return scene;
}

function fileBackedKtxTextureScene() {
  const scene = fileBackedTextureScene();
  scene.name = "FileBackedKtxTextureScene";
  scene.meshes[0].materials[0].diffuseTexture = "packed-basis.ktx2";
  return scene;
}

function fileBackedExrTextureScene() {
  const scene = fileBackedTextureScene();
  scene.name = "FileBackedExrTextureScene";
  scene.meshes[0].materials[0].diffuseTexture = "linear-pass.exr";
  return scene;
}

function rawImageTextureScene() {
  return {
    name: "RawImageTextureScene",
    meshes: [
      {
        name: "Quad",
        materials: [
          {
            name: "RawImageMaterial",
            diffuseTexture: {
              name: "raw_checker",
              image: {
                data: rawRgbaPixels(),
                width: 2,
                height: 2
              }
            }
          }
        ],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0]
        }
      }
    ]
  };
}

function userDataRawImageTextureScene() {
  const scene = rawImageTextureScene();
  const texture = scene.meshes[0].materials[0].diffuseTexture;
  delete texture.image;
  texture.name = "userdata_raw_checker";
  texture.userData = {
    image: {
      data: rawRgbaPixels(),
      width: 2,
      height: 2
    }
  };
  return scene;
}

function userDataSourceRawImageTextureScene() {
  const scene = rawImageTextureScene();
  const texture = scene.meshes[0].materials[0].diffuseTexture;
  delete texture.image;
  texture.name = "userdata_source_raw_checker";
  texture.userData = {
    source: {
      data: rawRgbaPixels(),
      width: 2,
      height: 2
    }
  };
  return scene;
}

function rawLuminanceAlphaTextureScene() {
  const scene = rawImageTextureScene();
  const texture = scene.meshes[0].materials[0].diffuseTexture;
  texture.name = "raw_luma_alpha";
  texture.image = {
    data: rawLuminanceAlphaPixels(),
    width: 2,
    height: 1,
    channels: 2
  };
  return scene;
}

function threeTexturedScene() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0,
    -1, 1, 0
  ], 3));
  geometry.setAttribute("normal", new Float32BufferAttribute([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1
  ], 3));
  geometry.setAttribute("uv", new Float32BufferAttribute([
    0, 0,
    1, 0,
    1, 1,
    0, 1
  ], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);

  const texture = new Texture({ src: checkerDataUrl(), name: "checker_image" });
  texture.name = "embedded_checker";

  const material = new MeshBasicMaterial({ name: "EmbeddedMaterial" });
  material.map = texture;

  const scene = new Scene();
  scene.name = "ThreeDataUrlTextureScene";
  const mesh = new Mesh(geometry, material);
  mesh.name = "Quad";
  scene.add(mesh);
  return scene;
}

function threeFileBackedTextureScene() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0,
    -1, 1, 0
  ], 3));
  geometry.setAttribute("normal", new Float32BufferAttribute([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1
  ], 3));
  geometry.setAttribute("uv", new Float32BufferAttribute([
    0, 0,
    1, 0,
    1, 1,
    0, 1
  ], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);

  const texture = new Texture({ src: "checker.tga", name: "checker_image" });
  texture.name = "checker";
  texture.userData.relativeFileName = "checker.tga";

  const material = new MeshBasicMaterial({ name: "FileMaterial" });
  material.map = texture;

  const scene = new Scene();
  scene.name = "ThreeFileBackedTextureScene";
  const mesh = new Mesh(geometry, material);
  mesh.name = "Quad";
  scene.add(mesh);
  return scene;
}

function threeCurrentSrcTextureScene() {
  const scene = threeFileBackedTextureScene();
  scene.name = "ThreeCurrentSrcTextureScene";
  const texture = scene.getObjectByName("Quad").material.map;
  texture.name = "";
  texture.image = {
    currentSrc: "textures/current-checker.tga",
    naturalWidth: 16,
    naturalHeight: 8
  };
  texture.userData = {};
  return scene;
}

function threeSourceAliasTextureScene(assignSource) {
  const scene = threeTexturedScene();
  scene.name = "ThreeSourceAliasTextureScene";
  const texture = new Texture();
  assignSource(texture);
  scene.getObjectByName("Quad").material.map = texture;
  return scene;
}

function threeDataTextureScene() {
  const scene = threeTexturedScene();
  scene.name = "ThreeDataTextureScene";
  const texture = new DataTexture(rawRgbaPixels(), 2, 2);
  texture.name = "raw_checker";
  scene.getObjectByName("Quad").material.map = texture;
  return scene;
}

function threeUserDataRawImageTextureScene() {
  const scene = threeTexturedScene();
  scene.name = "ThreeUserDataRawImageTextureScene";
  const texture = new Texture();
  texture.name = "three_userdata_raw_checker";
  texture.userData.image = {
    data: rawRgbaPixels(),
    width: 2,
    height: 2
  };
  scene.getObjectByName("Quad").material.map = texture;
  return scene;
}

function threeUserDataSourceRawImageTextureScene() {
  const scene = threeTexturedScene();
  scene.name = "ThreeUserDataSourceRawImageTextureScene";
  const texture = new Texture();
  texture.name = "three_userdata_source_raw_checker";
  texture.userData.source = {
    data: rawRgbaPixels(),
    width: 2,
    height: 2
  };
  scene.getObjectByName("Quad").material.map = texture;
  return scene;
}

function threeUserDataSourceCanvasTextureScene() {
  const scene = threeTexturedScene();
  scene.name = "ThreeUserDataSourceCanvasTextureScene";
  const texture = new Texture();
  texture.name = "canvas_checker";
  texture.userData.source = {
    name: "userdata_source_canvas",
    toDataURL() {
      return checkerDataUrl();
    }
  };
  scene.getObjectByName("Quad").material.map = texture;
  return scene;
}

function threeByteBackedVideoTextureScene() {
  const scene = threeTexturedScene();
  scene.name = "ThreeByteBackedVideoTextureScene";
  const texture = new Texture();
  texture.name = "packed_video";
  texture.userData.content = mp4Bytes();
  texture.userData.mimeType = "video/mp4";
  texture.userData.videoWidth = 320;
  texture.userData.videoHeight = 180;
  texture.userData.playSpeed = 0.5;
  scene.getObjectByName("Quad").material.map = texture;
  return scene;
}

function threeByteAliasVideoTextureScene(assignContent) {
  const scene = threeTexturedScene();
  scene.name = "ThreeByteAliasVideoTextureScene";
  const texture = new Texture();
  texture.name = "packed_alias_video";
  assignContent(texture, byteBuffer(webmBytes()));
  texture.userData.playSpeed = 1.5;
  scene.getObjectByName("Quad").material.map = texture;
  return scene;
}

function threeLuminanceAlphaDataTextureScene() {
  const scene = threeTexturedScene();
  scene.name = "ThreeLuminanceAlphaTextureScene";
  const texture = new DataTexture(rawLuminanceAlphaPixels(), 2, 1);
  texture.name = "raw_luma_alpha";
  scene.getObjectByName("Quad").material.map = texture;
  return scene;
}

test("decodes texture data URLs into embeddable bytes", () => {
  const payload = dataUrlToTexturePayload(checkerDataUrl());

  assert.equal(payload.mimeType, "image/x-tga");
  assert.equal(payload.extension, "tga");
  assert.deepEqual(Array.from(payload.content), Array.from(checkerTga()));
  assert.equal(safeTextureFileName("embedded_checker", payload.extension), "embedded_checker.tga");
});

test("normalizes data URL textures as packed FBX video content", () => {
  const scene = normalizeFbxScene(dataUrlTextureScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.fileName, "embedded_checker.tga");
  assert.equal(texture.relativeFileName, "embedded_checker.tga");
  assert.equal(texture.mimeType, "image/x-tga");
  assert.deepEqual(Array.from(texture.content), Array.from(checkerTga()));

  const text = decode(exportFbx(scene));
  assert.match(text, /embedded_checker\.tga/);
  assert.match(text, /Content/);
  assert.doesNotMatch(text, /data:image/);
});

test("normalizes video data URL textures with media filenames", () => {
  const scene = normalizeFbxScene(videoDataUrlTextureScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.fileName, "embedded_video.mp4");
  assert.equal(texture.relativeFileName, "embedded_video.mp4");
  assert.equal(texture.mimeType, "video/mp4");
  assert.equal(texture.width, 640);
  assert.equal(texture.height, 360);
  assert.equal(texture.frameRate, 30);
  assert.equal(texture.frameCount, 30);
  assert.equal(texture.stopFrame, 30);
  assert.equal(texture.lastFrame, 30);
  assert.equal(texture.playSpeed, 1);
  assert.equal(texture.loop, true);
  assert.deepEqual(Array.from(texture.content), Array.from(mp4Bytes()));

  const text = decode(exportFbx(scene));
  assert.match(text, /embedded_video\.mp4/);
  assert.match(text, /Content/);
  assert.match(text, /StopFrame/);
  assert.match(text, /LastFrame/);
  assert.doesNotMatch(text, /data:video/);
  assert.doesNotMatch(text, /embedded_video\.bin/);
});

test("normalizes byte-backed video textures with MIME-derived media filenames", () => {
  const scene = normalizeFbxScene(byteBackedVideoTextureScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.fileName, "packed_video.mp4");
  assert.equal(texture.relativeFileName, "packed_video.mp4");
  assert.equal(texture.mimeType, "video/mp4");
  assert.equal(texture.width, 320);
  assert.equal(texture.height, 180);
  assert.equal(texture.frameRate, 30);
  assert.equal(texture.frameCount, 30);
  assert.equal(texture.stopFrame, 30);
  assert.equal(texture.lastFrame, 30);
  assert.equal(texture.accessMode, 1);
  assert.equal(texture.playSpeed, 0.5);
  assert.deepEqual(Array.from(texture.content), Array.from(mp4Bytes()));

  const text = decode(exportFbx(scene));
  assert.match(text, /packed_video\.mp4/);
  assert.match(text, /Content/);
  assert.doesNotMatch(text, /packed_video\.bin/);
});

test("normalizes internal userData byte-backed video textures", () => {
  const scene = normalizeFbxScene(userDataByteBackedVideoTextureScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.fileName, "packed_video.mp4");
  assert.equal(texture.relativeFileName, "packed_video.mp4");
  assert.equal(texture.mimeType, "video/mp4");
  assert.equal(texture.width, 320);
  assert.equal(texture.height, 180);
  assert.equal(texture.frameRate, 30);
  assert.equal(texture.frameCount, 30);
  assert.equal(texture.accessMode, 1);
  assert.equal(texture.playSpeed, 0.5);
  assert.deepEqual(Array.from(texture.content), Array.from(mp4Bytes()));
});

test("normalizes nested internal userData byte-backed video textures", () => {
  const scene = normalizeFbxScene(userDataSourceTextureScene((texture) => {
    texture.userData.name = "nested_user_video";
    texture.userData.source = {
      data: {
        bytes: mp4Bytes(),
        mimeType: "video/mp4",
        playSpeed: 0.75
      }
    };
  }));
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.fileName, "nested_user_video.mp4");
  assert.equal(texture.relativeFileName, "nested_user_video.mp4");
  assert.equal(texture.mimeType, "video/mp4");
  assert.equal(texture.width, 320);
  assert.equal(texture.height, 180);
  assert.equal(texture.frameRate, 30);
  assert.equal(texture.frameCount, 30);
  assert.equal(texture.accessMode, 1);
  assert.equal(texture.playSpeed, 0.75);
  assert.deepEqual(Array.from(texture.content), Array.from(mp4Bytes()));
});

test("normalizes byte-backed WebM textures with header-derived dimensions", () => {
  const scene = normalizeFbxScene(byteBackedWebmTextureScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.fileName, "packed_webm.webm");
  assert.equal(texture.relativeFileName, "packed_webm.webm");
  assert.equal(texture.mimeType, "video/webm");
  assert.equal(texture.width, 426);
  assert.equal(texture.height, 240);
  assert.equal(texture.frameRate, 25);
  assert.equal(texture.frameCount, 30);
  assert.equal(texture.stopFrame, 30);
  assert.equal(texture.lastFrame, 30);
  assert.equal(texture.accessMode, 1);
  assert.equal(texture.playSpeed, 1.25);
  assert.deepEqual(Array.from(texture.content), Array.from(webmBytes()));

  const text = decode(exportFbx(scene));
  assert.match(text, /packed_webm\.webm/);
  assert.match(text, /Content/);
  assert.doesNotMatch(text, /packed_webm\.bin/);
});

test("normalizes byte-backed Ogg Theora textures with header-derived dimensions", () => {
  const scene = normalizeFbxScene(byteBackedOggTextureScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.fileName, "packed_ogv.ogv");
  assert.equal(texture.relativeFileName, "packed_ogv.ogv");
  assert.equal(texture.mimeType, "application/ogg");
  assert.equal(texture.width, 854);
  assert.equal(texture.height, 480);
  assert.equal(texture.frameRate, 24);
  assert.equal(texture.accessMode, 1);
  assert.equal(texture.playSpeed, 0.75);
  assert.deepEqual(Array.from(texture.content), Array.from(oggTheoraBytes()));

  const text = decode(exportFbx(scene));
  assert.match(text, /packed_ogv\.ogv/);
  assert.match(text, /Content/);
  assert.doesNotMatch(text, /packed_ogv\.bin/);
});

test("normalizes byte-backed GPU texture payloads with MIME-derived filenames", () => {
  const scene = normalizeFbxScene(byteBackedKtxTextureScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.fileName, "packed_basis.ktx2");
  assert.equal(texture.relativeFileName, "packed_basis.ktx2");
  assert.equal(texture.mimeType, "image/ktx2");
  assert.equal(texture.width, 64);
  assert.equal(texture.height, 32);
  assert.equal(texture.accessMode, 1);
  assert.deepEqual(Array.from(texture.content.slice(0, 4)), [0xab, 0x4b, 0x54, 0x58]);

  const text = decode(exportFbx(scene));
  assert.match(text, /packed_basis\.ktx2/);
  assert.match(text, /Content/);
  assert.doesNotMatch(text, /packed_basis\.bin/);
});

test("normalizes byte-backed DDS payloads with media dimensions", () => {
  const scene = normalizeFbxScene(byteBackedDdsTextureScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.fileName, "packed_blocks.dds");
  assert.equal(texture.relativeFileName, "packed_blocks.dds");
  assert.equal(texture.mimeType, "image/vnd-ms.dds");
  assert.equal(texture.width, 128);
  assert.equal(texture.height, 64);
  assert.equal(texture.accessMode, 1);
  assert.deepEqual(Array.from(texture.content.slice(0, 4)), [0x44, 0x44, 0x53, 0x20]);
});

test("normalizes byte-backed TIFF and EXR payloads with media dimensions", () => {
  const tiffScene = normalizeFbxScene(byteBackedTiffTextureScene());
  const tiffTexture = tiffScene.meshes[0].materials[0].diffuseTexture;

  assert.equal(tiffTexture.fileName, "packed_scan.tiff");
  assert.equal(tiffTexture.relativeFileName, "packed_scan.tiff");
  assert.equal(tiffTexture.mimeType, "image/tiff");
  assert.equal(tiffTexture.width, 256);
  assert.equal(tiffTexture.height, 128);
  assert.equal(tiffTexture.accessMode, 1);

  const exrScene = normalizeFbxScene(byteBackedExrTextureScene());
  const exrTexture = exrScene.meshes[0].materials[0].diffuseTexture;

  assert.equal(exrTexture.fileName, "packed_linear.exr");
  assert.equal(exrTexture.relativeFileName, "packed_linear.exr");
  assert.equal(exrTexture.mimeType, "image/openexr");
  assert.equal(exrTexture.width, 96);
  assert.equal(exrTexture.height, 48);
  assert.equal(exrTexture.accessMode, 1);
});

test("normalizes byte-backed HDR and AVIF payloads with media dimensions", () => {
  const hdrScene = normalizeFbxScene(byteBackedHdrTextureScene());
  const hdrTexture = hdrScene.meshes[0].materials[0].diffuseTexture;

  assert.equal(hdrTexture.fileName, "packed_environment.hdr");
  assert.equal(hdrTexture.relativeFileName, "packed_environment.hdr");
  assert.equal(hdrTexture.mimeType, "image/vnd.radiance");
  assert.equal(hdrTexture.width, 384);
  assert.equal(hdrTexture.height, 192);
  assert.equal(hdrTexture.accessMode, 1);

  const avifScene = normalizeFbxScene(byteBackedAvifTextureScene());
  const avifTexture = avifScene.meshes[0].materials[0].diffuseTexture;

  assert.equal(avifTexture.fileName, "packed_compressed.avif");
  assert.equal(avifTexture.relativeFileName, "packed_compressed.avif");
  assert.equal(avifTexture.mimeType, "image/avif");
  assert.equal(avifTexture.width, 512);
  assert.equal(avifTexture.height, 256);
  assert.equal(avifTexture.accessMode, 1);
});

test("resolves file-backed GPU texture MIME hints", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const content = ktx2Bytes();
  await writeFile(join(tempDir, "packed-basis.ktx2"), content);

  try {
    const scene = normalizeFbxScene(fileBackedKtxTextureScene(), {
      resolveTextureContent: createNodeTextureResolver({ baseDir: tempDir })
    });
    const texture = scene.meshes[0].materials[0].diffuseTexture;

    assert.equal(texture.fileName, "packed-basis.ktx2");
    assert.equal(texture.mimeType, "image/ktx2");
    assert.equal(texture.width, 64);
    assert.equal(texture.height, 32);
    assert.deepEqual(Array.from(texture.content), Array.from(content));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("resolves file-backed EXR texture dimensions", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const content = exrBytes();
  await writeFile(join(tempDir, "linear-pass.exr"), content);

  try {
    const scene = normalizeFbxScene(fileBackedExrTextureScene(), {
      resolveTextureContent: createNodeTextureResolver({ baseDir: tempDir })
    });
    const texture = scene.meshes[0].materials[0].diffuseTexture;

    assert.equal(texture.fileName, "linear-pass.exr");
    assert.equal(texture.mimeType, "image/x-exr");
    assert.equal(texture.width, 96);
    assert.equal(texture.height, 48);
    assert.deepEqual(Array.from(texture.content), Array.from(content));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("normalizes raw image textures as embedded TGA content", () => {
  const scene = normalizeFbxScene(rawImageTextureScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.fileName, "raw_checker.tga");
  assert.equal(texture.relativeFileName, "raw_checker.tga");
  assert.equal(texture.mimeType, "image/x-tga");
  assert.equal(texture.width, 2);
  assert.equal(texture.height, 2);
  assert.equal(texture.content[2], 2);
  assert.equal(texture.content[16], 32);
  assert.equal(texture.content[17], 0x28);
  assert.deepEqual(Array.from(texture.content.slice(18, 22)), [0, 0, 255, 255]);

  const text = decode(exportFbx(scene));
  assert.match(text, /raw_checker\.tga/);
  assert.match(text, /Content/);
});

test("normalizes nested userData raw image textures as embedded TGA content", () => {
  const scene = normalizeFbxScene(userDataRawImageTextureScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.fileName, "userdata_raw_checker.tga");
  assert.equal(texture.relativeFileName, "userdata_raw_checker.tga");
  assert.equal(texture.mimeType, "image/x-tga");
  assert.equal(texture.width, 2);
  assert.equal(texture.height, 2);
  assert.deepEqual(Array.from(texture.content.slice(18, 22)), [0, 0, 255, 255]);
});

test("normalizes userData source raw image textures as embedded TGA content", () => {
  const scene = normalizeFbxScene(userDataSourceRawImageTextureScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.fileName, "userdata_source_raw_checker.tga");
  assert.equal(texture.relativeFileName, "userdata_source_raw_checker.tga");
  assert.equal(texture.mimeType, "image/x-tga");
  assert.equal(texture.width, 2);
  assert.equal(texture.height, 2);
  assert.deepEqual(Array.from(texture.content.slice(18, 22)), [0, 0, 255, 255]);
});

test("normalizes raw luminance-alpha textures as embedded RGBA TGA content", () => {
  const scene = normalizeFbxScene(rawLuminanceAlphaTextureScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.fileName, "raw_luma_alpha.tga");
  assert.equal(texture.width, 2);
  assert.equal(texture.height, 1);
  assert.equal(texture.content[16], 32);
  assert.equal(texture.content[17], 0x28);
  assert.deepEqual(Array.from(texture.content.slice(18, 26)), [
    32, 32, 32, 128,
    220, 220, 220, 64
  ]);
});

test("adapts Three.js data URL textures into embedded texture content", async () => {
  const scene = fromThreeObject(threeTexturedScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.fileName, "embedded_checker.tga");
  assert.equal(texture.relativeFileName, "embedded_checker.tga");
  assert.deepEqual(Array.from(texture.content), Array.from(checkerTga()));

  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(threeTexturedScene())), "");
    const mesh = group.getObjectByName("Quad");
    assert.ok(mesh.material.map);
    assert.equal(mesh.material.map.name, "embedded_checker");
  });
});

test("adapts Three.js DataTexture images into embedded TGA content", () => {
  const scene = fromThreeObject(threeDataTextureScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.fileName, "raw_checker.tga");
  assert.equal(texture.relativeFileName, "raw_checker.tga");
  assert.equal(texture.mimeType, "image/x-tga");
  assert.equal(texture.width, 2);
  assert.equal(texture.height, 2);
  assert.deepEqual(Array.from(texture.content.slice(18, 22)), [0, 0, 255, 255]);
});

test("adapts Three.js nested userData raw image textures into embedded TGA content", () => {
  const scene = fromThreeObject(threeUserDataRawImageTextureScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.fileName, "three_userdata_raw_checker.tga");
  assert.equal(texture.relativeFileName, "three_userdata_raw_checker.tga");
  assert.equal(texture.mimeType, "image/x-tga");
  assert.equal(texture.width, 2);
  assert.equal(texture.height, 2);
  assert.deepEqual(Array.from(texture.content.slice(18, 22)), [0, 0, 255, 255]);
});

test("adapts Three.js userData source raw image textures into embedded TGA content", () => {
  const scene = fromThreeObject(threeUserDataSourceRawImageTextureScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.fileName, "three_userdata_source_raw_checker.tga");
  assert.equal(texture.relativeFileName, "three_userdata_source_raw_checker.tga");
  assert.equal(texture.mimeType, "image/x-tga");
  assert.equal(texture.width, 2);
  assert.equal(texture.height, 2);
  assert.deepEqual(Array.from(texture.content.slice(18, 22)), [0, 0, 255, 255]);
});

test("adapts Three.js userData source canvas data URLs into embedded content", () => {
  const scene = fromThreeObject(threeUserDataSourceCanvasTextureScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.name, "canvas_checker");
  assert.equal(texture.fileName, "canvas_checker.tga");
  assert.equal(texture.relativeFileName, "canvas_checker.tga");
  assert.equal(texture.mimeType, "image/x-tga");
  assert.deepEqual(Array.from(texture.content), Array.from(checkerTga()));

  const text = decode(exportFbx(scene));
  assert.match(text, /canvas_checker\.tga/);
  assert.match(text, /Content/);
  assert.doesNotMatch(text, /data:image/);
});

test("adapts two-channel Three.js DataTexture images into embedded RGBA TGA content", () => {
  const scene = fromThreeObject(threeLuminanceAlphaDataTextureScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.fileName, "raw_luma_alpha.tga");
  assert.equal(texture.width, 2);
  assert.equal(texture.height, 1);
  assert.deepEqual(Array.from(texture.content.slice(18, 26)), [
    32, 32, 32, 128,
    220, 220, 220, 64
  ]);
});

test("adapts Three.js byte-backed video textures with MIME-derived filenames", () => {
  const scene = fromThreeObject(threeByteBackedVideoTextureScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.fileName, "packed_video.mp4");
  assert.equal(texture.relativeFileName, "packed_video.mp4");
  assert.equal(texture.mimeType, "video/mp4");
  assert.equal(texture.width, 320);
  assert.equal(texture.height, 180);
  assert.equal(texture.frameRate, 30);
  assert.equal(texture.frameCount, 30);
  assert.equal(texture.stopFrame, 30);
  assert.equal(texture.lastFrame, 30);
  assert.equal(texture.playSpeed, 0.5);
  assert.deepEqual(Array.from(texture.content), Array.from(mp4Bytes()));
});

test("adapts Three.js byte alias video textures with parsed media metadata", () => {
  const variants = [
    ["userData.bytes", (texture, bytes) => {
      texture.userData.bytes = bytes;
      texture.userData.mimeType = "video/webm";
    }],
    ["userData.image.content", (texture, bytes) => {
      texture.userData.image = { content: bytes, mimeType: "video/webm" };
    }],
    ["userData.source.data.bytes", (texture, bytes) => {
      texture.userData.source = { data: { bytes, mimeType: "video/webm" } };
    }],
    ["texture.data", (texture, bytes) => {
      texture.data = bytes;
      texture.mimeType = "video/webm";
    }]
  ];

  for (const [label, assignContent] of variants) {
    const scene = fromThreeObject(threeByteAliasVideoTextureScene(assignContent));
    const texture = scene.meshes[0].materials[0].diffuseTexture;

    assert.equal(texture.fileName, "packed_alias_video.webm", label);
    assert.equal(texture.relativeFileName, "packed_alias_video.webm", label);
    assert.equal(texture.mimeType, "video/webm", label);
    assert.equal(texture.width, 426, label);
    assert.equal(texture.height, 240, label);
    assert.equal(texture.frameRate, 25, label);
    assert.equal(texture.frameCount, 30, label);
    assert.equal(texture.stopFrame, 30, label);
    assert.equal(texture.lastFrame, 30, label);
    assert.equal(texture.playSpeed, 1.5, label);
    assert.deepEqual(Array.from(texture.content), Array.from(webmBytes()), label);
  }
});

test("resolves file-backed texture bytes through an exporter option", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  await writeFile(join(tempDir, "checker.tga"), checkerTga());

  try {
    const resolveTextureContent = createNodeTextureResolver({ baseDir: tempDir });
    const scene = normalizeFbxScene(fileBackedTextureScene(), { resolveTextureContent });
    const texture = scene.meshes[0].materials[0].diffuseTexture;

    assert.equal(texture.fileName, "checker.tga");
    assert.equal(texture.mimeType, "image/x-tga");
    assert.deepEqual(Array.from(texture.content), Array.from(checkerTga()));

    const text = decode(exportFbx(fileBackedTextureScene(), { resolveTextureContent }));
    assert.match(text, /Content/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("normalizes internal userData texture source aliases", () => {
  const variants = [
    ["userData.path", "textures/internal-path.tga", (texture, path) => {
      texture.userData.path = path;
    }],
    ["userData.url", "textures/internal-url.tga", (texture, path) => {
      texture.userData.url = path;
    }],
    ["userData.image.currentSrc", "textures/internal-user-image.tga", (texture, path) => {
      texture.userData.image = { currentSrc: path };
    }],
    ["userData.source.data.href", "textures/internal-user-source.tga", (texture, path) => {
      texture.userData.source = { data: { href: path } };
    }],
    ["top-level href", "textures/internal-href.tga", (texture, path) => {
      texture.href = path;
      texture.relativeUrl = "packed/internal-href.tga";
    }],
    ["userData.relativeFileName", "textures/internal-user-relative.tga", (texture, path) => {
      texture.userData.relativeFileName = path;
    }],
    ["userData.source.data.relativePath", "textures/internal-source-relative.tga", (texture, path) => {
      texture.userData.source = { data: { relativePath: path } };
    }],
    ["top-level relativePath", "textures/internal-direct-relative.tga", (texture, path) => {
      texture.relativePath = path;
    }]
  ];

  for (const [label, path, assignSource] of variants) {
    const scene = normalizeFbxScene(userDataSourceTextureScene((texture) => assignSource(texture, path)));
    const texture = scene.meshes[0].materials[0].diffuseTexture;
    const expectedRelative = label === "top-level href" ? "packed/internal-href.tga" : path;

    assert.equal(texture.name, path.split("/").pop().replace(/\.tga$/, ""), label);
    assert.equal(texture.fileName, path, label);
    assert.equal(texture.relativeFileName, expectedRelative, label);
  }
});

test("resolves internal relative texture source aliases", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  await writeFile(join(tempDir, "relative-checker.tga"), checkerTga());
  await writeFile(join(tempDir, "nested-checker.tga"), checkerTga());

  try {
    const scene = normalizeFbxScene(userDataSourceTextureScene((texture) => {
      texture.relativeFileName = "relative-checker.tga";
    }), {
      resolveTextureContent: createNodeTextureResolver({ baseDir: tempDir })
    });
    const texture = scene.meshes[0].materials[0].diffuseTexture;

    assert.equal(texture.fileName, "relative-checker.tga");
    assert.equal(texture.relativeFileName, "relative-checker.tga");
    assert.equal(texture.mimeType, "image/x-tga");
    assert.deepEqual(Array.from(texture.content), Array.from(checkerTga()));

    const nestedScene = normalizeFbxScene(userDataSourceTextureScene((texture) => {
      texture.userData.source = { data: { currentSrc: "nested-checker.tga" } };
    }), {
      resolveTextureContent: createNodeTextureResolver({ baseDir: tempDir })
    });
    const nestedTexture = nestedScene.meshes[0].materials[0].diffuseTexture;

    assert.equal(nestedTexture.fileName, "nested-checker.tga");
    assert.equal(nestedTexture.mimeType, "image/x-tga");
    assert.deepEqual(Array.from(nestedTexture.content), Array.from(checkerTga()));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("normalizes internal userData data URL texture sources", () => {
  const scene = normalizeFbxScene(userDataSourceTextureScene((texture) => {
    texture.userData.name = "internal_userdata_checker";
    texture.userData.src = checkerDataUrl();
  }));
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.name, "internal_userdata_checker");
  assert.equal(texture.fileName, "internal_userdata_checker.tga");
  assert.equal(texture.relativeFileName, "internal_userdata_checker.tga");
  assert.equal(texture.mimeType, "image/x-tga");
  assert.deepEqual(Array.from(texture.content), Array.from(checkerTga()));
});

test("normalizes nested userData image data URL texture sources", () => {
  const scene = normalizeFbxScene(userDataSourceTextureScene((texture) => {
    texture.userData.name = "internal_userdata_image_checker";
    texture.userData.image = {
      currentSrc: checkerDataUrl()
    };
  }));
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.name, "internal_userdata_image_checker");
  assert.equal(texture.fileName, "internal_userdata_image_checker.tga");
  assert.equal(texture.relativeFileName, "internal_userdata_image_checker.tga");
  assert.equal(texture.mimeType, "image/x-tga");
  assert.deepEqual(Array.from(texture.content), Array.from(checkerTga()));
});

test("normalizes internal relative data URL texture sources", () => {
  const scene = normalizeFbxScene(userDataSourceTextureScene((texture) => {
    texture.userData.name = "internal_relative_checker";
    texture.userData.relativeFileName = checkerDataUrl();
  }));
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.name, "internal_relative_checker");
  assert.equal(texture.fileName, "internal_relative_checker.tga");
  assert.equal(texture.relativeFileName, "internal_relative_checker.tga");
  assert.equal(texture.mimeType, "image/x-tga");
  assert.deepEqual(Array.from(texture.content), Array.from(checkerTga()));
});

test("resolves Three.js file-backed textures during export", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  await writeFile(join(tempDir, "checker.tga"), checkerTga());

  try {
    const bytes = exportFbx(threeFileBackedTextureScene(), {
      resolveTextureContent: createNodeTextureResolver({ baseDir: tempDir })
    });
    const text = decode(bytes);

    assert.match(text, /checker\.tga/);
    assert.match(text, /Content/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("uses Three.js image currentSrc for file-backed texture export", () => {
  let resolvedContext = null;
  const scene = fromThreeObject(threeCurrentSrcTextureScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.name, "current-checker");
  assert.equal(texture.fileName, "textures/current-checker.tga");
  assert.equal(texture.relativeFileName, "textures/current-checker.tga");
  assert.equal(texture.width, 16);
  assert.equal(texture.height, 8);

  const bytes = exportFbx(threeCurrentSrcTextureScene(), {
    resolveTextureContent(fileName, context) {
      resolvedContext = context;
      assert.equal(fileName, "textures/current-checker.tga");
      return checkerTga();
    }
  });

  assert.equal(resolvedContext.relativeFileName, "textures/current-checker.tga");
  const text = decode(bytes);
  assert.match(text, /textures\/current-checker\.tga/);
  assert.match(text, /Content/);
});

test("uses Three.js source data currentSrc as an unnamed texture source", () => {
  const source = threeCurrentSrcTextureScene();
  const texture = source.getObjectByName("Quad").material.map;
  texture.image = {};
  texture.source = {
    data: {
      currentSrc: "source-data-checker.tga",
      naturalWidth: 4,
      naturalHeight: 6
    }
  };

  const scene = fromThreeObject(source);
  const exportedTexture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(exportedTexture.name, "source-data-checker");
  assert.equal(exportedTexture.fileName, "source-data-checker.tga");
  assert.equal(exportedTexture.relativeFileName, "source-data-checker.tga");
  assert.equal(exportedTexture.width, 4);
  assert.equal(exportedTexture.height, 6);
});

test("uses Three.js top-level and userData texture source aliases", () => {
  const variants = [
    ["texture.src", "textures/direct-src.tga", (texture, path) => {
      texture.src = path;
    }],
    ["texture.userData.path", "textures/user-path.tga", (texture, path) => {
      texture.userData.path = path;
    }],
    ["texture.userData.url", "textures/user-url.tga", (texture, path) => {
      texture.userData.url = path;
    }],
    ["texture.source.currentSrc", "textures/source-current.tga", (texture, path) => {
      texture.source.currentSrc = path;
    }],
    ["texture.userData.source.url", "textures/user-source-url.tga", (texture, path) => {
      texture.userData.source = { url: path };
    }],
    ["texture.userData.element.currentSrc", "textures/user-element-current.tga", (texture, path) => {
      texture.userData.element = { currentSrc: path };
    }],
    ["texture.userData.mediaElement.relativePath", "textures/user-media-element-relative.tga", (texture, path) => {
      texture.userData.mediaElement = { relativePath: path };
    }],
    ["texture.userData.relativeFileName", "textures/user-relative.tga", (texture, path) => {
      texture.userData.relativeFileName = path;
    }],
    ["texture.source.relativeFileName", "textures/source-relative.tga", (texture, path) => {
      texture.source.relativeFileName = path;
    }],
    ["texture.relativePath", "textures/direct-relative.tga", (texture, path) => {
      texture.relativePath = path;
    }]
  ];

  for (const [label, path, assignSource] of variants) {
    const scene = fromThreeObject(threeSourceAliasTextureScene((texture) => assignSource(texture, path)));
    const texture = scene.meshes[0].materials[0].diffuseTexture;
    const expectedName = path.split("/").pop().replace(/\.tga$/, "");

    assert.equal(texture.name, expectedName, label);
    assert.equal(texture.fileName, path, label);
    assert.equal(texture.relativeFileName, path, label);
  }
});

test("adapts Three.js userData data URL texture sources into embedded content", () => {
  const scene = fromThreeObject(threeSourceAliasTextureScene((texture) => {
    texture.userData.name = "userdata_checker";
    texture.userData.src = checkerDataUrl();
  }));
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.name, "userdata_checker");
  assert.equal(texture.fileName, "userdata_checker.tga");
  assert.equal(texture.relativeFileName, "userdata_checker.tga");
  assert.equal(texture.mimeType, "image/x-tga");
  assert.deepEqual(Array.from(texture.content), Array.from(checkerTga()));

  const text = decode(exportFbx(scene));
  assert.match(text, /userdata_checker\.tga/);
  assert.match(text, /Content/);
  assert.doesNotMatch(text, /data:image/);
});

test("adapts Three.js source-owner data URL texture sources into embedded content", () => {
  const scene = fromThreeObject(threeSourceAliasTextureScene((texture) => {
    texture.source.name = "source_checker";
    texture.source.src = checkerDataUrl();
  }));
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.name, "source_checker");
  assert.equal(texture.fileName, "source_checker.tga");
  assert.equal(texture.relativeFileName, "source_checker.tga");
  assert.equal(texture.mimeType, "image/x-tga");
  assert.deepEqual(Array.from(texture.content), Array.from(checkerTga()));

  const text = decode(exportFbx(scene));
  assert.match(text, /source_checker\.tga/);
  assert.match(text, /Content/);
  assert.doesNotMatch(text, /data:image/);
});

test("adapts Three.js userData media element data URL texture sources into embedded content", () => {
  const scene = fromThreeObject(threeSourceAliasTextureScene((texture) => {
    texture.userData.mediaElement = {
      name: "media_element_checker",
      currentSrc: checkerDataUrl(),
      naturalWidth: 2,
      naturalHeight: 2
    };
  }));
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.name, "media_element_checker");
  assert.equal(texture.fileName, "media_element_checker.tga");
  assert.equal(texture.relativeFileName, "media_element_checker.tga");
  assert.equal(texture.width, 2);
  assert.equal(texture.height, 2);
  assert.equal(texture.mimeType, "image/x-tga");
  assert.deepEqual(Array.from(texture.content), Array.from(checkerTga()));

  const text = decode(exportFbx(scene));
  assert.match(text, /media_element_checker\.tga/);
  assert.match(text, /Content/);
  assert.doesNotMatch(text, /data:image/);
});

test("Blender imports resolved file textures after the source file is removed", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const texturePath = join(tempDir, "checker.tga");
  const fbxPath = join(tempDir, "resolved-file-texture.fbx");
  await writeFile(texturePath, checkerTga());
  await writeFile(fbxPath, exportFbx(fileBackedTextureScene(), {
    resolveTextureContent: createNodeTextureResolver({ baseDir: tempDir })
  }));
  await unlink(texturePath);

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
images = [img for img in bpy.data.images if img.filepath or img.packed_file]
print("FBX_VALIDATE:" + json.dumps({
    "images": len(images),
    "imageNames": sorted(img.name for img in images),
    "packed": sum(1 for img in images if img.packed_file),
}))
`;
  const result = spawnSync(blenderPath, blenderTestArgs(script, fbxPath), {
    encoding: "utf8"
  });

  await rm(tempDir, { recursive: true, force: true });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const match = result.stdout.match(/FBX_VALIDATE:(.+)/);
  assert.ok(match, result.stdout);
  const info = JSON.parse(match[1]);
  assert.equal(info.images, 1);
  assert.deepEqual(info.imageNames, ["checker"]);
  assert.equal(info.packed, 1);
});

test("Blender imports data URL textures as packed images", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "data-url-texture.fbx");
  await writeFile(fbxPath, exportFbx(dataUrlTextureScene()));

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
images = [img for img in bpy.data.images if img.filepath or img.packed_file]
print("FBX_VALIDATE:" + json.dumps({
    "images": len(images),
    "imageNames": sorted(img.name for img in images),
    "packed": sum(1 for img in images if img.packed_file),
}))
`;
  const result = spawnSync(blenderPath, blenderTestArgs(script, fbxPath), {
    encoding: "utf8"
  });

  await rm(tempDir, { recursive: true, force: true });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const match = result.stdout.match(/FBX_VALIDATE:(.+)/);
  assert.ok(match, result.stdout);
  const info = JSON.parse(match[1]);
  assert.equal(info.images, 1);
  assert.deepEqual(info.imageNames, ["embedded_checker"]);
  assert.equal(info.packed, 1);
});
