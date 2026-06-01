import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  AnimationClip,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  NumberKeyframeTrack,
  Scene
} from "three";
import { createMorphScene, createStaticMeshFbxDocument, exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { arrayBufferFrom, blenderPath, blenderTestArgs, decode, hasBlender } from "./fbx-test-helpers.js";

function morphScene() {
  return createMorphScene({ name: "MorphScene" });
}

function rounded(values) {
  return values.map((value) => Number(value.toFixed(4)));
}

function morphNormalScene() {
  return {
    name: "MorphNormalScene",
    meshes: [
      {
        name: "MorphQuad",
        materials: [{ name: "MorphMaterial" }],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          morphTargets: [
            {
              name: "TiltNormal",
              indices: [2, 3],
              vertices: [0, 0, 0.5, 0, 0, 0.5],
              normals: [0.2, 0, 0, 0.3, 0, 0]
            }
          ]
        }
      }
    ]
  };
}

function threeMorphScene() {
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
  const morph = new Float32BufferAttribute([
    0, 0, 0,
    0, 0, 0,
    0, 0, 0.5,
    0, 0, 0.5
  ], 3);
  morph.name = "Puff";
  const morphNormal = new Float32BufferAttribute([
    0, 0, 0,
    0, 0, 0,
    0.2, 0, 0,
    0.3, 0, 0
  ], 3);
  morphNormal.name = "Puff";
  geometry.morphAttributes.position = [morph];
  geometry.morphAttributes.normal = [morphNormal];
  geometry.morphTargetsRelative = true;

  const mesh = new Mesh(geometry, new MeshBasicMaterial({ name: "MorphMaterial" }));
  mesh.name = "MorphQuad";

  const scene = new Scene();
  scene.name = "ThreeMorphScene";
  scene.add(mesh);
  scene.animations = [
    new AnimationClip("PuffAction", 1, [
      new NumberKeyframeTrack("MorphQuad.morphTargetInfluences[0]", [0, 1], [0, 1])
    ])
  ];
  return scene;
}

function threeNamedMorphScene() {
  const scene = threeMorphScene();
  scene.name = "ThreeNamedMorphScene";
  scene.animations = [
    new AnimationClip("NamedPuffAction", 1, [
      new NumberKeyframeTrack("MorphQuad.morphTargetInfluences[Puff]", [0, 1], [0.25, 0.75])
    ])
  ];
  return scene;
}

function threeDefaultMorphWeightScene() {
  const scene = threeMorphScene();
  scene.name = "ThreeDefaultMorphWeightScene";
  const mesh = scene.getObjectByName("MorphQuad");
  mesh.morphTargetInfluences = [0.35];
  scene.animations = [];
  return scene;
}

function threeMorphArrayScene() {
  const scene = threeMorphScene();
  scene.name = "ThreeMorphArrayScene";
  const mesh = scene.getObjectByName("MorphQuad");
  const stretch = new Float32BufferAttribute([
    0, 0, 0,
    0, 0, 0.25,
    0, 0, 0.25,
    0, 0, 0
  ], 3);
  stretch.name = "Stretch";
  const stretchNormal = new Float32BufferAttribute([
    0, 0, 0,
    0, 0.1, 0,
    0, 0.1, 0,
    0, 0, 0
  ], 3);
  stretchNormal.name = "Stretch";
  mesh.geometry.morphAttributes.position.push(stretch);
  mesh.geometry.morphAttributes.normal.push(stretchNormal);
  mesh.updateMorphTargets();
  scene.animations = [
    new AnimationClip("AllMorphsAction", 1, [
      new NumberKeyframeTrack("MorphQuad.morphTargetInfluences", [0, 1], [0, 0.2, 1, 0.8])
    ])
  ];
  return scene;
}

function threeDictionaryMorphScene() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0,
    -1, 1, 0
  ], 3));
  geometry.setIndex([0, 1, 2]);
  geometry.morphAttributes.position = [
    new Float32BufferAttribute([
      -1, -1, 0,
      1, -1, 0,
      1, 1, 0.4
    ], 3)
  ];

  const mesh = new Mesh(geometry, new MeshBasicMaterial({ name: "MorphMaterial" }));
  mesh.name = "MorphTriangle";
  mesh.morphTargetDictionary = { Smile: 0 };
  mesh.morphTargetInfluences = [0];

  const scene = new Scene();
  scene.name = "ThreeDictionaryMorphScene";
  scene.add(mesh);
  scene.animations = [
    new AnimationClip("SmileAction", 1, [
      new NumberKeyframeTrack("MorphTriangle.morphTargetInfluences[0]", [0, 1], [0, 1])
    ])
  ];
  return scene;
}

