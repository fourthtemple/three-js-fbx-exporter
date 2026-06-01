import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  AnimationClip,
  BufferGeometry,
  Euler,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
  VectorKeyframeTrack
} from "three";
import { createHierarchyScene, exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { arrayBufferFrom, blenderPath, blenderTestArgs, decode, hasBlender, withMockDocument } from "./fbx-test-helpers.js";

function hierarchyScene() {
  return createHierarchyScene({ name: "HierarchyScene" });
}

function pivotHierarchyScene() {
  const scene = createHierarchyScene({ name: "PivotHierarchyScene" });
  scene.nodes[0].transform.rotationOrder = "ZYX";
  scene.nodes[0].transform.rotationOffset = [0.1, 0.2, 0.3];
  scene.nodes[0].transform.rotationPivot = { x: 1, y: 2, z: 3 };
  scene.nodes[0].transform.preRotation = [10, 20, 30];
  scene.nodes[0].transform.postRotation = [-10, -20, -30];
  scene.nodes[0].transform.scalingOffset = [0.4, 0.5, 0.6];
  scene.nodes[0].transform.scalingPivot = { x: 4, y: 5, z: 6 };
  scene.nodes[0].transform.geometricTranslation = [7, 8, 9];
  scene.nodes[0].transform.geometricRotation = [11, 12, 13];
  scene.nodes[0].transform.geometricScaling = [1.5, 1.25, 0.75];
  return scene;
}

function threeHierarchyScene() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0,
    -1, 1, 0
  ], 3));
  geometry.setAttribute("normal", new Float32BufferAttribute([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1
  ], 3));
  geometry.setAttribute("uv", new Float32BufferAttribute([
    0, 0,
    1, 0,
    1, 1,
    0, 1
  ], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);

  const scene = new Scene();
  scene.name = "ThreeHierarchyScene";

  const parent = new Object3D();
  parent.name = "ParentCtrl";
  parent.position.set(1, 2, 3);
  scene.add(parent);

  const mesh = new Mesh(geometry, new MeshBasicMaterial({ name: "Mat" }));
  mesh.name = "Cube";
  parent.add(mesh);

  scene.animations = [
    new AnimationClip("ParentMove", 1, [
      new VectorKeyframeTrack("ParentCtrl.position", [0, 1], [1, 2, 3, 2, 2, 3])
    ])
  ];

  return scene;
}

function threePivotHierarchyScene() {
  const scene = threeHierarchyScene();
  const parent = scene.getObjectByName("ParentCtrl");
  parent.userData.rotationOffset = [0.1, 0.2, 0.3];
  parent.userData.rotationPivot = { x: 1, y: 2, z: 3 };
  parent.userData.fbxRotationOrder = 5;
  parent.userData.preRotation = [10, 20, 30];
  parent.userData.postRotation = [-10, -20, -30];
  parent.userData.scalingOffset = [0.4, 0.5, 0.6];
  parent.userData.scalingPivot = [4, 5, 6];
  parent.userData.geometricTranslation = [7, 8, 9];
  parent.userData.geometricRotation = [11, 12, 13];
  parent.userData.geometricScaling = [1.5, 1.25, 0.75];
  return scene;
}

function threePathAnimatedHierarchyScene() {
  const scene = threeHierarchyScene();
  scene.animations = [
    new AnimationClip("ChildPathMove", 1, [
      new VectorKeyframeTrack("ParentCtrl/Cube.position", [0, 1], [0, 0, 0, 1, 0, 0])
    ])
  ];
  return scene;
}

function threeMeshParentHierarchyScene() {
  const scene = threeHierarchyScene();
  const parentMesh = scene.getObjectByName("Cube");
  const childMesh = new Mesh(parentMesh.geometry.clone(), new MeshBasicMaterial({ name: "ChildMat" }));
  childMesh.name = "Badge";
  childMesh.position.set(0.25, 0.5, 0);
  parentMesh.add(childMesh);

  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.name = "BadgeCam";
  childMesh.add(camera);

  scene.animations = [
    new AnimationClip("MeshChildMove", 1, [
      new VectorKeyframeTrack("ParentCtrl/Cube.position", [0, 1], [0, 0, 0, 1, 0, 0]),
      new VectorKeyframeTrack("ParentCtrl/Cube/Badge.position", [0, 1], [0.25, 0.5, 0, 0.25, 1, 0])
    ])
  ];

  return scene;
}

