import assert from "node:assert/strict";
import { test } from "node:test";
import { deflateSync, inflateSync } from "node:zlib";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import {
  createCubeScene,
  createMinimalFbxDocument,
  exportFbx,
  FbxAsciiWriter,
  FbxBinaryWriter,
  FbxNode,
  makeNode,
  writeMinimalFbx
} from "../src/index.js";
import { float64Array, int64, rawBytes } from "../src/core/fbx-values.js";
import { arrayBufferFrom, decode } from "./fbx-test-helpers.js";

function readUint32(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);
}

function readUint64(bytes, offset) {
  const value = new DataView(bytes.buffer, bytes.byteOffset + offset, 8).getBigUint64(0, true);
  return Number(value);
}

function readRootNode(bytes, offset = 27, { wide = false } = {}) {
  const readInteger = wide ? readUint64 : readUint32;
  const integerSize = wide ? 8 : 4;
  const endOffset = readInteger(bytes, offset);
  const propertyCount = readInteger(bytes, offset + integerSize);
  const propertyBytes = readInteger(bytes, offset + integerSize * 2);
  const nameLengthOffset = offset + integerSize * 3;
  const nameLength = bytes[nameLengthOffset];
  const nameStart = nameLengthOffset + 1;
  const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength));
  return { endOffset, propertyCount, propertyBytes, name, headerSize: integerSize * 3 + 1 + nameLength };
}

test("writes FBX binary magic and version", () => {
  const bytes = writeMinimalFbx();
  const magic = new TextDecoder().decode(bytes.subarray(0, 20));
  assert.equal(magic, "Kaydara FBX Binary  ");
  assert.equal(bytes[20], 0);
  assert.equal(bytes[21], 0x1a);
  assert.equal(bytes[22], 0);
  assert.equal(readUint32(bytes, 23), 7400);
});

test("writes root node offsets and properties", () => {
  const writer = new FbxBinaryWriter();
  const node = makeNode("Root", [42, "hello"], [
    makeNode("Child", [true])
  ]);
  const bytes = writer.writeDocument([node]);
  const root = readRootNode(bytes);
  assert.equal(root.name, "Root");
  assert.equal(root.propertyCount, 2);
  assert.ok(root.propertyBytes > 0);
  assert.ok(root.endOffset > 27 + root.headerSize + root.propertyBytes);

  const child = readRootNode(bytes, 27 + root.headerSize + root.propertyBytes);
  assert.equal(child.name, "Child");
  assert.equal(child.propertyCount, 1);
});

test("writes uncompressed typed array properties", () => {
  const writer = new FbxBinaryWriter();
  const node = makeNode("ArrayNode", [{ type: "int32Array", value: [3, 5, -8] }]);
  const bytes = writer.writeDocument([node]);
  const root = readRootNode(bytes);
  const propertyStart = 27 + root.headerSize;
  const view = new DataView(bytes.buffer, bytes.byteOffset);

  assert.equal(String.fromCharCode(bytes[propertyStart]), "i");
  assert.equal(view.getUint32(propertyStart + 1, true), 3);
  assert.equal(view.getUint32(propertyStart + 5, true), 0);
  assert.equal(view.getUint32(propertyStart + 9, true), 12);
  assert.equal(view.getInt32(propertyStart + 13, true), 3);
  assert.equal(view.getInt32(propertyStart + 17, true), 5);
  assert.equal(view.getInt32(propertyStart + 21, true), -8);
});

test("writes compressed typed array properties through an injected compressor", () => {
  let compressionContext = null;
  const writer = new FbxBinaryWriter({
    compressArrayBytes(bytes, context) {
      compressionContext = context;
      return deflateSync(bytes);
    }
  });
  const node = makeNode("ArrayNode", [{ type: "int32Array", value: [3, 5, -8] }]);
  const bytes = writer.writeDocument([node]);
  const root = readRootNode(bytes);
  const propertyStart = 27 + root.headerSize;
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const compressedLength = view.getUint32(propertyStart + 9, true);
  const payload = bytes.subarray(propertyStart + 13, propertyStart + 13 + compressedLength);
  const inflated = inflateSync(payload);
  const inflatedView = new DataView(inflated.buffer, inflated.byteOffset, inflated.byteLength);

  assert.deepEqual(compressionContext, {
    typeCode: "i",
    itemByteLength: 4,
    count: 3,
    byteLength: 12
  });
  assert.equal(String.fromCharCode(bytes[propertyStart]), "i");
  assert.equal(view.getUint32(propertyStart + 1, true), 3);
  assert.equal(view.getUint32(propertyStart + 5, true), 1);
  assert.equal(inflated.byteLength, 12);
  assert.equal(inflatedView.getInt32(0, true), 3);
  assert.equal(inflatedView.getInt32(4, true), 5);
  assert.equal(inflatedView.getInt32(8, true), -8);
});