function threeNamedDictionaryMorphScene() {
  const scene = threeDictionaryMorphScene();
  scene.name = "ThreeNamedDictionaryMorphScene";
  scene.animations = [
    new AnimationClip("NamedSmileAction", 1, [
      new NumberKeyframeTrack("MorphTriangle.morphTargetInfluences[Smile]", [0, 1], [0.2, 1])
    ])
  ];
  return scene;
}

function findShapeGeometry(nodes) {
  for (const node of nodes) {
    if (node.name === "Geometry" && node.properties[2] === "Shape") {
      return node;
    }
    const child = findShapeGeometry(node.children || []);
    if (child) {
      return child;
    }
  }
  return null;
}

test("exports blend shape geometry, deformers, and influence animation records", () => {
  const scene = normalizeFbxScene(morphScene());
  const morphTarget = scene.meshes[0].geometry.morphTargets[0];
  assert.deepEqual(morphTarget.indices, [2, 3]);
  assert.deepEqual(morphTarget.vertices, [0, 0, 0.5, 0, 0, 0.5]);

  const text = decode(exportFbx(scene));
  assert.match(text, /BlendShape/);
  assert.match(text, /BlendShapeChannel/);
  assert.match(text, /Puff/);
  assert.match(text, /DeformPercent/);
});

test("exports sparse morph target normal deltas", () => {
  const scene = normalizeFbxScene(morphNormalScene());
  const morphTarget = scene.meshes[0].geometry.morphTargets[0];
  assert.deepEqual(morphTarget.indices, [2, 3]);
  assert.deepEqual(morphTarget.normals, [0.2, 0, 0, 0.3, 0, 0]);

  const document = createStaticMeshFbxDocument(morphNormalScene());
  const shape = findShapeGeometry(document);
  const normals = shape.children.find((node) => node.name === "Normals");
  assert.deepEqual(Array.from(normals.properties[0].value), [0.2, 0, 0, 0.3, 0, 0]);
});

test("Three.js FBXLoader parses blend shapes and morph influence animation", async () => {
  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(morphScene())), "");
  const mesh = group.getObjectByName("MorphQuad");

  assert.equal(mesh.geometry.morphTargetsRelative, true);
  assert.deepEqual(mesh.geometry.morphAttributes.position.map((attribute) => attribute.name), ["Puff"]);
  assert.equal(mesh.morphTargetDictionary.Puff, 0);
  assert.equal(group.animations.length, 1);
  assert.deepEqual(group.animations[0].tracks.map((track) => track.name), [
    "MorphQuad.morphTargetInfluences[0]"
  ]);
  assert.deepEqual(Array.from(group.animations[0].tracks[0].values), [0, 1]);
});

test("adapts Three.js morph target geometry and morphTargetInfluences animation", async () => {
  const scene = fromThreeObject(threeMorphScene(), { frameRate: 30 });
  const mesh = scene.meshes[0];

  assert.deepEqual(mesh.geometry.morphTargets.map((target) => target.name), ["Puff"]);
  assert.deepEqual(rounded(mesh.geometry.morphTargets[0].normals), [
    0, 0, 0,
    0, 0, 0,
    0.2, 0, 0,
    0.3, 0, 0
  ]);
  assert.equal(scene.animations[0].tracks[0].property, "morph");
  assert.equal(scene.animations[0].tracks[0].morphTarget, "Puff");

  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(threeMorphScene(), { frameRate: 30 })), "");
  const exportedMesh = group.getObjectByName("MorphQuad");
  assert.equal(exportedMesh.morphTargetDictionary.Puff, 0);
  assert.deepEqual(group.animations[0].tracks.map((track) => track.name), [
    "MorphQuad.morphTargetInfluences[0]"
  ]);
});

test("normalizes dense Three.js morph targets into sparse FBX shape deltas", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeMorphScene(), { frameRate: 30 }));
  const morphTarget = scene.meshes[0].geometry.morphTargets[0];

  assert.deepEqual(morphTarget.indices, [2, 3]);
  assert.deepEqual(morphTarget.vertices, [0, 0, 0.5, 0, 0, 0.5]);
  assert.deepEqual(rounded(morphTarget.normals), [0.2, 0, 0, 0.3, 0, 0]);

  const document = createStaticMeshFbxDocument(fromThreeObject(threeMorphScene(), { frameRate: 30 }));
  const shape = findShapeGeometry(document);
  const indexes = shape.children.find((node) => node.name === "Indexes");
  const vertices = shape.children.find((node) => node.name === "Vertices");

  assert.deepEqual(Array.from(indexes.properties[0].value), [2, 3]);
  assert.deepEqual(Array.from(vertices.properties[0].value), [0, 0, 0.5, 0, 0, 0.5]);
});

