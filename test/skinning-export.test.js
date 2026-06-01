import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createSkinnedCubeScene, createSkinnedMorphScene, createStaticMeshFbxDocument, exportFbx } from "../src/index.js";
import { deflateArrayBytes } from "../src/node-array-compressor.js";
import { arrayBufferFrom, blenderPath, blenderTestArgs, checkerTga, decode, hasBlender, withMockDocument } from "./fbx-test-helpers.js";

function sharedSkeletonScene() {
  const bones = [
    {
      name: "Root",
      transform: { translation: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }
    },
    {
      name: "Spine",
      parent: "Root",
      transform: { translation: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }
    }
  ];
  const skin = {
    bones,
    clusters: [
      { bone: "Root", indices: [0, 1], weights: [1, 1] },
      { bone: "Spine", indices: [2, 3], weights: [1, 1] }
    ]
  };
  const geometry = {
    vertices: [-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0],
    faces: [[0, 1, 2, 3]],
    uvs: [0, 0, 1, 0, 1, 1, 0, 1],
    materialIndices: [0]
  };
  return {
    name: "SharedRigScene",
    meshes: [
      {
        name: "Body",
        materials: [{ name: "BodyMat" }],
        geometry,
        skin
      },
      {
        name: "Cloth",
        transform: { translation: [0, 1, 0] },
        materials: [{ name: "ClothMat" }],
        geometry,
        skin
      }
    ],
    animations: [
      {
        name: "SharedBend",
        frameRate: 30,
        startFrame: 0,
        endFrame: 30,
        tracks: [
          {
            target: "Spine",
            property: "rotation",
            keyframes: [
              { frame: 0, value: [0, 0, 0] },
              { frame: 30, value: [0, 0, 20] }
            ]
          }
        ]
      }
    ]
  };
}

function boneTransformScene() {
  const scene = createSkinnedCubeScene();
  const spine = scene.meshes[0].skin.bones.find((bone) => bone.name === "Spine");
  spine.transform.rotationOrder = "ZYX";
  spine.transform.rotationOffset = [0.1, 0.2, 0.3];
  spine.transform.rotationPivot = [1, 2, 3];
  spine.transform.preRotation = [10, 20, 30];
  spine.transform.postRotation = [-10, -20, -30];
  spine.transform.scalingOffset = [0.4, 0.5, 0.6];
  spine.transform.scalingPivot = [4, 5, 6];
  return scene;
}

function findChild(node, name) {
  return node.children.find((child) => child.name === name);
}

function propertyValue(properties, name) {
  const property = properties.children.find((child) => child.name === "P" && child.properties[0] === name);
  const values = property?.properties.slice(4).map((value) => value?.value ?? value);
  return values?.length === 1 ? values[0] : values;
}

function limbModel(document, boneName) {
  const objects = document.find((node) => node.name === "Objects");
  return objects.children.find((node) => {
    return node.name === "Model" &&
      node.properties[1].includes(`${boneName}\u0000\u0001Model`) &&
      node.properties[2] === "LimbNode";
  });
}

test("exports bind pose, skin, clusters, and limb nodes", () => {
  const bytes = exportFbx(createSkinnedCubeScene({ animated: true, textured: true }));
  const text = decode(bytes);

  assert.match(text, /NodeAttribute/);
  assert.match(text, /LimbNode/);
  assert.match(text, /BindPose/);
  assert.match(text, /PoseNode/);
  assert.match(text, /Deformer/);
  assert.match(text, /Skin/);
  assert.match(text, /Cluster/);
  assert.match(text, /Indexes/);
  assert.match(text, /Weights/);
  assert.match(text, /TransformLink/);
});

test("writes full FBX transform metadata on limb node models", () => {
  const document = createStaticMeshFbxDocument(boneTransformScene());
  const spine = limbModel(document, "Spine");
  const properties = findChild(spine, "Properties70");

  assert.equal(propertyValue(properties, "RotationOrder"), 5);
  assert.deepEqual(propertyValue(properties, "RotationOffset"), [0.1, 0.2, 0.3]);
  assert.deepEqual(propertyValue(properties, "RotationPivot"), [1, 2, 3]);
  assert.deepEqual(propertyValue(properties, "PreRotation"), [10, 20, 30]);
  assert.deepEqual(propertyValue(properties, "PostRotation"), [-10, -20, -30]);
  assert.deepEqual(propertyValue(properties, "ScalingOffset"), [0.4, 0.5, 0.6]);
  assert.deepEqual(propertyValue(properties, "ScalingPivot"), [4, 5, 6]);
});

