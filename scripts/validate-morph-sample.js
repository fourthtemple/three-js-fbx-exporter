import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMorphScene, exportFbx } from "../src/index.js";
import { assertBlenderSucceeded, runBlenderBackground } from "./blender-runner.js";

function arrayBufferFrom(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function validateFbxLoader(bytes) {
  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");
  const mesh = group.getObjectByName("MorphQuad");
  return {
    morphTargets: mesh?.geometry.morphAttributes.position?.map((attribute) => attribute.name) || [],
    morphDictionary: mesh?.morphTargetDictionary || {},
    animations: group.animations.length,
    tracks: group.animations[0]?.tracks.map((track) => track.name) || []
  };
}

async function validateBlender(bytes) {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "morph-sample.fbx");
  await writeFile(fbxPath, bytes);

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
mesh_obj = next((obj for obj in bpy.context.scene.objects if obj.type == "MESH"), None)
shape_keys = mesh_obj.data.shape_keys if mesh_obj and mesh_obj.data.shape_keys else None
print("FBX_VALIDATE:" + json.dumps({
    "shapeKeys": [key.name for key in shape_keys.key_blocks] if shape_keys else [],
    "actions": sorted((action.name, len(action.fcurves)) for action in bpy.data.actions),
    "animatedShapeKeys": bool(shape_keys and shape_keys.animation_data and shape_keys.animation_data.action),
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

const bytes = exportFbx(createMorphScene());
const loaderResult = await validateFbxLoader(bytes);
const blenderResult = await validateBlender(bytes);
console.log(JSON.stringify({ fbxLoader: loaderResult, blender: blenderResult }, null, 2));
