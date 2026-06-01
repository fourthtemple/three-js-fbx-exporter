import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  AdditiveAnimationBlendMode,
  AnimationClip,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  NumberKeyframeTrack,
  Object3D,
  Texture,
  VectorKeyframeTrack
} from "three";
import {
  buildAnimationObjects,
  createAnimationRecords
} from "../src/animation-document.js";
import { normalizeAnimationLayerSettings } from "../src/animation-layer-settings.js";
import { createStaticMeshFbxDocument } from "../src/static-document.js";
import { makeIdFactory } from "../src/fbx-values.js";
import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import {
  blenderPath,
  blenderTestArgs,
  checkerTga,
  decode,
  hasBlender
} from "./fbx-test-helpers.js";

function layerScene(animationSettings = {}) {
  return {
    name: "AnimationLayerScene",
    meshes: [
      {
        name: "Cube",
        materials: [{ name: "Mat" }],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0],
          faces: [[0, 1, 2]],
          uvs: [0, 0, 1, 0, 1, 1],
          materialIndices: [0]
        }
      }
    ],
    animations: [
      {
        name: "Move",
        frameRate: 30,
        ...animationSettings,
        tracks: [
          {
            target: "Cube",
            property: "translation",
            keyframes: [
              { frame: 0, value: [0, 0, 0] },
              { frame: 30, value: [1, 0, 0] }
            ]
          }
        ]
      }
    ]
  };
}

function threeLayerScene() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0
  ], 3));
  geometry.setIndex([0, 1, 2]);

  const mesh = new Mesh(geometry, new MeshBasicMaterial({ name: "Mat" }));
  mesh.name = "Cube";

  const root = new Object3D();
  root.name = "ThreeLayerScene";
  root.add(mesh);

  const clip = new AnimationClip("Move", 1, [
    new VectorKeyframeTrack("Cube.position", [0, 1], [
      0, 0, 0,
      1, 0, 0
    ])
  ]);
  clip.userData = {};
  clip.userData.layerName = "ImportedLayer";
  clip.userData.layerWeight = 37;
  clip.userData.layerBlendMode = "additive";
  root.animations = [clip];
  return root;
}

function threeClipBlendModeScene() {
  const root = threeLayerScene();
  const clip = root.animations[0];
  clip.userData = {};
  clip.blendMode = AdditiveAnimationBlendMode;
  return root;
}

function threeLayeredTextureClipScene() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0
  ], 3));
  geometry.setAttribute("uv", new Float32BufferAttribute([
    0, 0,
    1, 0,
    1, 1
  ], 2));
  geometry.setIndex([0, 1, 2]);

  const texture = new Texture({ src: "checker.tga", name: "checker_image" });
  texture.name = "checker";
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ name: "Mat", map: texture }));
  mesh.name = "Cube";

  const root = new Object3D();
  root.name = "LayeredThreeScene";
  root.add(mesh);

  const moveTrack = new VectorKeyframeTrack("Cube.position", [0, 1], [
    0, 0, 0,
    1, 0, 0
  ]);
  const fadeTrack = new NumberKeyframeTrack("Cube.material.map.opacity", [0, 1], [1, 0.25]);
  const clip = new AnimationClip("LayeredThree", 1, [moveTrack, fadeTrack]);
  clip.userData = {
    layers: [
      { name: "BodyBase", tracks: ["Cube.position"] },
      {
        name: "TextureFade",
        weight: 42,
        layerBlendMode: "additive",
        tracks: ["Cube.material.map.opacity"]
      }
    ]
  };
  root.animations = [clip];
  return root;
}

