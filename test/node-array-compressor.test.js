import assert from "node:assert/strict";
import { test } from "node:test";
import { inflateSync } from "node:zlib";
import { createNodeArrayCompressor, deflateArrayBytes } from "../src/node/node-array-compressor.js";

test("deflates typed array bytes for FBX compressed array payloads", () => {
  const source = new Uint8Array([1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0]);
  const compressed = deflateArrayBytes(source);

  assert.deepEqual(new Uint8Array(inflateSync(compressed)), source);
});

test("creates configured synchronous array compressors", () => {
  const source = new Uint8Array(128).fill(7);
  const compressArrayBytes = createNodeArrayCompressor({ level: 1 });
  const compressed = compressArrayBytes(source, { typeCode: "i" });

  assert.deepEqual(new Uint8Array(inflateSync(compressed)), source);
});
