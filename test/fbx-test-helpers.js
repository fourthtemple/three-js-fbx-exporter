import { existsSync } from "node:fs";
import { blenderBackgroundArgs } from "../scripts/blender-runner.js";

export const blenderPath = process.env.BLENDER_PATH || "/Applications/Blender.app/Contents/MacOS/Blender";
export const hasBlender = !process.env.CODEX_SANDBOX && existsSync(blenderPath);
export const blenderTestArgs = blenderBackgroundArgs;

export function checkerTga() {
  return Uint8Array.from([
    0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    2, 0, 2, 0, 24, 0,
    255, 255, 255, 0, 0, 0,
    0, 0, 0, 255, 255, 255
  ]);
}

export function decode(bytes) {
  return new TextDecoder().decode(bytes);
}

export function arrayBufferFrom(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export async function withMockDocument(callback) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  globalThis.document = {
    createElementNS() {
      return {
        addEventListener() {},
        removeEventListener() {},
        set src(value) {
          this._src = value;
        },
        get src() {
          return this._src;
        }
      };
    }
  };
  globalThis.window = {
    innerWidth: 1024,
    innerHeight: 768,
    URL: {
      createObjectURL() {
        return "blob:fbx-exporter-test";
      }
    }
  };
  try {
    return await callback();
  } finally {
    if (previousDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = previousDocument;
    }
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
}
