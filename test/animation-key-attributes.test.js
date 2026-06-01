import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AnimationClip,
  BufferGeometry,
  Float32BufferAttribute,
  InterpolateSmooth,
  InterpolateDiscrete,
  Mesh,
  MeshBasicMaterial,
  NumberKeyframeTrack,
  Object3D,
  Texture,
  VectorKeyframeTrack
} from "three";
import {
  animationKeyAttributeFlag,
  animationKeyAttributes,
  normalizeAnimationInterpolation
} from "../src/animation-key-attributes.js";
import {
  buildAnimationObjects,
  createAnimationRecords
} from "../src/animation-document.js";
import { makeIdFactory } from "../src/fbx-values.js";
import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { arrayBufferFrom } from "./fbx-test-helpers.js";

function minimalAnimatedScene(track) {
  return {
    name: "AnimationAttributesScene",
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
        tracks: [track]
      }
    ]
  };
}

function threeDiscreteScene() {
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
  root.name = "ThreeDiscreteScene";
  root.add(mesh);

  const track = new VectorKeyframeTrack("Cube.position", [0, 1], [
    0, 0, 0,
    1, 0, 0
  ]);
  track.setInterpolation(InterpolateDiscrete);
  root.animations = [new AnimationClip("Step", 1, [track])];
  return root;
}

function threeCubicTangentScene() {
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
  root.name = "ThreeCubicTangentScene";
  root.add(mesh);

  const track = new VectorKeyframeTrack("Cube.position", [0, 1], [
    0, 0, 0,
    1, 2, 3
  ]);
  track.setInterpolation(InterpolateSmooth);
  track.userData = { keyframes: [
    {
      time: 0,
      rightSlope: [0.1, 0.2, 0.3],
      nextLeftSlope: [-0.1, -0.2, -0.3],
      rightWeight: [0.4, 0.5, 0.6],
      nextLeftWeight: [0.7, 0.8, 0.9],
      tangentMode: "user"
    },
    { time: 1, interpolation: "linear" }
  ] };
  root.animations = [new AnimationClip("SplineMove", 1, [track])];
  return root;
}

function threeTextureCubicTangentScene() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0
  ], 3));
  geometry.setIndex([0, 1, 2]);

  const texture = new Texture();
  texture.name = "SplineTexture";
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ name: "Mat", map: texture }));
  mesh.name = "Cube";

  const root = new Object3D();
  root.name = "ThreeTextureCubicTangentScene";
  root.add(mesh);

  const track = new NumberKeyframeTrack("Cube.material.map.offset[x]", [0, 1], [0, 0.5]);
  track.setInterpolation(InterpolateSmooth);
  track.userData = { keyframeTangents: [
    { rightSlope: 0.25, nextLeftSlope: -0.125, rightWeight: 0.5, nextLeftWeight: 0.625 },
    { interpolation: "linear" }
  ] };
  root.animations = [new AnimationClip("SplineTextureMove", 1, [track])];
  return root;
}

function findChild(node, name) {
  return node.children.find((child) => child.name === name);
}

test("maps animation interpolation aliases to FBX key attribute flags", () => {
  assert.equal(normalizeAnimationInterpolation("hold"), "constant");
  assert.equal(normalizeAnimationInterpolation("bezier"), "cubic");
  assert.equal(normalizeAnimationInterpolation("anything else"), "linear");
  assert.equal(animationKeyAttributeFlag("linear"), 0x00000004 | 0x00000100 | 0x00002000 | 0x00004000);
});

test("groups consecutive FBX key attributes by interpolation mode", () => {
  const attributes = animationKeyAttributes([
    { frame: 0, value: [0, 0, 0], interpolation: "linear" },
    { frame: 10, value: [1, 0, 0], interpolation: "linear" },
    { frame: 20, value: [2, 0, 0], interpolation: "constant" },
    { frame: 30, value: [3, 0, 0], interpolation: "cubic" }
  ]);

  assert.deepEqual(attributes.flags, [
    animationKeyAttributeFlag("linear"),
    animationKeyAttributeFlag("constant"),
    animationKeyAttributeFlag("cubic")
  ]);
  assert.deepEqual(attributes.refCounts, [2, 1, 1]);
  assert.equal(attributes.dataFloat.length, 12);
});

