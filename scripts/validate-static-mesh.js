import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCubeScene, exportFbx } from "../src/index.js";
import { assertBlenderSucceeded, runBlenderBackground } from "./blender-runner.js";

function arrayBufferFrom(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function validateFbxLoader(bytes) {
  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");
  const meshes = [];
  group.traverse((object) => {
    if (object.isMesh) {
      meshes.push(object);
    }
  });
  if (meshes.length !== 1) {
    throw new Error(`Expected FBXLoader to parse 1 mesh, got ${meshes.length}`);
  }
  return {
    meshObjects: meshes.length,
    vertices: meshes[0].geometry.attributes.position.count
  };
}

async function validateBlender(bytes) {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "static-mesh.fbx");
  await writeFile(fbxPath, bytes);

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
data = meshes[0].data if meshes else None
print("FBX_VALIDATE:" + json.dumps({
    "meshObjects": len(meshes),
    "vertices": len(data.vertices) if data else 0,
    "polygons": len(data.polygons) if data else 0,
    "materials": len(data.materials) if data else 0,
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

const bytes = exportFbx(createCubeScene());
const loaderResult = await validateFbxLoader(bytes);
const blenderResult = await validateBlender(bytes);
console.log(JSON.stringify({ fbxLoader: loaderResult, blender: blenderResult }, null, 2));
