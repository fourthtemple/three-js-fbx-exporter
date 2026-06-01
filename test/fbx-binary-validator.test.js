import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertValidFbxBinary,
  FbxBinaryWriter,
  makeNode,
  validateFbxBinary,
  writeMinimalFbx
} from "../src/index.js";

function mutable(bytes) {
  return new Uint8Array(bytes);
}

function writeUint32(bytes, offset, value) {
  new DataView(bytes.buffer, bytes.byteOffset + offset, 4).setUint32(0, value, true);
}

function nodePropertyStart(nodeName, { wide = false } = {}) {
  return 27 + (wide ? 24 : 12) + 1 + nodeName.length;
}

test("validates generated FBX binary node offsets", () => {
  const result = validateFbxBinary(writeMinimalFbx());

  assert.equal(result.valid, true);
  assert.equal(result.version, 7400);
  assert.equal(result.nodeCount, 7);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.trailingBytes, 0);
});

test("validates generated FBX 7500 wide-node records", () => {
  const writer = new FbxBinaryWriter({ version: 7500 });
  const result = assertValidFbxBinary(writer.writeDocument([
    makeNode("Root", [42], [makeNode("Child", ["ok"])])
  ]));

  assert.equal(result.version, 7500);
  assert.equal(result.nodeCount, 1);
});

test("reports root node end offsets that point outside the file", () => {
  const bytes = mutable(writeMinimalFbx());
  writeUint32(bytes, 27, bytes.length + 100);

  const result = validateFbxBinary(bytes);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("end offset exceeds file length")));
});

test("reports uncompressed array payloads whose length does not match count", () => {
  const writer = new FbxBinaryWriter();
  const bytes = mutable(writer.writeDocument([
    makeNode("ArrayNode", [{ type: "int32Array", value: [1, 2] }])
  ]));
  writeUint32(bytes, nodePropertyStart("ArrayNode") + 9, 12);

  const result = validateFbxBinary(bytes);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("array payload length does not match count")));
});

test("assertValidFbxBinary throws with structural error details", () => {
  const bytes = mutable(writeMinimalFbx());
  writeUint32(bytes, 27, 0);

  assert.throws(
    () => assertValidFbxBinary(bytes),
    /Invalid FBX binary:\nFBX node end offset must advance/
  );
});

test("can tolerate external FBX files with trailing footer bytes", () => {
  const source = writeMinimalFbx();
  const bytes = new Uint8Array(source.length + 16);
  bytes.set(source);
  bytes.set(Uint8Array.from({ length: 16 }, (_, index) => index + 1), source.length);

  const strict = validateFbxBinary(bytes);
  const tolerant = validateFbxBinary(bytes, { allowTrailingBytes: true });

  assert.equal(strict.valid, false);
  assert.ok(strict.errors.some((error) => error.includes("trailing bytes")));
  assert.equal(tolerant.valid, true);
  assert.equal(tolerant.trailingBytes, 16);
  assert.ok(tolerant.warnings.some((warning) => warning.includes("trailing bytes")));
});