test("accepts named cubic tangent fields for key attribute data", () => {
  const attributes = animationKeyAttributes([
    {
      frame: 0,
      value: [0, 0, 0],
      interpolation: "cubic",
      rightSlope: 0.5,
      nextLeftSlope: -0.25,
      rightWeight: 0.75,
      nextLeftWeight: 0.5
    }
  ]);

  assert.deepEqual(attributes.dataFloat, [0.5, -0.25, 0.75, 0.5]);
  assert.equal(attributes.refCounts[0], 1);
  assert.equal((attributes.flags[0] & 0x00000400) !== 0, true);
  assert.equal((attributes.flags[0] & 0x01000000) !== 0, true);
  assert.equal((attributes.flags[0] & 0x02000000) !== 0, true);
});

test("accepts channel-specific tangent fields for vector animation curves", () => {
  const keyframes = [
    {
      frame: 0,
      value: [0, 0, 0],
      interpolation: "cubic",
      rightSlope: [0.1, 0.2, 0.3],
      nextLeftSlope: [-0.1, -0.2, -0.3],
      rightWeight: [0.4, 0.5, 0.6],
      nextLeftWeight: [0.7, 0.8, 0.9]
    }
  ];

  assert.deepEqual(animationKeyAttributes(keyframes, {}, 0).dataFloat, [0.1, -0.1, 0.4, 0.7]);
  assert.deepEqual(animationKeyAttributes(keyframes, {}, 1).dataFloat, [0.2, -0.2, 0.5, 0.8]);
  assert.deepEqual(animationKeyAttributes(keyframes, {}, 2).dataFloat, [0.3, -0.3, 0.6, 0.9]);

  const attributes = animationKeyAttributes([{
    frame: 0,
    value: [0, 0, 0],
    interpolation: "cubic",
    tangentDataByChannel: {
      Y: { rightSlope: 2, nextLeftSlope: -2, rightWeight: 0.5, nextLeftWeight: 0.75 }
    }
  }], {}, 1);
  assert.deepEqual(attributes.dataFloat, [2, -2, 0.5, 0.75]);
});

test("writes multiple key attribute groups into animation curves", () => {
  const scene = minimalAnimatedScene({
    target: "Cube",
    property: "translation",
    keyframes: [
      { frame: 0, value: [0, 0, 0], interpolation: "linear" },
      { frame: 10, value: [1, 0, 0], interpolation: "linear" },
      { frame: 20, value: [2, 0, 0], interpolation: "constant" },
      { frame: 30, value: [3, 0, 0], interpolation: "cubic" }
    ]
  });
  const records = createAnimationRecords(scene, [{
    name: "Cube",
    ids: { model: 1001 },
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  }], makeIdFactory());
  const curve = buildAnimationObjects(records).find((node) => node.name === "AnimationCurve");

  assert.deepEqual(findChild(curve, "KeyAttrFlags").properties[0].value, [
    animationKeyAttributeFlag("linear"),
    animationKeyAttributeFlag("constant"),
    animationKeyAttributeFlag("cubic")
  ]);
  assert.deepEqual(findChild(curve, "KeyAttrRefCount").properties[0].value, [2, 1, 1]);
});

test("writes named tangent data into animation curves", () => {
  const scene = minimalAnimatedScene({
    target: "Cube",
    property: "translation",
    interpolation: "cubic",
    keyframes: [
      {
        frame: 0,
        value: [0, 0, 0],
        rightSlope: 0.5,
        nextLeftSlope: -0.25,
        rightWeight: 0.75,
        nextLeftWeight: 0.5
      },
      { frame: 30, value: [1, 0, 0] }
    ]
  });
  const records = createAnimationRecords(normalizeFbxScene(scene), [{
    name: "Cube",
    ids: { model: 1001 },
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  }], makeIdFactory());
  const curve = buildAnimationObjects(records).find((node) => node.name === "AnimationCurve");

  assert.deepEqual(findChild(curve, "KeyAttrDataFloat").properties[0].value.slice(0, 4), [0.5, -0.25, 0.75, 0.5]);
});

