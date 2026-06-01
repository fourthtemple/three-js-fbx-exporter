import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMaterialScene, exportFbx } from "../src/index.js";
import { assertBlenderSucceeded, runBlenderBackground } from "./blender-runner.js";

function arrayBufferFrom(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function validateFbxLoader(bytes) {
  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");
  const material = group.getObjectByName("MaterialQuad").material;
  return {
    name: material.name,
    color: [material.color.r, material.color.g, material.color.b],
    emissive: [material.emissive.r, material.emissive.g, material.emissive.b],
    specular: [material.specular.r, material.specular.g, material.specular.b],
    opacity: material.opacity,
    transparent: material.transparent,
    emissiveIntensity: material.emissiveIntensity,
    shininess: material.shininess
  };
}

async function validateBlender(bytes) {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "material-sample.fbx");
  await writeFile(fbxPath, bytes);

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
mat = bpy.data.materials.get("RichMaterial")
print("FBX_VALIDATE:" + json.dumps({
    "name": mat.name if mat else None,
    "diffuseColor": list(mat.diffuse_color) if mat else [],
    "useNodes": mat.use_nodes if mat else None,
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

const bytes = exportFbx(createMaterialScene());
const loaderResult = await validateFbxLoader(bytes);
const blenderResult = await validateBlender(bytes);
console.log(JSON.stringify({ fbxLoader: loaderResult, blender: blenderResult }, null, 2));
