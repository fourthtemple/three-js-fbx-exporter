import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHierarchyScene, exportFbx } from "../src/index.js";
import { assertBlenderSucceeded, runBlenderBackground } from "./blender-runner.js";

function arrayBufferFrom(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function validateFbxLoader(bytes) {
  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");
  const parent = group.getObjectByName("ParentCtrl");
  const mesh = group.getObjectByName("Cube");
  return {
    parentType: parent?.type,
    meshParent: mesh?.parent?.name,
    animations: group.animations.length,
    tracks: group.animations[0]?.tracks.map((track) => track.name) || []
  };
}

async function validateBlender(bytes) {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "hierarchy-sample.fbx");
  await writeFile(fbxPath, bytes);

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
print("FBX_VALIDATE:" + json.dumps({
    "objects": sorted((obj.name, obj.type, obj.parent.name if obj.parent else None) for obj in bpy.context.scene.objects),
    "actions": sorted((action.name, len(action.fcurves)) for action in bpy.data.actions),
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

const bytes = exportFbx(createHierarchyScene());
const loaderResult = await validateFbxLoader(bytes);
const blenderResult = await validateBlender(bytes);
console.log(JSON.stringify({ fbxLoader: loaderResult, blender: blenderResult }, null, 2));
