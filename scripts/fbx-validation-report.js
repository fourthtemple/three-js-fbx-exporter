import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { assertBlenderSucceeded, runBlenderBackground } from "./blender-runner.js";
import { assertValidFbxBinary } from "../src/index.js";

function arrayBufferFrom(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function withMockDocument(callback) {
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

function materialArray(material) {
  return Array.isArray(material) ? material : [material].filter(Boolean);
}

function textureCount(materials) {
  return materials.reduce((count, material) => {
    return count + [
      material.map,
      material.normalMap,
      material.bumpMap,
      material.emissiveMap,
      material.aoMap,
      material.roughnessMap,
      material.metalnessMap,
      material.alphaMap
    ].filter(Boolean).length;
  }, 0);
}

function trackSummary(track, { includeTrackSamples = false } = {}) {
  const summary = {
    name: track.name,
    keyCount: track.times?.length || 0,
    valueSize: typeof track.getValueSize === "function" ? track.getValueSize() : 0
  };
  if (!includeTrackSamples) {
    return summary;
  }
  return {
    ...summary,
    times: Array.from(track.times || []),
    values: Array.from(track.values || [])
  };
}

function hipsMotionFromTracks(tracks) {
  const track = tracks.find((candidate) => {
    return /(?:^|:)Hips\.position$/.test(candidate.name) ||
      /mixamorig:?Hips\.position$/.test(candidate.name);
  });
  const valueSize = typeof track?.getValueSize === "function"
    ? track.getValueSize()
    : track?.valueSize || 0;
  if (!track || valueSize < 3) {
    return null;
  }
  const zValues = [];
  for (let index = 2; index < track.values.length; index += valueSize) {
    zValues.push(track.values[index]);
  }
  return {
    track: track.name,
    minZ: Math.min(...zValues),
    maxZ: Math.max(...zValues),
    rangeZ: Math.max(...zValues) - Math.min(...zValues)
  };
}

export async function fbxLoaderReport(bytes, options = {}) {
  return withMockDocument(async () => {
    const warnings = [];
    const previousWarn = console.warn;
    console.warn = (...args) => {
      warnings.push(args.map(String).join(" "));
      if (options.echoWarnings) {
        previousWarn(...args);
      }
    };
    let group;
    try {
      const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
      group = new FBXLoader().parse(arrayBufferFrom(bytes), "");
    } finally {
      console.warn = previousWarn;
    }
    const meshes = [];
    const skinnedMeshes = [];
    group.traverse((object) => {
      if (object.isMesh) {
        meshes.push(object);
      }
      if (object.isSkinnedMesh) {
        skinnedMeshes.push(object);
      }
    });
    const materials = meshes.flatMap((mesh) => materialArray(mesh.material));
    const firstSkinned = skinnedMeshes[0] || null;
    const animationSummaries = group.animations.map((clip) => {
      const tracks = clip.tracks.map((track) => trackSummary(track, options));
      return {
        name: clip.name,
        duration: clip.duration,
        trackNames: tracks.map((track) => track.name),
        hipsMotion: hipsMotionFromTracks(clip.tracks),
        tracks
      };
    });

    return {
      rootName: group.name,
      warnings,
      meshes: meshes.length,
      meshNames: meshes.map((mesh) => mesh.name),
      skinnedMeshes: skinnedMeshes.length,
      vertices: meshes.map((mesh) => mesh.geometry.attributes.position?.count || 0),
      polygons: meshes.map((mesh) => {
        const indexCount = mesh.geometry.index?.count || mesh.geometry.attributes.position?.count || 0;
        return Math.floor(indexCount / 3);
      }),
      bones: firstSkinned?.skeleton.bones.map((bone) => bone.name) || [],
      hasSkinIndex: Boolean(firstSkinned?.geometry.attributes.skinIndex),
      hasSkinWeight: Boolean(firstSkinned?.geometry.attributes.skinWeight),
      morphTargets: firstSkinned?.geometry.morphAttributes.position?.map((attribute) => attribute.name) || [],
      morphDictionary: firstSkinned?.morphTargetDictionary || {},
      materials: materials.length,
      materialNames: materials.map((material) => material.name || ""),
      textures: textureCount(materials),
      animations: animationSummaries
    };
  });
}

export function blenderImportReport(fbxPath) {
  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
objects = list(bpy.context.scene.objects)
meshes = [obj for obj in objects if obj.type == "MESH"]
armatures = [obj for obj in objects if obj.type == "ARMATURE"]
materials = list(bpy.data.materials)
images = [img for img in bpy.data.images if img.filepath or img.packed_file]
packed_images = [img for img in bpy.data.images if img.packed_file]
actions = sorted(bpy.data.actions, key=lambda action: action.name)

include_data_paths = "--include-blender-data-paths" in sys.argv

def action_summary(action):
    data_paths = sorted(set(curve.data_path for curve in action.fcurves))
    summary = {
        "name": action.name,
        "fcurves": len(action.fcurves),
        "frameRange": [float(action.frame_range[0]), float(action.frame_range[1])],
        "dataPathCount": len(data_paths),
    }
    if include_data_paths:
        summary["dataPaths"] = data_paths
    return summary

def shape_key_names(mesh):
    keys = mesh.data.shape_keys
    return [key.name for key in keys.key_blocks] if keys else []

print("FBX_FILE_VALIDATE:" + json.dumps({
    "objects": len(objects),
    "objectNames": sorted(obj.name for obj in objects),
    "meshes": len(meshes),
    "meshNames": [obj.name for obj in meshes],
    "meshVertexCounts": [len(obj.data.vertices) for obj in meshes],
    "meshPolygonCounts": [len(obj.data.polygons) for obj in meshes],
    "meshMaterialSlots": [len(obj.material_slots) for obj in meshes],
    "armatures": len(armatures),
    "armatureNames": [obj.name for obj in armatures],
    "bones": [bone.name for bone in armatures[0].data.bones] if armatures else [],
    "modifiers": [[mod.type for mod in obj.modifiers] for obj in meshes],
    "vertexGroups": [[group.name for group in obj.vertex_groups] for obj in meshes],
    "materials": len(materials),
    "materialNames": sorted(mat.name for mat in materials),
    "images": len(images),
    "imageNames": sorted(img.name for img in images),
    "packedImages": len(packed_images),
    "shapeKeys": [shape_key_names(obj) for obj in meshes],
    "animatedShapeKeys": [bool(obj.data.shape_keys and obj.data.shape_keys.animation_data and obj.data.shape_keys.animation_data.action) for obj in meshes],
    "actions": [action_summary(action) for action in actions],
}))
`;
  const result = runBlenderBackground(script, fbxPath);
  assertBlenderSucceeded(result, fbxPath);
  const match = result.stdout.match(/FBX_FILE_VALIDATE:(.+)/);
  if (!match) {
    throw new Error(`Blender imported ${basename(fbxPath)} but did not report validation data:\n${result.stdout}`);
  }
  return JSON.parse(match[1]);
}

export async function validateFbxBytesReport(bytes, { fbxPath = "", allowTrailingBytes = false } = {}) {
  return {
    file: fbxPath ? resolve(fbxPath) : "",
    preflight: assertValidFbxBinary(bytes, { allowTrailingBytes }),
    fbxLoader: await fbxLoaderReport(bytes),
    blender: fbxPath ? blenderImportReport(fbxPath) : null
  };
}

export async function validateFbxFileReport(fbxPath, options = {}) {
  const resolved = resolve(fbxPath);
  return validateFbxBytesReport(await readFile(resolved), {
    fbxPath: resolved,
    ...options
  });
}
