import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createVertexColorScene, exportFbx } from "../src/index.js";
import { assertBlenderSucceeded, runBlenderBackground } from "./blender-runner.js";

function arrayBufferFrom(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function validateFbxLoader(bytes) {
  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");
  const mesh = group.getObjectByName("ColorQuad");
  return {
    hasColorAttribute: Boolean(mesh?.geometry.attributes.color),
    colorCount: mesh?.geometry.attributes.color?.count || 0,
    vertexColors: mesh?.material.vertexColors || false
  };
}

async function validateBlender(bytes) {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "vertex-color-sample.fbx");
  await writeFile(fbxPath, bytes);

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
mesh = next((obj.data for obj in bpy.context.scene.objects if obj.type == "MESH"), None)
attrs = list(mesh.color_attributes) if mesh else []
print("FBX_VALIDATE:" + json.dumps({
    "colorAttributes": [(attr.name, attr.domain, attr.data_type, len(attr.data)) for attr in attrs],
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

const bytes = exportFbx(createVertexColorScene());
const loaderResult = await validateFbxLoader(bytes);
const blenderResult = await validateBlender(bytes);
console.log(JSON.stringify({ fbxLoader: loaderResult, blender: blenderResult }, null, 2));
