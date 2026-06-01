import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSkinnedCubeScene, exportFbx } from "../src/index.js";
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
    return {
      skinnedMeshes: skinned.length,
      bones: skinned[0]?.skeleton.bones.map((bone) => bone.name) || [],
      hasSkinIndex: Boolean(skinned[0]?.geometry.attributes.skinIndex),
      animations: group.animations.length,
      tracks: group.animations[0]?.tracks.map((track) => track.name) || [],
      hasTexture: Boolean(skinned[0]?.material.map)
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
  const fbxPath = join(tempDir, "skinned-sample.fbx");
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
actions = list(bpy.data.actions)
mesh = meshes[0] if meshes else None
print("FBX_VALIDATE:" + json.dumps({
    "meshes": len(meshes),
    "armatures": len(armatures),
    "bones": [bone.name for bone in armatures[0].data.bones] if armatures else [],
    "modifiers": [mod.type for mod in mesh.modifiers] if mesh else [],
    "vertexGroups": [group.name for group in mesh.vertex_groups] if mesh else [],
    "images": len(images),
    "packedImages": len(packed_images),
    "actions": len(actions),
    "fcurves": len(actions[0].fcurves) if actions else 0,
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
const bytes = exportFbx(createSkinnedCubeScene({ animated: true, textured: true }), {
  ...(compressed ? { compressArrayBytes: deflateArrayBytes } : {}),
  ...(embedded ? { resolveTextureContent: checkerTextureResolver } : {})
});
const loaderResult = await validateFbxLoader(bytes);
const blenderResult = await validateBlender(bytes, { embedded });
console.log(JSON.stringify({ compressed, embedded, fbxLoader: loaderResult, blender: blenderResult }, null, 2));