test("adapts Three.js initial morphTargetInfluences into default blend shape weights", async () => {
  const scene = fromThreeObject(threeDefaultMorphWeightScene(), { frameRate: 30 });
  const target = scene.meshes[0].geometry.morphTargets[0];

  assert.equal(target.name, "Puff");
  assert.equal(target.weight, 0.35);

  const document = createStaticMeshFbxDocument(scene);
  const channel = document
    .find((node) => node.name === "Objects")
    .children
    .find((node) => node.name === "Deformer" && node.properties[2] === "BlendShapeChannel");
  const deformPercent = channel.children.find((node) => node.name === "DeformPercent");
  assert.equal(deformPercent.properties[0].value, 35);

  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(threeDefaultMorphWeightScene(), {
    frameRate: 30
  })), "");
  assert.equal(group.getObjectByName("MorphQuad").morphTargetDictionary.Puff, 0);
});

test("adapts whole Three.js morphTargetInfluences tracks into one curve per target", async () => {
  const scene = fromThreeObject(threeMorphArrayScene(), { frameRate: 30, bakeAnimations: false });
  const tracks = scene.animations[0].tracks;

  assert.deepEqual(scene.meshes[0].geometry.morphTargets.map((target) => target.name), ["Puff", "Stretch"]);
  assert.deepEqual(tracks.map((track) => track.morphTarget), ["Puff", "Stretch"]);
  assert.deepEqual(tracks.map((track) => rounded(track.keyframes.map((keyframe) => keyframe.value))), [
    [0, 1],
    [0.2, 0.8]
  ]);

  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(threeMorphArrayScene(), {
    frameRate: 30,
    bakeAnimations: false
  })), "");
  assert.deepEqual(group.animations[0].tracks.map((track) => track.name), [
    "MorphQuad.morphTargetInfluences[0]",
    "MorphQuad.morphTargetInfluences[1]"
  ]);
  assert.deepEqual(Array.from(group.animations[0].tracks[0].values), [0, 1]);
  assert.deepEqual(rounded(Array.from(group.animations[0].tracks[1].values)), [0.2, 0.8]);
});

test("adapts Three.js mesh morphTargetDictionary names when attributes are unnamed", async () => {
  const scene = fromThreeObject(threeDictionaryMorphScene(), { frameRate: 30 });
  const mesh = scene.meshes[0];

  assert.deepEqual(mesh.geometry.morphTargets.map((target) => target.name), ["Smile"]);
  assert.equal(scene.animations[0].tracks[0].morphTarget, "Smile");

  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(threeDictionaryMorphScene(), { frameRate: 30 })), "");
  const exportedMesh = group.getObjectByName("MorphTriangle");
  assert.equal(exportedMesh.morphTargetDictionary.Smile, 0);
  assert.deepEqual(group.animations[0].tracks.map((track) => track.name), [
    "MorphTriangle.morphTargetInfluences[0]"
  ]);
});

test("adapts Three.js named morphTargetInfluences animation tracks", async () => {
  const namedScene = fromThreeObject(threeNamedMorphScene(), { frameRate: 30, bakeAnimations: false });
  assert.equal(namedScene.animations[0].tracks[0].morphTarget, "Puff");
  assert.deepEqual(namedScene.animations[0].tracks[0].keyframes.map((keyframe) => keyframe.value), [0.25, 0.75]);

  const dictionaryScene = fromThreeObject(threeNamedDictionaryMorphScene(), { frameRate: 30, bakeAnimations: false });
  assert.equal(dictionaryScene.meshes[0].geometry.morphTargets[0].name, "Smile");
  assert.equal(dictionaryScene.animations[0].tracks[0].morphTarget, "Smile");

  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(threeNamedMorphScene(), { frameRate: 30 })), "");
  assert.deepEqual(group.animations[0].tracks.map((track) => track.name), [
    "MorphQuad.morphTargetInfluences[0]"
  ]);
  const values = Array.from(group.animations[0].tracks[0].values);
  assert.equal(values[0], 0.25);
  assert.equal(values.at(-1), 0.75);
});

test("Blender imports blend shapes as shape keys with animated values", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "morph.fbx");
  await writeFile(fbxPath, exportFbx(morphScene()));

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
mesh_obj = next((obj for obj in bpy.context.scene.objects if obj.type == "MESH"), None)
shape_keys = mesh_obj.data.shape_keys if mesh_obj and mesh_obj.data.shape_keys else None
actions = sorted((action.name, len(action.fcurves)) for action in bpy.data.actions)
print("FBX_VALIDATE:" + json.dumps({
    "shapeKeys": [key.name for key in shape_keys.key_blocks] if shape_keys else [],
    "actions": actions,
    "animatedShapeKeys": bool(shape_keys and shape_keys.animation_data and shape_keys.animation_data.action),
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
  assert.deepEqual(info.shapeKeys, ["Basis", "Puff"]);
  assert.equal(info.animatedShapeKeys, true);
  assert.deepEqual(info.actions, [["Key|PuffAction", 1]]);
});
