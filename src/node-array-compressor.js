import { deflateSync } from "node:zlib";

export function deflateArrayBytes(bytes) {
  return deflateSync(bytes);
}

export function createNodeArrayCompressor(options = {}) {
  return (bytes) => deflateSync(bytes, options);
}