test("minimal document contains standard top-level sections", () => {
  const bytes = writeMinimalFbx();
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /FBXHeaderExtension/);
  assert.match(text, /GlobalSettings/);
  assert.match(text, /Definitions/);
  assert.match(text, /Objects/);
  assert.match(text, /Connections/);
});

test("minimal document writes unit scale settings as doubles", () => {
  const globalSettings = createMinimalFbxDocument().find((node) => node.name === "GlobalSettings");
  const properties = globalSettings.children.find((node) => node.name === "Properties70");
  const unitScale = properties.children.find((node) => node.properties[0] === "UnitScaleFactor");
  const originalUnitScale = properties.children.find((node) => node.properties[0] === "OriginalUnitScaleFactor");

  assert.deepEqual(unitScale.properties, ["UnitScaleFactor", "double", "Number", "", { type: "float64", value: 1 }]);
  assert.deepEqual(originalUnitScale.properties, ["OriginalUnitScaleFactor", "double", "Number", "", { type: "float64", value: 1 }]);
});

test("writes FBX 7500+ 64-bit node records", () => {
  const writer = new FbxBinaryWriter({ version: 7500 });
  const node = new FbxNode("Root", [42, "hello"], [
    makeNode("Child", [true])
  ]);
  const bytes = writer.writeDocument([node]);
  const root = readRootNode(bytes, 27, { wide: true });

  assert.equal(readUint32(bytes, 23), 7500);
  assert.equal(root.name, "Root");
  assert.equal(root.propertyCount, 2);
  assert.ok(root.propertyBytes > 0);
  assert.ok(root.endOffset > 27 + root.headerSize + root.propertyBytes);
  assert.equal(bytes.length, root.endOffset + 25);

  const child = readRootNode(bytes, 27 + root.headerSize + root.propertyBytes, { wide: true });
  assert.equal(child.name, "Child");
  assert.equal(child.propertyCount, 1);
});

test("writes FBX ASCII text nodes, arrays, FBX names, and raw content", () => {
  const writer = new FbxAsciiWriter();
  const bytes = writer.writeDocument([
    makeNode("Objects", [], [
      makeNode("Model", [int64(100001), "Cube\u0000\u0001Model", "Mesh"], [
        makeNode("Vertices", [float64Array([0, 1.5, -2])]),
        makeNode("Content", [rawBytes(Uint8Array.from([1, 2, 3, 4]))])
      ])
    ])
  ]);
  const text = decode(bytes);

  assert.match(text, /^; FBX 7\.4\.0 project file/);
  assert.match(text, /\nObjects:  \{\n/);
  assert.match(text, /\n\tModel: 100001, "Model::Cube", "Mesh" \{\n/);
  assert.match(text, /\n\t\tVertices: \*3 \{\n\t\t\ta: 0,1\.5,-2\n\t\t}/);
  assert.match(text, /\n\t\tContent: ,\n\t\t\t"AQIDBA==",/);
});

test("writeMinimalFbx can emit ASCII FBX", () => {
  const bytes = writeMinimalFbx({ format: "ascii" });
  const text = decode(bytes);

  assert.equal(text.startsWith("Kaydara FBX Binary"), false);
  assert.match(text, /FBXHeaderExtension:  \{/);
  assert.match(text, /\n\tFBXVersion: 7400/);
  assert.match(text, /\n\tCreator: "three-js-fbx-exporter"/);
});

test("exportFbx can emit ASCII FBX parsed by Three.js FBXLoader", () => {
  const bytes = exportFbx(createCubeScene(), { format: "ascii" });
  const text = decode(bytes);
  assert.match(text, /^; FBX 7\.4\.0 project file/);
  assert.match(text, /Vertices: \*24 \{/);

  const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");
  const cube = group.children.find((child) => child.name === "Cube");
  assert.ok(cube);
  assert.equal(cube.geometry.attributes.position.count, 36);
});

test("exportFbx can emit ASCII animation curves parsed by Three.js FBXLoader", () => {
  const bytes = exportFbx(createCubeScene({ animated: true }), { format: "ascii" });
  const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");

  assert.equal(group.animations.length, 1);
  assert.deepEqual(group.animations[0].tracks.map((track) => track.name), [
    "Cube.position",
    "Cube.quaternion"
  ]);
});
