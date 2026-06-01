import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  AnimationClip,
  Euler,
  Matrix4,
  NumberKeyframeTrack,
  Object3D,
  Quaternion,
  QuaternionKeyframeTrack,
  Uint8BufferAttribute,
  Vector3,
  VectorKeyframeTrack
} from "three";
import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { arrayBufferFrom, blenderPath, blenderTestArgs, checkerTga, hasBlender, withMockDocument } from "./fbx-test-helpers.js";
import { createThreeSkinnedFixture, createThreeSkinnedMorphFixture } from "./three-skinned-fixture.js";

function matrixElements({ translation = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  return new Matrix4().compose(
    new Vector3(...translation),
    new Quaternion().setFromEuler(new Euler(...rotation)),
    new Vector3(...scale)
  ).toArray();
}

function assertClose(actual, expected, epsilon = 1e-5) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} not close to ${expected}`);
}

function assertCloseArray(actual, expected, epsilon = 1e-5) {
  assert.equal(actual.length, expected.length);
  for (const [index, value] of actual.entries()) {
    assertClose(value, expected[index], epsilon);
  }
}

function twoIndependentThreeSkinnedScene() {
  const first = createThreeSkinnedFixture();
  const second = createThreeSkinnedFixture();
  const firstMesh = first.root.getObjectByName("ThreeSkinnedMesh");
  const secondMesh = second.root.getObjectByName("ThreeSkinnedMesh");

  firstMesh.name = "FirstSkinnedMesh";
  firstMesh.material.name = "FirstSkinMaterial";
  secondMesh.name = "SecondSkinnedMesh";
  secondMesh.material.name = "SecondSkinMaterial";
  secondMesh.position.set(2, 0, 0);

  const secondSpine = secondMesh.skeleton.bones.find((bone) => bone.name === "Spine");
  const identity = new Quaternion().toArray();
  const bend = new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 4)).toArray();

  const root = new Object3D();
  root.name = "TwoIndependentSkinnedScene";
  root.add(firstMesh, secondMesh);
  root.animations = [
    new AnimationClip("SecondRigBend", 1, [
      new QuaternionKeyframeTrack(`${secondSpine.uuid}.quaternion`, [0, 0.5, 1], [
        ...identity,
        ...bend,
        ...identity
      ])
    ])
  ];

  return root;
}

test("adapts a real Three.js SkinnedMesh and AnimationClip", () => {
  const { root } = createThreeSkinnedFixture();
  const spine = root.getObjectByName("Spine");
  spine.userData.rotationOrder = "ZYX";
  spine.userData.preRotation = [10, 20, 30];
  spine.userData.postRotation = [-10, -20, -30];
  spine.userData.pivot = [1, 2, 3];
  spine.userData.size = 12;
  const scene = normalizeFbxScene(fromThreeObject(root, { frameRate: 30 }));
  const spineBone = scene.meshes[0].skin.bones.find((bone) => bone.name === "Spine");

  assert.equal(scene.meshes.length, 1);
  assert.deepEqual(scene.nodes.map((node) => node.name), ["ThreeSkinnedScene"]);
  assert.equal(scene.meshes[0].skin.bones.length, 2);
  assert.deepEqual(scene.meshes[0].skin.bones.map((bone) => bone.name), ["Root", "Spine"]);
  assert.equal(spineBone.size, 12);
  assert.equal(spineBone.transform.rotationOrder, 5);
  assert.deepEqual(spineBone.transform.preRotation, [10, 20, 30]);
  assert.deepEqual(spineBone.transform.postRotation, [-10, -20, -30]);
  assert.deepEqual(spineBone.transform.rotationPivot, [1, 2, 3]);
  assert.deepEqual(spineBone.transform.scalingPivot, [1, 2, 3]);
  assert.equal(scene.meshes[0].skin.bindMatrix.length, 16);
  assert.equal(spineBone.inverseBindMatrix.length, 16);
  assert.equal(spineBone.inverseBindMatrix[13], -1);
  assert.deepEqual(scene.meshes[0].skin.clusters.map((cluster) => cluster.bone), ["Root", "Spine"]);
  assert.deepEqual(scene.meshes[0].skin.clusters[0].indices, [0, 1]);
  assert.deepEqual(scene.meshes[0].skin.clusters[1].indices, [2, 3]);
  assert.equal(scene.animations.length, 1);
  assert.equal(scene.animations[0].tracks[0].target, "Spine");
  assert.equal(scene.animations[0].tracks[0].property, "rotation");
  assert.ok(scene.animations[0].tracks[0].keyframes.length > 3);
  assert.equal(scene.meshes[0].materials[0].textures.length, 2);
  assert.deepEqual(scene.meshes[0].materials[0].textures.map((texture) => texture.property), ["DiffuseColor", "NormalMap"]);
});

test("adapts Three.js bone matrix animation tracks into transform curves", async () => {
  const { root } = createThreeSkinnedFixture();
  root.animations = [
    new AnimationClip("BoneMatrixMove", 1, [
      new VectorKeyframeTrack("Armature.bones[Spine].matrix.elements", [0, 1], [
        ...matrixElements(),
        ...matrixElements({
          translation: [0, 2, 3],
          rotation: [0, 0, Math.PI / 3],
          scale: [1, 2, 1]
        })
      ])
    ])
  ];

  const scene = normalizeFbxScene(fromThreeObject(root, {
    frameRate: 30,
    bakeAnimations: false
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), [
    "Spine",
    "Spine",
    "Spine"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "translation",
    "rotation",
    "scale"
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes[1].value, [0, 2, 3]);
  assertClose(scene.animations[0].tracks[1].keyframes[1].value[2], 60);
  assertCloseArray(scene.animations[0].tracks[2].keyframes[1].value, [1, 2, 1]);

  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(root, {
      frameRate: 30,
      bakeAnimations: false
    })), "");

    assert.deepEqual(group.animations[0].tracks.map((track) => track.name), [
      "Spine.position",
      "Spine.quaternion",
      "Spine.scale"
    ]);
  });
});

test("adapts Three.js bone quaternion component tracks into rotation curves", async () => {
  const { root } = createThreeSkinnedFixture();
  const quaternion = new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 5));
  root.animations = [
    new AnimationClip("BoneQuaternionComponents", 1, [
      new NumberKeyframeTrack("Armature.bones[Spine].quaternion[z]", [0, 1], [
        0,
        quaternion.z
      ]),
      new NumberKeyframeTrack("Armature.bones[Spine].quaternion[3]", [0, 1], [
        1,
        quaternion.w
      ])
    ])
  ];

  const scene = normalizeFbxScene(fromThreeObject(root, {
    frameRate: 30,
    bakeAnimations: false
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["Spine", "rotation"]
  ]);
  assert.equal(scene.animations[0].tracks[0].keyframes.length, 2);
  assertClose(scene.animations[0].tracks[0].keyframes[1].value[2], 36);

  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(root, {
      frameRate: 30,
      bakeAnimations: false
    })), "");

    assert.deepEqual(group.animations[0].tracks.map((track) => track.name), [
      "Spine.quaternion"
    ]);
  });
});

test("collects local animation clips attached directly to skeleton bones", async () => {
  const { root } = createThreeSkinnedFixture();
  const spine = root.getObjectByName("Spine");
  root.animations = [];

  const identity = new Quaternion().toArray();
  const bend = new Quaternion().setFromEuler(new Euler(0, Math.PI / 5, 0)).toArray();
  spine.animations = [
    new AnimationClip("DirectBoneBend", 1, [
      new QuaternionKeyframeTrack("quaternion", [0, 1], [
        ...identity,
        ...bend
      ])
    ])
  ];

  const scene = normalizeFbxScene(fromThreeObject(root, {
    frameRate: 30,
    bakeAnimations: false
  }));

  assert.equal(scene.animations.length, 1);
  assert.equal(scene.animations[0].name, "DirectBoneBend");
  assert.equal(scene.animations[0].tracks[0].target, "Spine");
  assert.equal(scene.animations[0].tracks[0].property, "rotation");
  assert.equal(scene.animations[0].tracks[0].keyframes.length, 2);

  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(root, {
      frameRate: 30,
      bakeAnimations: false
    })), "");

    assert.deepEqual(group.animations.map((clip) => clip.name), ["DirectBoneBend"]);
    assert.deepEqual(group.animations[0].tracks.map((track) => track.name), ["Spine.quaternion"]);
  });
});

test("collects local animation clips attached to skeleton bone userData", () => {
  const { root } = createThreeSkinnedFixture();
  const spine = root.getObjectByName("Spine");
  root.animations = [];

  const identity = new Quaternion().toArray();
  const bend = new Quaternion().setFromEuler(new Euler(Math.PI / 9, 0, 0)).toArray();
  spine.userData.animations = [
    new AnimationClip("BoneUserDataBend", 1, [
      new QuaternionKeyframeTrack("quaternion", [0, 1], [
        ...identity,
        ...bend
      ])
    ])
  ];

  const scene = normalizeFbxScene(fromThreeObject(root, {
    frameRate: 30,
    bakeAnimations: false
  }));

  assert.equal(scene.animations.length, 1);
  assert.equal(scene.animations[0].name, "BoneUserDataBend");
  assert.equal(scene.animations[0].tracks[0].target, "Spine");
  assert.equal(scene.animations[0].tracks[0].property, "rotation");
  assert.equal(scene.animations[0].tracks[0].keyframes.length, 2);
});

test("collects local animation clips from detached skeleton bones", async () => {
  const { root } = createThreeSkinnedFixture();
  const mesh = root.getObjectByName("ThreeSkinnedMesh");
  const [rootBone, spine] = mesh.skeleton.bones;
  mesh.remove(rootBone);
  root.animations = [];

  const identity = new Quaternion().toArray();
  const bend = new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 8)).toArray();
  spine.animations = [
    new AnimationClip("DetachedBoneBend", 1, [
      new QuaternionKeyframeTrack("quaternion", [0, 1], [
        ...identity,
        ...bend
      ])
    ])
  ];

  const scene = normalizeFbxScene(fromThreeObject(root, {
    frameRate: 30,
    bakeAnimations: false
  }));

  assert.deepEqual(scene.nodes.map((node) => node.name), ["ThreeSkinnedScene"]);
  assert.deepEqual(scene.meshes[0].skin.bones.map((bone) => bone.name), ["Root", "Spine"]);
  assert.equal(scene.animations.length, 1);
  assert.equal(scene.animations[0].name, "DetachedBoneBend");
  assert.equal(scene.animations[0].tracks[0].target, "Spine");
  assert.equal(scene.animations[0].tracks[0].property, "rotation");

  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(root, {
      frameRate: 30,
      bakeAnimations: false
    })), "");

    assert.deepEqual(group.animations.map((clip) => clip.name), ["DetachedBoneBend"]);
    assert.deepEqual(group.animations[0].tracks.map((track) => track.name), ["Spine.quaternion"]);
  });
});

test("respects explicit animation option root targets for skeleton bones", async () => {
  const { root } = createThreeSkinnedFixture();
  const spine = root.getObjectByName("Spine");
  root.animations = [];

  const identity = new Quaternion().toArray();
  const bend = new Quaternion().setFromEuler(new Euler(Math.PI / 7, 0, 0)).toArray();
  const clip = new AnimationClip("OptionBoneBend", 1, [
    new QuaternionKeyframeTrack("quaternion", [0, 1], [
      ...identity,
      ...bend
    ])
  ]);
  const options = {
    animations: [{ clip, rootTrackTarget: spine }],
    frameRate: 30,
    bakeAnimations: false
  };

  const scene = normalizeFbxScene(fromThreeObject(root, options));

  assert.equal(scene.animations.length, 1);
  assert.equal(scene.animations[0].name, "OptionBoneBend");
  assert.equal(scene.animations[0].tracks[0].target, "Spine");
  assert.equal(scene.animations[0].tracks[0].property, "rotation");
  assert.equal(scene.animations[0].tracks[0].keyframes.length, 2);

  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(root, options)), "");

    assert.deepEqual(group.animations.map((animation) => animation.name), ["OptionBoneBend"]);
    assert.deepEqual(group.animations[0].tracks.map((track) => track.name), ["Spine.quaternion"]);
  });
});

test("keeps skeleton bones out of generic hierarchy while preserving UUID animation targets", () => {
  const { root } = createThreeSkinnedFixture();
  const spine = root.getObjectByName("Spine");
  const identity = new Quaternion().toArray();
  const bend = new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 4)).toArray();
  root.animations = [
    new AnimationClip("UuidBoneBend", 1, [
      new QuaternionKeyframeTrack(`${spine.uuid}.quaternion`, [0, 0.5, 1], [
        ...identity,
        ...bend,
        ...identity
      ])
    ])
  ];

  const scene = normalizeFbxScene(fromThreeObject(root, {
    frameRate: 30,
    bakeAnimations: false
  }));

  assert.deepEqual(scene.nodes.map((node) => node.name), ["ThreeSkinnedScene"]);
  assert.deepEqual(scene.meshes[0].skin.bones.map((bone) => bone.name), ["Root", "Spine"]);
  assert.equal(scene.animations[0].tracks[0].target, "Spine");
  assert.equal(scene.animations[0].tracks[0].property, "rotation");
  assert.equal(scene.animations[0].tracks[0].keyframes.length, 3);
});

test("disambiguates independent Three.js skeletons with matching bone names", async () => {
  const root = twoIndependentThreeSkinnedScene();
  const scene = normalizeFbxScene(fromThreeObject(root, {
    frameRate: 30,
    bakeAnimations: false
  }));

  assert.deepEqual(scene.meshes.map((mesh) => mesh.skin.bones.map((bone) => bone.name)), [
    ["Root", "Spine"],
    ["Root_2", "Spine_2"]
  ]);
  assert.equal(scene.animations[0].tracks[0].target, "Spine_2");

  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(root, {
      frameRate: 30,
      bakeAnimations: false
    })), "");
    const skinned = [];
    group.traverse((object) => {
      if (object.isSkinnedMesh) {
        skinned.push(object);
      }
    });

    assert.equal(skinned.length, 2);
    assert.deepEqual(skinned.map((mesh) => mesh.skeleton.bones.map((bone) => bone.name)), [
      ["Root", "Spine"],
      ["Root_2", "Spine_2"]
    ]);
    assert.deepEqual(group.animations[0].tracks.map((track) => track.name), ["Spine_2.quaternion"]);
  });
});

test("normalizes Three.js integer skin weights before FBX export", () => {
  const { root } = createThreeSkinnedFixture();
  const geometry = root.getObjectByName("ThreeSkinnedMesh").geometry;
  geometry.setAttribute("skinWeight", new Uint8BufferAttribute([
    255, 0, 0, 0,
    255, 0, 0, 0,
    128, 0, 0, 0,
    128, 0, 0, 0
  ], 4, true));

  const scene = normalizeFbxScene(fromThreeObject(root, { frameRate: 30 }));
  const [rootCluster, spineCluster] = scene.meshes[0].skin.clusters;

  assert.deepEqual(rootCluster.weights, [1, 1]);
  assert.ok(Math.abs(spineCluster.weights[0] - 128 / 255) <= 1e-6);
  assert.ok(Math.abs(spineCluster.weights[1] - 128 / 255) <= 1e-6);
});

test("uses stable fallback names for unnamed Three.js bones and clusters", async () => {
  const { root } = createThreeSkinnedFixture();
  const mesh = root.getObjectByName("ThreeSkinnedMesh");
  for (const bone of mesh.skeleton.bones) {
    bone.name = "";
  }
  root.animations = [];

  const scene = normalizeFbxScene(fromThreeObject(root, { frameRate: 30 }));
  const skin = scene.meshes[0].skin;

  assert.deepEqual(skin.bones.map((bone) => bone.name), ["Bone_1", "Bone_2"]);
  assert.equal(skin.bones[1].parent, "Bone_1");
  assert.deepEqual(skin.clusters.map((cluster) => cluster.bone), ["Bone_1", "Bone_2"]);
  assert.deepEqual(skin.clusters[0].indices, [0, 1]);
  assert.deepEqual(skin.clusters[1].indices, [2, 3]);

  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(root, { frameRate: 30 })), "");
    const exported = group.getObjectByName("ThreeSkinnedMesh");

    assert.deepEqual(exported.skeleton.bones.map((bone) => bone.name), ["Bone_1", "Bone_2"]);
    assert.ok(exported.geometry.attributes.skinIndex);
    assert.ok(exported.geometry.attributes.skinWeight);
  });
});

test("adapts namespaced Three.js bone animation targets even when bones are detached", () => {
  const { root } = createThreeSkinnedFixture();
  const mesh = root.getObjectByName("ThreeSkinnedMesh");
  const [rootBone, spineBone] = mesh.skeleton.bones;
  rootBone.name = "mixamorig:Root";
  spineBone.name = "mixamorig:Spine";
  mesh.remove(rootBone);

  const identity = new Quaternion().toArray();
  const bend = new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 6)).toArray();
  root.animations = [
    new AnimationClip("NamespacedBoneBend", 1, [
      new QuaternionKeyframeTrack("mixamorig:Spine.quaternion", [0, 0.5, 1], [
        ...identity,
        ...bend,
        ...identity
      ])
    ])
  ];

  const scene = normalizeFbxScene(fromThreeObject(root, {
    frameRate: 30,
    bakeAnimations: false
  }));

  assert.deepEqual(scene.meshes[0].skin.bones.map((bone) => bone.name), [
    "mixamorig:Root",
    "mixamorig:Spine"
  ]);
  assert.equal(scene.animations.length, 1);
  assert.equal(scene.animations[0].tracks[0].target, "mixamorig:Spine");
  assert.equal(scene.animations[0].tracks[0].property, "rotation");
  assert.equal(scene.animations[0].tracks[0].keyframes.length, 3);
});

test("exports real Three.js skinned data into an FBXLoader-readable file", async () => {
  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const { root } = createThreeSkinnedFixture();
    const bytes = exportFbx(root, { frameRate: 30 });
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
    assert.equal(group.animations.length, 1);
    assert.deepEqual(group.animations[0].tracks.map((track) => track.name), ["Spine.quaternion"]);
    assert.ok(skinned[0].material.map);
    assert.ok(skinned[0].material.normalMap);
  });
});

test("adapts a real Three.js skinned morph character with texture animation", async () => {
  const { root } = createThreeSkinnedMorphFixture();
  const scene = normalizeFbxScene(fromThreeObject(root, {
    frameRate: 30,
    bakeAnimations: false
  }));
  const mesh = scene.meshes[0];
  const tracks = scene.animations[0].tracks;

  assert.equal(mesh.name, "ThreeSkinnedMorphMesh");
  assert.deepEqual(mesh.skin.bones.map((bone) => bone.name), ["Root", "Spine"]);
  assert.deepEqual(mesh.geometry.morphTargets.map((target) => target.name), ["ChestLift"]);
  assert.equal(mesh.geometry.morphTargets[0].weight, 0.2);
  assert.deepEqual(tracks.map((track) => [track.target, track.property, track.morphTarget || null]), [
    ["Spine", "rotation", null],
    ["ThreeSkinnedMorphMesh", "morph", "ChestLift"],
    ["checker", "textureTranslation", null]
  ]);
  assertCloseArray(tracks[1].keyframes.map((keyframe) => keyframe.value), [0.2, 1, 0.2]);
  assert.deepEqual(tracks[2].keyframes.map((keyframe) => keyframe.value), [
    [0, 0, 0],
    [0.25, 0.125, 0]
  ]);

  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(root, {
      frameRate: 30,
      bakeAnimations: false,
      resolveTextureContent(fileName) {
        return fileName === "checker.tga" || fileName === "normal.tga"
          ? { content: checkerTga(), mimeType: "image/tga" }
          : null;
      }
    })), "");
    const skinned = [];
    group.traverse((object) => {
      if (object.isSkinnedMesh) {
        skinned.push(object);
      }
    });

    assert.equal(skinned.length, 1);
    assert.deepEqual(skinned[0].skeleton.bones.map((bone) => bone.name), ["Root", "Spine"]);
    assert.deepEqual(skinned[0].geometry.morphAttributes.position.map((attribute) => attribute.name), ["ChestLift"]);
    assert.equal(skinned[0].morphTargetDictionary.ChestLift, 0);
    assert.ok(skinned[0].material.map);
    assert.ok(skinned[0].material.normalMap);
    assert.ok(group.animations[0].tracks.some((track) => track.name === "Spine.quaternion"));
    assert.ok(group.animations[0].tracks.some((track) => track.name === "ThreeSkinnedMorphMesh.morphTargetInfluences[0]"));
  });
});

test("Blender imports FBX exported from real Three.js skinned data", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "three-skinned.fbx");
  const { root } = createThreeSkinnedFixture();
  await writeFile(join(tempDir, "checker.tga"), checkerTga());
  await writeFile(join(tempDir, "normal.tga"), checkerTga());
  await writeFile(fbxPath, exportFbx(root, { frameRate: 30 }));

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
print("FBX_VALIDATE:" + json.dumps({
    "meshes": len(meshes),
    "armatures": len(armatures),
    "bones": [bone.name for bone in armatures[0].data.bones] if armatures else [],
    "vertexGroups": [group.name for group in mesh.vertex_groups] if mesh else [],
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
  assert.deepEqual(info.vertexGroups, ["Root", "Spine"]);
  assert.equal(info.images, 2);
  assert.equal(info.actions, 1);
  assert.equal(info.fcurves, 10);
});

test("Blender imports FBX exported from a real Three.js skinned morph character", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "three-skinned-morph.fbx");
  const { root } = createThreeSkinnedMorphFixture();
  await writeFile(join(tempDir, "checker.tga"), checkerTga());
  await writeFile(join(tempDir, "normal.tga"), checkerTga());
  await writeFile(fbxPath, exportFbx(root, { frameRate: 30, bakeAnimations: false }));

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
images = [img for img in bpy.data.images if img.filepath]
mesh = meshes[0] if meshes else None
shape_keys = mesh.data.shape_keys if mesh and mesh.data.shape_keys else None
print("FBX_VALIDATE:" + json.dumps({
    "meshes": len(meshes),
    "armatures": len(armatures),
    "bones": [bone.name for bone in armatures[0].data.bones] if armatures else [],
    "vertexGroups": [group.name for group in mesh.vertex_groups] if mesh else [],
    "shapeKeys": [key.name for key in shape_keys.key_blocks] if shape_keys else [],
    "animatedShapeKeys": bool(shape_keys and shape_keys.animation_data and shape_keys.animation_data.action),
    "images": len(images),
    "actions": sorted((action.name, len(action.fcurves)) for action in bpy.data.actions),
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
  assert.deepEqual(info.shapeKeys, ["Basis", "ChestLift"]);
  assert.equal(info.animatedShapeKeys, true);
  assert.equal(info.images, 2);
  assert.deepEqual(info.actions, [
    ["Armature|ThreeCharacterPerformance", 10],
    ["Key|ThreeCharacterPerformance", 1]
  ]);
});
