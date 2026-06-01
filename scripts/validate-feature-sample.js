import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCubeScene, exportFbx } from "../src/index.js";
import { deflateArrayBytes } from "../src/node-array-compressor.js";
import { assertBlenderSucceeded, runBlenderBackground } from "./blender-runner.js";

function arrayBufferFrom(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function checkerTga() {
  return Uint8Array.from([
    0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    2, 0, 2, 0, 24, 0,
    255, 255, 255, 0, 0, 0,
    0, 0, 0, 255, 255, 255
  ]);
}

async function validateFbxLoader(bytes) {
  const previousDocument = globalThis.document;
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
  try {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");
    const mesh = group.children.find((object) => object.isMesh);
    return {
      meshObjects: group.children.filter((object) => object.isMesh).length,
      animations: group.animations.length,
      tracks: group.animations[0]?.tracks.map((track) => track.name) || [],
      hasTexture: Boolean(mesh?.material?.map)
    };
  } finally {
    if (previousDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = previousDocument;
    }
  }
}

async function validateBlender(bytes) {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "feature-sample.fbx");
  await writeFile(join(tempDir, "checker.tga"), checkerTga());
  await writeFile(fbxPath, bytes);

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
images = [img for img in bpy.data.images if img.filepath]
actions = list(bpy.data.actions)
animated = [obj.name for obj in bpy.context.scene.objects if obj.animation_data and obj.animation_data.action]
print("FBX_VALIDATE:" + json.dumps({
    "meshObjects": len(meshes),
    "images": len(images),
    "actions": len(actions),
    "fcurves": len(actions[0].fcurves) if actions else 0,
    "animated": animated,
}))
`;
  const result = runBlenderBackground(script, fbxPath);
  await rm(tempDir, { recursive: true, force: true });

  assertBlenderSucceeded(result, fbxPath);
  const match = result.stdout.match(/FBX_VALIDATE:(.+)/);
  if (!match) {
    throw new Error(`Blender did not report validation data:\n${result.stdout}`);
  }
  return JSON.parse(match[1]);
}

const compressed = process.argv.includes("--compressed");
const bytes = exportFbx(createCubeScene({ animated: true, textured: true }), compressed
  ? { compressArrayBytes: deflateArrayBytes }
  : {});
const loaderResult = await validateFbxLoader(bytes);
const blenderResult = await validateBlender(bytes);
console.log(JSON.stringify({ compressed, fbxLoader: loaderResult, blender: blenderResult }, null, 2));