test("writes channel-specific tangent data into vector animation curves", () => {
  const scene = minimalAnimatedScene({
    target: "Cube",
    property: "translation",
    interpolation: "cubic",
    keyframes: [
      {
        frame: 0,
        value: [0, 0, 0],
        rightSlope: [0.1, 0.2, 0.3],
        nextLeftSlope: [-0.1, -0.2, -0.3],
        rightWeight: [0.4, 0.5, 0.6],
        nextLeftWeight: [0.7, 0.8, 0.9]
      },
      { frame: 30, value: [1, 2, 3] }
    ]
  });
  const records = createAnimationRecords(normalizeFbxScene(scene), [{
    name: "Cube",
    ids: { model: 1001 },
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  }], makeIdFactory());
  const curves = buildAnimationObjects(records).filter((node) => node.name === "AnimationCurve");

  assert.deepEqual(findChild(curves[0], "KeyAttrDataFloat").properties[0].value.slice(0, 4), [0.1, -0.1, 0.4, 0.7]);
  assert.deepEqual(findChild(curves[1], "KeyAttrDataFloat").properties[0].value.slice(0, 4), [0.2, -0.2, 0.5, 0.8]);
  assert.deepEqual(findChild(curves[2], "KeyAttrDataFloat").properties[0].value.slice(0, 4), [0.3, -0.3, 0.6, 0.9]);
});

test("normalizes track and per-key interpolation metadata", () => {
  const scene = normalizeFbxScene(minimalAnimatedScene({
    target: "Cube",
    property: "translation",
    interpolation: "cubic",
    keyframes: [
      { frame: 0, value: [0, 0, 0] },
      { frame: 30, value: [1, 0, 0], interpolation: "constant" }
    ]
  }));
  const track = scene.animations[0].tracks[0];

  assert.equal(track.interpolation, "cubic");
  assert.deepEqual(track.keyframes.map((keyframe) => keyframe.interpolation), ["cubic", "constant"]);
});

test("normalizes track and per-key tangent metadata", () => {
  const scene = normalizeFbxScene(minimalAnimatedScene({
    target: "Cube",
    property: "translation",
    interpolation: "cubic",
    tangentMode: "user",
    tangentData: { rightSlope: 0.1 },
    keyframes: [
      { frame: 0, value: [0, 0, 0], outTangent: 0.5, inTangent: -0.25 },
      { frame: 30, value: [1, 0, 0] }
    ]
  }));
  const track = scene.animations[0].tracks[0];

  assert.equal(track.tangentMode, "user");
  assert.deepEqual(track.tangentData, { rightSlope: 0.1 });
  assert.deepEqual(track.keyframes[0].tangentData, {
    rightSlope: 0.5,
    nextLeftSlope: -0.25,
    rightWeight: undefined,
    nextLeftWeight: undefined
  });
});

test("adapts Three.js discrete interpolation when animation baking is disabled", async () => {
  const scene = normalizeFbxScene(fromThreeObject(threeDiscreteScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));
  assert.equal(scene.animations[0].tracks[0].interpolation, "constant");

  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(threeDiscreteScene(), {
    bakeAnimations: false,
    frameRate: 30
  })), "");
  assert.equal(group.animations.length, 1);
});

test("adapts Three.js per-key tangent metadata when baking is disabled", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCubicTangentScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const track = scene.animations[0].tracks[0];

  assert.equal(track.interpolation, "cubic");
  assert.equal(track.keyframes[0].tangentMode, "user");
  assert.deepEqual(track.keyframes[0].tangentData.rightSlope, [0.1, 0.2, 0.3]);
  assert.deepEqual(track.keyframes[1].interpolation, "linear");

  const records = createAnimationRecords(scene, [{
    name: "Cube",
    ids: { model: 1001 },
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  }], makeIdFactory());
  const curves = buildAnimationObjects(records).filter((node) => node.name === "AnimationCurve");
  assert.deepEqual(findChild(curves[0], "KeyAttrDataFloat").properties[0].value.slice(0, 4), [0.1, -0.1, 0.4, 0.7]);
  assert.deepEqual(findChild(curves[1], "KeyAttrDataFloat").properties[0].value.slice(0, 4), [0.2, -0.2, 0.5, 0.8]);
});

test("adapts Three.js per-key tangent metadata on texture animation tracks", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeTextureCubicTangentScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const track = scene.animations[0].tracks[0];

  assert.equal(track.target, "SplineTexture");
  assert.equal(track.property, "textureTranslationX");
  assert.equal(track.interpolation, "cubic");
  assert.deepEqual(track.keyframes[0].tangentData, {
    rightSlope: 0.25,
    nextLeftSlope: -0.125,
    rightWeight: 0.5,
    nextLeftWeight: 0.625
  });
  assert.equal(track.keyframes[1].interpolation, "linear");
});