function multiLayerTextureScene() {
  return {
    name: "MultiLayerTextureScene",
    meshes: [
      {
        name: "Cube",
        materials: [
          {
            name: "Mat",
            diffuseTexture: {
              name: "checker",
              path: "checker.tga",
              alpha: 1
            }
          }
        ],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0],
          faces: [[0, 1, 2]],
          uvs: [0, 0, 1, 0, 1, 1],
          materialIndices: [0]
        }
      }
    ],
    animations: [
      {
        name: "LayeredTake",
        frameRate: 30,
        layers: [
          {
            name: "BodyBase",
            tracks: [
              {
                target: "Cube",
                property: "translation",
                keyframes: [
                  { frame: 0, value: [0, 0, 0] },
                  { frame: 30, value: [1, 0, 0] }
                ]
              }
            ]
          },
          {
            name: "TextureFade",
            weight: 42,
            blendMode: "additive",
            tracks: [
              {
                target: "checker",
                property: "textureAlpha",
                keyframes: [
                  { frame: 0, value: 1 },
                  { frame: 30, value: 0.25 }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
}

function findChild(node, name) {
  return node.children.find((child) => child.name === name);
}

function documentSection(document, name) {
  return document.find((node) => node.name === name);
}

function objectTypeCount(definitions, name) {
  const type = definitions.children.find((child) => child.name === "ObjectType" && child.properties[0] === name);
  return findChild(type, "Count").properties[0];
}

function propertyValues(node, name) {
  const properties = findChild(node, "Properties70");
  const property = properties.children.find((child) => child.name === "P" && child.properties[0] === name);
  return property.properties.slice(4).map((value) => value?.value ?? value);
}

function animationLayerNode(scene) {
  const records = createAnimationRecords(scene, [{
    name: "Cube",
    ids: { model: 1001 },
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  }], makeIdFactory());
  return buildAnimationObjects(records).find((node) => node.name === "AnimationLayer");
}

test("normalizes animation layer settings and aliases", () => {
  const layer = normalizeAnimationLayerSettings({
    layerName: "Controls",
    layerWeight: 42,
    layerMute: "yes",
    layerSolo: 1,
    layerLock: "off",
    layerColor: [0.1, 0.2, 0.3],
    layerBlendMode: "add",
    layerRotationAccumulationMode: "byChannel",
    layerScaleAccumulationMode: 2
  });

  assert.deepEqual(layer, {
    name: "Controls",
    weight: 42,
    mute: true,
    solo: true,
    lock: false,
    color: [0.1, 0.2, 0.3],
    blendMode: 1,
    rotationAccumulationMode: 1,
    scaleAccumulationMode: 2
  });
});

test("normalizes clip layer metadata into the internal animation model", () => {
  const scene = normalizeFbxScene(layerScene({
    layer: {
      name: "BodyLayer",
      weight: 64,
      mute: false,
      solo: true,
      lock: true,
      color: [0.2, 0.4, 0.6],
      blendMode: 1,
      rotationAccumulationMode: 2,
      scaleAccumulationMode: 3
    }
  }));

  assert.deepEqual(scene.animations[0].layer, {
    name: "BodyLayer",
    weight: 64,
    mute: false,
    solo: true,
    lock: true,
    color: [0.2, 0.4, 0.6],
    blendMode: 1,
    rotationAccumulationMode: 2,
    scaleAccumulationMode: 3
  });
});

test("writes animation layer settings into FBX layer properties", () => {
  const scene = normalizeFbxScene(layerScene({
    layer: {
      name: "BodyLayer",
      weight: 64,
      mute: true,
      solo: false,
      lock: true,
      color: [0.2, 0.4, 0.6],
      blendMode: 1,
      rotationAccumulationMode: 2,
      scaleAccumulationMode: 3
    }
  }));
  const layer = animationLayerNode(scene);

  assert.match(layer.properties[1], /BodyLayer/);
  assert.deepEqual(propertyValues(layer, "Weight"), [64]);
  assert.deepEqual(propertyValues(layer, "Mute"), [1]);
  assert.deepEqual(propertyValues(layer, "Solo"), [0]);
  assert.deepEqual(propertyValues(layer, "Lock"), [1]);
  assert.deepEqual(propertyValues(layer, "Color"), [0.2, 0.4, 0.6]);
  assert.deepEqual(propertyValues(layer, "BlendMode"), [1]);
  assert.deepEqual(propertyValues(layer, "RotationAccumulationMode"), [2]);
  assert.deepEqual(propertyValues(layer, "ScaleAccumulationMode"), [3]);
});

test("adapts Three.js AnimationClip layer userData", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeLayerScene(), { frameRate: 30 }));

  assert.equal(scene.animations[0].layer.name, "ImportedLayer");
  assert.equal(scene.animations[0].layer.weight, 37);
  assert.equal(scene.animations[0].layer.blendMode, 1);
});

test("maps Three.js AnimationClip additive blend mode to FBX layer blend mode", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeClipBlendModeScene(), { frameRate: 30 }));

  assert.equal(scene.animations[0].layer.blendMode, 1);
});

