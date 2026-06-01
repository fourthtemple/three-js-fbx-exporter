import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSkinnedMorphScene, exportFbx } from "../src/index.js";
import { deflateArrayBytes } from "../src/node/node-array-compressor.js";
import { assertBlenderSucceeded, runBlenderBackground } from "./blender-runner.js";
import { checkerTextureResolver, checkerTga } from "./sample-texture.js";

function arrayBufferFrom(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function validateFbxLoader(bytes) {
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
        return "blob:fbx-exporter-validator";
      }
    }
  };
  try {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");
    const skinned = [];
    group.traverse((object) => {
      if (object.isSkinnedMesh) {
        skinned.push(object);
      }
    });
    const mesh = skinned[0];
    return {
      skinnedMeshes: skinned.length,
      bones: mesh?.skeleton.bones.map((bone) => bone.name) || [],
      morphTargets: mesh?.geometry.morphAttributes.position?.map((attribute) => attribute.name) || [],
      morphDictionary: mesh?.morphTargetDictionary || {},
      hasSkinIndex: Boolean(mesh?.geometry.attributes.skinIndex),
      hasTexture: Boolean(mesh?.material.map),
      animations: group.animations.length,
      tracks: group.animations[0]?.tracks.map((track) => track.name) || []
    };
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

async function validateBlender(bytes, { embedded = false } = {}) {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "character-sample.fbx");
  if (!embedded) {
    await writeFile(join(tempDir, "checker.tga"), checkerTga());
  }
  await writeFile(fbxPath, bytes);

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
images = [img for img in bpy.data.images if img.filepath or img.packed_file]
packed_images = [img for img in bpy.data.images if img.packed_file]
mesh = meshes[0] if meshes else None
shape_keys = mesh.data.shape_keys if mesh and mesh.data.shape_keys else None
print("FBX_VALIDATE:" + json.dumps({
    "meshes": len(meshes),
    "armatures": len(armatures),
    "bones": [bone.name for bone in armatures[0].data.bones] if armatures else [],
    "modifiers": [mod.type for mod in mesh.modifiers] if mesh else [],
    "vertexGroups": [group.name for group in mesh.vertex_groups] if mesh else [],
    "shapeKeys": [key.name for key in shape_keys.key_blocks] if shape_keys else [],
    "animatedShapeKeys": bool(shape_keys and shape_keys.animation_data and shape_keys.animation_data.action),
    "images": len(images),
    "packedImages": len(packed_images),
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

const compressed = process.argv.includes("--compressed");
const embedded = process.argv.some((value) => value === "--embed-textures" || value === "--embedded" || value === "--embed");
const bytes = exportFbx(createSkinnedMorphScene(), {
  ...(compressed ? { compressArrayBytes: deflateArrayBytes } : {}),
  ...(embedded ? { resolveTextureContent: checkerTextureResolver } : {})
});
const loaderResult = await validateFbxLoader(bytes);
const blenderResult = await validateBlender(bytes, { embedded });
console.log(JSON.stringify({ compressed, embedded, fbxLoader: loaderResult, blender: blenderResult }, null, 2));