test("Three.js FBXLoader parses two skinned meshes sharing one skeleton hierarchy", async () => {
  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const bytes = exportFbx(sharedSkeletonScene());
    const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");
    const skinned = [];
    group.traverse((object) => {
      if (object.isSkinnedMesh) {
        skinned.push(object);
      }
    });

    assert.equal(skinned.length, 2);
    assert.deepEqual(skinned.map((mesh) => mesh.name).sort(), ["Body", "Cloth"]);
    assert.deepEqual(skinned[0].skeleton.bones.map((bone) => bone.name), ["Root", "Spine"]);
    assert.deepEqual(skinned[1].skeleton.bones.map((bone) => bone.name), ["Root", "Spine"]);
    assert.equal(group.animations.length, 1);
    assert.deepEqual(group.animations[0].tracks.map((track) => track.name), ["Spine.quaternion"]);
  });
});

test("Three.js FBXLoader parses a skinned mesh with bone animation", async () => {
  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const bytes = exportFbx(createSkinnedCubeScene({ animated: true, textured: true }));
    const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");
    const skinned = [];
    group.traverse((object) => {
      if (object.isSkinnedMesh) {
        skinned.push(object);
      }
    });

    assert.equal(skinned.length, 1);
    assert.deepEqual(skinned[0].skeleton.bones.map((bone) => bone.name), ["Root", "Spine"]);
    assert.ok(skinned[0].geometry.attributes.skinIndex);
    assert.ok(skinned[0].geometry.attributes.skinWeight);
    assert.equal(group.animations.length, 1);
    assert.deepEqual(group.animations[0].tracks.map((track) => track.name), ["Spine.quaternion"]);
    assert.ok(skinned[0].material.map);
  });
});

test("Three.js FBXLoader parses a compressed skinned mesh with bone animation", async () => {
  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const bytes = exportFbx(createSkinnedCubeScene({ animated: true, textured: true }), {
      compressArrayBytes: deflateArrayBytes
    });
    const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");
    const skinned = [];
    group.traverse((object) => {
      if (object.isSkinnedMesh) {
        skinned.push(object);
      }
    });

    assert.equal(skinned.length, 1);
    assert.deepEqual(skinned[0].skeleton.bones.map((bone) => bone.name), ["Root", "Spine"]);
    assert.ok(skinned[0].geometry.attributes.skinIndex);
    assert.ok(skinned[0].geometry.attributes.skinWeight);
    assert.equal(group.animations.length, 1);
    assert.deepEqual(group.animations[0].tracks.map((track) => track.name), ["Spine.quaternion"]);
    assert.ok(skinned[0].material.map);
  });
});

test("Three.js FBXLoader parses a skinned mesh with embedded texture content", async () => {
  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const bytes = exportFbx(createSkinnedCubeScene({ animated: true, textured: true }), {
      resolveTextureContent(fileName) {
        return fileName === "checker.tga" ? { content: checkerTga(), mimeType: "image/tga" } : null;
      }
    });
    const text = decode(bytes);
    const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");
    const skinned = [];
    group.traverse((object) => {
      if (object.isSkinnedMesh) {
        skinned.push(object);
      }
    });

    assert.match(text, /Content/);
    assert.equal(skinned.length, 1);
    assert.ok(skinned[0].material.map);
    assert.equal(group.animations.length, 1);
    assert.deepEqual(group.animations[0].tracks.map((track) => track.name), ["Spine.quaternion"]);
  });
});

test("Three.js FBXLoader parses skinned morph character sample with texture animation", async () => {
  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const bytes = exportFbx(createSkinnedMorphScene(), {
      resolveTextureContent(fileName) {
        return fileName === "checker.tga" ? { content: checkerTga(), mimeType: "image/tga" } : null;
      }
    });
    const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");
    const skinned = [];
    group.traverse((object) => {
      if (object.isSkinnedMesh) {
        skinned.push(object);
      }
    });

    assert.equal(skinned.length, 1);
    assert.deepEqual(skinned[0].skeleton.bones.map((bone) => bone.name), ["Root", "Spine"]);
    assert.ok(skinned[0].geometry.attributes.skinIndex);
    assert.ok(skinned[0].geometry.attributes.skinWeight);
    assert.deepEqual(skinned[0].geometry.morphAttributes.position.map((attribute) => attribute.name), ["ChestLift"]);
    assert.equal(skinned[0].morphTargetDictionary.ChestLift, 0);
    assert.ok(skinned[0].material.map);
    assert.equal(group.animations.length, 1);
    assert.ok(group.animations[0].tracks.some((track) => track.name === "Spine.quaternion"));
    assert.ok(group.animations[0].tracks.some((track) => track.name === "CharacterMesh.morphTargetInfluences[0]"));
  });
});