test("adapts Three.js clip userData layers into FBX animation layers", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeLayeredTextureClipScene(), {
    frameRate: 30,
    bakeAnimations: false
  }));
  const [clip] = scene.animations;

  assert.equal(clip.layers.length, 2);
  assert.deepEqual(clip.layers.map((layer) => layer.name), ["BodyBase", "TextureFade"]);
  assert.equal(clip.layers[1].weight, 42);
  assert.equal(clip.layers[1].blendMode, 1);
  assert.deepEqual(clip.layers.map((layer) => layer.tracks.map((track) => track.property)), [
    ["translation"],
    ["textureAlpha"]
  ]);
  const text = decode(exportFbx(threeLayeredTextureClipScene(), {
    frameRate: 30,
    bakeAnimations: false
  }));
  assert.match(text, /TextureFade/);
  assert.match(text, /Texture alpha/);
});

test("normalizes multiple FBX animation layers in one stack", () => {
  const scene = normalizeFbxScene(multiLayerTextureScene());
  const [clip] = scene.animations;

  assert.equal(clip.layers.length, 2);
  assert.equal(clip.tracks.length, 2);
  assert.equal(clip.layer.name, "BodyBase");
  assert.equal(clip.layers[1].name, "TextureFade");
  assert.equal(clip.layers[1].weight, 42);
  assert.equal(clip.layers[1].blendMode, 1);
  assert.equal(clip.layers[1].tracks[0].property, "textureAlpha");
});

test("writes multiple animation layers and texture curves under one FBX stack", () => {
  const document = createStaticMeshFbxDocument(multiLayerTextureScene());
  const definitions = documentSection(document, "Definitions");
  const objects = documentSection(document, "Objects");
  const connections = documentSection(document, "Connections");
  const animationLayers = objects.children.filter((node) => node.name === "AnimationLayer");
  const curveNodes = objects.children.filter((node) => node.name === "AnimationCurveNode");
  const curves = objects.children.filter((node) => node.name === "AnimationCurve");
  const stackId = objects.children.find((node) => node.name === "AnimationStack").properties[0].value;
  const connectedLayers = connections.children.filter((node) => {
    return node.name === "C" &&
      node.properties[0] === "OO" &&
      node.properties[2].value === stackId;
  });

  assert.equal(objectTypeCount(definitions, "AnimationLayer"), 2);
  assert.equal(objectTypeCount(definitions, "AnimationCurveNode"), 2);
  assert.equal(objectTypeCount(definitions, "AnimationCurve"), 4);
  assert.equal(animationLayers.length, 2);
  assert.equal(curveNodes.length, 2);
  assert.equal(curves.length, 4);
  assert.equal(connectedLayers.length, 2);
  assert.match(animationLayers[0].properties[1], /BodyBase/);
  assert.match(animationLayers[1].properties[1], /TextureFade/);
  assert.match(decode(exportFbx(multiLayerTextureScene())), /Texture alpha/);
});

test("Blender imports a layered animation stack with a texture layer", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "layered-stack.fbx");
  await writeFile(join(tempDir, "checker.tga"), checkerTga());
  await writeFile(fbxPath, exportFbx(multiLayerTextureScene()));

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
actions = list(bpy.data.actions)
print("FBX_VALIDATE:" + json.dumps({
    "actions": len(actions),
    "fcurves": sum(len(action.fcurves) for action in actions),
    "images": len([img for img in bpy.data.images if img.filepath]),
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
  assert.equal(info.actions, 1);
  assert.ok(info.fcurves >= 3);
  assert.equal(info.images, 1);
});