function threeMatrixHierarchyScene() {
  const scene = threeHierarchyScene();
  const parent = scene.getObjectByName("ParentCtrl");
  parent.position.set(0, 0, 0);
  parent.rotation.set(0, 0, 0);
  parent.scale.set(1, 1, 1);
  parent.matrixAutoUpdate = false;
  parent.matrix = new Matrix4().compose(
    new Vector3(2, 3, 4),
    new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 2)),
    new Vector3(2, 3, 4)
  );
  return scene;
}

function assertClose(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} not close to ${expected}`);
}

test("exports null hierarchy nodes and parented meshes", () => {
  const scene = normalizeFbxScene(hierarchyScene());
  assert.equal(scene.nodes.length, 1);
  assert.equal(scene.meshes[0].parent, "ParentCtrl");

  const text = decode(exportFbx(scene));
  assert.match(text, /ParentCtrl/);
  assert.match(text, /NodeAttribute/);
  assert.match(text, /Null/);
  assert.match(text, /ParentMove/);
});

test("Three.js FBXLoader parses exported hierarchy and parent animation", async () => {
  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(hierarchyScene())), "");
  const parent = group.getObjectByName("ParentCtrl");
  const mesh = group.getObjectByName("Cube");

  assert.ok(parent);
  assert.ok(mesh?.isMesh);
  assert.equal(mesh.parent, parent);
  assert.deepEqual(parent.children.map((child) => child.name), ["Cube"]);
  assert.equal(group.animations.length, 1);
  assert.deepEqual(group.animations[0].tracks.map((track) => track.name), ["ParentCtrl.position"]);
});

test("exports model rotation and scaling pivots", () => {
  const scene = normalizeFbxScene(pivotHierarchyScene());
  const transform = scene.nodes[0].transform;

  assert.equal(transform.rotationOrder, 5);
  assert.deepEqual(transform.rotationOffset, [0.1, 0.2, 0.3]);
  assert.deepEqual(transform.rotationPivot, [1, 2, 3]);
  assert.deepEqual(transform.preRotation, [10, 20, 30]);
  assert.deepEqual(transform.postRotation, [-10, -20, -30]);
  assert.deepEqual(transform.scalingOffset, [0.4, 0.5, 0.6]);
  assert.deepEqual(transform.scalingPivot, [4, 5, 6]);
  assert.deepEqual(transform.geometricTranslation, [7, 8, 9]);
  assert.deepEqual(transform.geometricRotation, [11, 12, 13]);
  assert.deepEqual(transform.geometricScaling, [1.5, 1.25, 0.75]);

  const text = decode(exportFbx(scene));
  assert.match(text, /QuaternionInterpolate/);
  assert.match(text, /RotationOrder/);
  assert.match(text, /RotationOffset/);
  assert.match(text, /RotationPivot/);
  assert.match(text, /PreRotation/);
  assert.match(text, /PostRotation/);
  assert.match(text, /ScalingOffset/);
  assert.match(text, /ScalingPivot/);
  assert.match(text, /GeometricTranslation/);
  assert.match(text, /GeometricRotation/);
  assert.match(text, /GeometricScaling/);
});

test("adapts Three.js Object3D parents as FBX null hierarchy nodes", async () => {
  const source = threeHierarchyScene();
  const scene = fromThreeObject(source, { frameRate: 30 });

  assert.deepEqual(scene.nodes.map((node) => node.name), ["ParentCtrl"]);
  assert.equal(scene.meshes[0].parent, "ParentCtrl");
  assert.equal(scene.animations[0].tracks[0].target, "ParentCtrl");

  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(source, { frameRate: 30 })), "");
  assert.equal(group.getObjectByName("Cube").parent.name, "ParentCtrl");
  assert.deepEqual(group.animations[0].tracks.map((track) => track.name), ["ParentCtrl.position"]);
});

test("adapts Three.js path-prefixed hierarchy animation tracks", async () => {
  const source = threePathAnimatedHierarchyScene();
  const scene = fromThreeObject(source, { frameRate: 30 });

  assert.equal(scene.animations[0].tracks[0].target, "Cube");
  assert.equal(scene.animations[0].tracks[0].property, "translation");

  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(source, { frameRate: 30 })), "");
  assert.deepEqual(group.animations[0].tracks.map((track) => track.name), ["Cube.position"]);
});

test("adapts Three.js objects parented under meshes", async () => {
  const source = threeMeshParentHierarchyScene();
  const scene = fromThreeObject(source, { frameRate: 30 });
  const childMesh = scene.meshes.find((mesh) => mesh.name === "Badge");
  const camera = scene.cameras.find((entry) => entry.name === "BadgeCam");

  assert.equal(scene.meshes.find((mesh) => mesh.name === "Cube").parent, "ParentCtrl");
  assert.equal(childMesh.parent, "Cube");
  assert.equal(camera.parent, "Badge");
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), ["Cube", "Badge"]);

  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(source, { frameRate: 30 })), "");
    assert.equal(group.getObjectByName("Badge").parent.name, "Cube");
    assert.equal(group.getObjectByName("BadgeCam").parent.name, "Badge");
    assert.deepEqual(group.animations[0].tracks.map((track) => track.name), ["Cube.position", "Badge.position"]);
  });
});

test("adapts Three.js matrixAutoUpdate false local transforms", async () => {
  const source = threeMatrixHierarchyScene();
  const scene = fromThreeObject(source, { frameRate: 30 });
  const transform = scene.nodes[0].transform;

  assert.deepEqual(transform.translation, [2, 3, 4]);
  assert.deepEqual(transform.scale, [2, 3, 4]);
  assertClose(transform.rotation[2], 90);

  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(source, { frameRate: 30 })), "");
  const parent = group.getObjectByName("ParentCtrl");
  assertClose(parent.position.x, 2);
  assertClose(parent.position.y, 3);
  assertClose(parent.position.z, 4);
  assertClose(parent.scale.x, 2);
  assertClose(parent.scale.y, 3);
  assertClose(parent.scale.z, 4);
});

test("adapts Three.js userData model pivots", () => {
  const scene = fromThreeObject(threePivotHierarchyScene(), { frameRate: 30 });
  const transform = scene.nodes[0].transform;

  assert.equal(transform.rotationOrder, 5);
  assert.deepEqual(transform.rotationOffset, [0.1, 0.2, 0.3]);
  assert.deepEqual(transform.rotationPivot, [1, 2, 3]);
  assert.deepEqual(transform.preRotation, [10, 20, 30]);
  assert.deepEqual(transform.postRotation, [-10, -20, -30]);
  assert.deepEqual(transform.scalingOffset, [0.4, 0.5, 0.6]);
  assert.deepEqual(transform.scalingPivot, [4, 5, 6]);
  assert.deepEqual(transform.geometricTranslation, [7, 8, 9]);
  assert.deepEqual(transform.geometricRotation, [11, 12, 13]);
  assert.deepEqual(transform.geometricScaling, [1.5, 1.25, 0.75]);
});

test("Blender imports null hierarchy nodes as empties with parented meshes", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "hierarchy.fbx");
  await writeFile(fbxPath, exportFbx(hierarchyScene()));

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
  const result = spawnSync(blenderPath, blenderTestArgs(script, fbxPath), {
    encoding: "utf8"
  });

  await rm(tempDir, { recursive: true, force: true });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const match = result.stdout.match(/FBX_VALIDATE:(.+)/);
  assert.ok(match, result.stdout);
  const info = JSON.parse(match[1]);
  assert.deepEqual(info.objects, [
    ["Cube", "MESH", "ParentCtrl"],
    ["ParentCtrl", "EMPTY", null]
  ]);
  assert.deepEqual(info.actions, [["ParentCtrl|ParentMove", 9]]);
});