test("Blender imports a skinned mesh with armature, texture, and bone action", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "skinned-sample.fbx");
  await writeFile(join(tempDir, "checker.tga"), checkerTga());
  await writeFile(fbxPath, exportFbx(createSkinnedCubeScene({ animated: true, textured: true })));

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
images = [img for img in bpy.data.images if img.filepath]
actions = list(bpy.data.actions)
mesh = meshes[0] if meshes else None
modifiers = [mod.type for mod in mesh.modifiers] if mesh else []
vertex_groups = [group.name for group in mesh.vertex_groups] if mesh else []
bones = [bone.name for bone in armatures[0].data.bones] if armatures else []
print("FBX_VALIDATE:" + json.dumps({
    "meshes": len(meshes),
    "armatures": len(armatures),
    "bones": bones,
    "modifiers": modifiers,
    "vertexGroups": vertex_groups,
    "images": len(images),
    "actions": len(actions),
    "fcurves": len(actions[0].fcurves) if actions else 0,
}))
`;
  const result = spawnSync(blenderPath, blenderTestArgs(script, fbxPath), {
    encoding: "utf8"
  });

  await rm(tempDir, { recursive: true, force: true });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const match = result.stdout.match(/FBX_VALIDATE:(.+)/);
  assert.ok(match, result.stdout);
  const info = JSON.parse(match[1]);
  assert.equal(info.meshes, 1);
  assert.equal(info.armatures, 1);
  assert.deepEqual(info.bones, ["Root", "Spine"]);
  assert.deepEqual(info.modifiers, ["ARMATURE"]);
  assert.deepEqual(info.vertexGroups, ["Root", "Spine"]);
  assert.equal(info.images, 1);
  assert.equal(info.actions, 1);
  assert.equal(info.fcurves, 10);
});

test("Blender imports a skinned mesh with packed texture content", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "skinned-packed-texture.fbx");
  await writeFile(fbxPath, exportFbx(createSkinnedCubeScene({ animated: true, textured: true }), {
    resolveTextureContent(fileName) {
      return fileName === "checker.tga" ? { content: checkerTga(), mimeType: "image/tga" } : null;
    }
  }));

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
    "vertexGroups": [group.name for group in mesh.vertex_groups] if mesh else [],
    "images": len(images),
    "packedImages": len(packed_images),
    "actions": len(actions),
    "fcurves": len(actions[0].fcurves) if actions else 0,
}))
`;
  const result = spawnSync(blenderPath, blenderTestArgs(script, fbxPath), {
    encoding: "utf8"
  });

  await rm(tempDir, { recursive: true, force: true });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const match = result.stdout.match(/FBX_VALIDATE:(.+)/);
  assert.ok(match, result.stdout);
  const info = JSON.parse(match[1]);
  assert.equal(info.meshes, 1);
  assert.equal(info.armatures, 1);
  assert.deepEqual(info.bones, ["Root", "Spine"]);
  assert.deepEqual(info.vertexGroups, ["Root", "Spine"]);
  assert.equal(info.images, 1);
  assert.equal(info.packedImages, 1);
  assert.equal(info.actions, 1);
  assert.equal(info.fcurves, 10);
});

test("Blender imports two skinned meshes sharing one armature", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "shared-skeleton.fbx");
  await writeFile(fbxPath, exportFbx(sharedSkeletonScene()));

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
actions = list(bpy.data.actions)
print("FBX_VALIDATE:" + json.dumps({
    "meshes": len(meshes),
    "meshNames": sorted(obj.name for obj in meshes),
    "armatures": len(armatures),
    "bones": [bone.name for bone in armatures[0].data.bones] if armatures else [],
    "modifiers": [[mod.type for mod in mesh.modifiers] for mesh in meshes],
    "vertexGroups": [sorted(group.name for group in mesh.vertex_groups) for mesh in meshes],
    "actions": len(actions),
    "fcurves": len(actions[0].fcurves) if actions else 0,
}))
`;
  const result = spawnSync(blenderPath, blenderTestArgs(script, fbxPath), {
    encoding: "utf8"
  });

  await rm(tempDir, { recursive: true, force: true });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const match = result.stdout.match(/FBX_VALIDATE:(.+)/);
  assert.ok(match, result.stdout);
  const info = JSON.parse(match[1]);
  assert.equal(info.meshes, 2);
  assert.deepEqual(info.meshNames, ["Body", "Cloth"]);
  assert.equal(info.armatures, 1);
  assert.deepEqual(info.bones, ["Root", "Spine"]);
  assert.deepEqual(info.modifiers, [["ARMATURE"], ["ARMATURE"]]);
  assert.deepEqual(info.vertexGroups, [["Root", "Spine"], ["Root", "Spine"]]);
  assert.equal(info.actions, 1);
  assert.equal(info.fcurves, 10);
});
