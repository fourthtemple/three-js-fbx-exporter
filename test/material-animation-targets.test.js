import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AnimationClip,
  BufferGeometry,
  ColorKeyframeTrack,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  NumberKeyframeTrack,
  Scene
} from "three";
import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { linearColorComponentToFbx } from "../src/three/three-color-adapter.js";
import { decode } from "./fbx-test-helpers.js";

function quadGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0,
    -1, 1, 0
  ], 3));
  geometry.setAttribute("uv", new Float32BufferAttribute([
    0, 0,
    1, 0,
    1, 1,
    0, 1
  ], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
}

function duplicateMaterialScene({ withAnimationNames = false } = {}) {
  const leftMaterial = {
    name: "shared_material",
    diffuseColor: [1, 0, 0],
    opacity: 1
  };
  const rightMaterial = {
    name: "shared_material",
    diffuseColor: [0, 0, 1],
    opacity: 0.75
  };
  if (withAnimationNames) {
    leftMaterial.animationName = "left_material";
    rightMaterial.animationName = "right_material";
  }

  return {
    name: "DuplicateMaterialScene",
    meshes: [
      {
        name: "LeftQuad",
        materials: [leftMaterial],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0]
        }
      },
      {
        name: "RightQuad",
        materials: [rightMaterial],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0]
        }
      }
    ],
    animations: [
      {
        name: "MaterialFade",
        tracks: [
          {
            target: withAnimationNames ? "right_material" : "shared_material",
            property: "opacity",
            keyframes: [
              { frame: 0, value: 0.75 },
              { frame: 30, value: 0.25 }
            ]
          }
        ]
      }
    ]
  };
}

function threeDuplicateMaterialScene({ directAnimationNames = false, uuidDirectTargets = false } = {}) {
  const leftMaterial = new MeshBasicMaterial({ name: "shared_material", color: 0xff0000 });
  if (directAnimationNames) {
    leftMaterial.animationName = "left_material";
  } else {
    leftMaterial.userData.animationName = "left_material";
  }
  const rightMaterial = new MeshBasicMaterial({
    name: "shared_material",
    color: 0x0000ff,
    opacity: 0.75,
    transparent: true
  });
  if (directAnimationNames) {
    rightMaterial.animationName = "right_material";
  } else {
    rightMaterial.userData.animationName = "right_material";
  }

  const left = new Mesh(quadGeometry(), leftMaterial);
  left.name = "LeftQuad";
  const right = new Mesh(quadGeometry(), rightMaterial);
  right.name = "RightQuad";

  const scene = new Scene();
  scene.name = "ThreeDuplicateMaterialScene";
  scene.add(left, right);
  scene.animations = [
    new AnimationClip("MaterialAction", 1, [
      new ColorKeyframeTrack(
        uuidDirectTargets ? `${leftMaterial.uuid}.__material.color` : "LeftQuad.material.color",
        [0, 1],
        [1, 0, 0, 0, 1, 0]
      ),
      new NumberKeyframeTrack(
        uuidDirectTargets ? `${rightMaterial.uuid}.__material.opacity` : "RightQuad.material.opacity",
        [0, 1],
        [0.75, 0.25]
      )
    ])
  ];
  return scene;
}

function threeOptionMaterialRootScene() {
  const material = new MeshBasicMaterial({
    name: "option_material",
    color: 0xff0000,
    opacity: 1,
    transparent: true
  });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "OptionMaterialQuad";
  const scene = new Scene();
  scene.name = "ThreeOptionMaterialRootScene";
  scene.add(mesh);
  const clip = new AnimationClip("OptionMaterialLocal", 1, [
    new NumberKeyframeTrack("opacity", [0, 1], [1, 0.35]),
    new ColorKeyframeTrack("color", [0, 1], [
      1, 0, 0,
      0, 1, 1
    ])
  ]);
  return { scene, material, clip };
}

function threeOptionMaterialUserDataRootScene() {
  const material = new MeshBasicMaterial({
    name: "option_material_userdata",
    color: 0xffffff,
    opacity: 1,
    transparent: true
  });
  material.userData.animationControls = { editable: true };
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "OptionMaterialUserDataQuad";
  const scene = new Scene();
  scene.name = "ThreeOptionMaterialUserDataRootScene";
  scene.add(mesh);
  const clip = new AnimationClip("OptionMaterialUserDataLocal", 1, [
    new NumberKeyframeTrack("opacity", [0, 1], [1, 0.5])
  ]);
  return { scene, material, clip };
}

function threeBareMaterialTargetScene() {
  const material = new MeshBasicMaterial({
    name: "bare_material",
    color: 0xff0000,
    opacity: 1,
    transparent: true
  });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "BareMaterialQuad";
  const scene = new Scene();
  scene.name = "ThreeBareMaterialTargetScene";
  scene.add(mesh);
  scene.animations = [
    new AnimationClip("BareMaterialTarget", 1, [
      new NumberKeyframeTrack("bare_material.opacity", [0, 1], [1, 0.45]),
      new ColorKeyframeTrack("bare_material.color", [0, 1], [
        1, 0, 0,
        0, 0.5, 1
      ])
    ])
  ];
  return scene;
}

test("rejects ambiguous material animation target names", () => {
  assert.throws(() => exportFbx(duplicateMaterialScene()), /Animation target is ambiguous: shared_material/);
});

test("uses explicit material animation names to disambiguate duplicate display names", () => {
  const scene = normalizeFbxScene(duplicateMaterialScene({ withAnimationNames: true }));
  const materials = scene.meshes.flatMap((mesh) => mesh.materials);
  const text = decode(exportFbx(scene));

  assert.deepEqual(materials.map((material) => material.name), ["shared_material", "shared_material"]);
  assert.deepEqual(materials.map((material) => material.animationName), ["left_material", "right_material"]);
  assert.equal(scene.animations[0].tracks[0].target, "right_material");
  assert.match(text, /AnimationCurveNode/);
});

test("adapts Three.js material animation names before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeDuplicateMaterialScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const materials = scene.meshes.flatMap((mesh) => mesh.materials);
  const tracks = scene.animations[0].tracks;

  assert.deepEqual(materials.map((material) => material.name), ["shared_material", "shared_material"]);
  assert.deepEqual(materials.map((material) => material.animationName), ["left_material", "right_material"]);
  assert.deepEqual(tracks.map((track) => track.target), ["left_material", "right_material"]);
  assert.deepEqual(tracks.map((track) => track.property), ["diffuseColor", "opacity"]);
  assert.deepEqual(tracks.map((track) => track.keyframes[1].value), [[0, 1, 0], 0.25]);
});

test("adapts direct Three.js material animation names before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeDuplicateMaterialScene({ directAnimationNames: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const materials = scene.meshes.flatMap((mesh) => mesh.materials);
  const tracks = scene.animations[0].tracks;

  assert.deepEqual(materials.map((material) => material.animationName), ["left_material", "right_material"]);
  assert.deepEqual(tracks.map((track) => track.target), ["left_material", "right_material"]);
});

test("adapts Three.js material UUID aliases for direct material animation tracks", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeDuplicateMaterialScene({ uuidDirectTargets: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const tracks = scene.animations[0].tracks;

  assert.deepEqual(tracks.map((track) => [track.target, track.property]), [
    ["left_material", "diffuseColor"],
    ["right_material", "opacity"]
  ]);
  assert.deepEqual(tracks.map((track) => track.keyframes[1].value), [[0, 1, 0], 0.25]);
});

test("adapts bare Three.js material target aliases without explicit material marker", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeBareMaterialTargetScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const tracks = scene.animations[0].tracks;

  assert.deepEqual(tracks.map((track) => [track.target, track.property]), [
    ["bare_material", "opacity"],
    ["bare_material", "diffuseColor"]
  ]);
  assert.ok(Math.abs(tracks[0].keyframes[1].value - 0.45) < 1e-6);
  assert.deepEqual(tracks[1].keyframes[1].value, [0, linearColorComponentToFbx(0.5), 1]);
});

test("adapts option-provided clips rooted at Three.js material objects", () => {
  const { scene: source, material, clip } = threeOptionMaterialRootScene();
  const scene = normalizeFbxScene(fromThreeObject(source, {
    animations: [{ clip, rootObject: material }],
    bakeAnimations: false,
    frameRate: 30
  }));
  const tracks = scene.animations[0].tracks;

  assert.deepEqual(tracks.map((track) => [track.target, track.property]), [
    ["option_material", "opacity"],
    ["option_material", "diffuseColor"]
  ]);
  assert.ok(Math.abs(tracks[0].keyframes[1].value - 0.35) < 1e-6);
  assert.deepEqual(tracks[1].keyframes[1].value, [0, 1, 1]);
});

test("adapts option-provided clips rooted at Three.js material userData objects", () => {
  const { scene: source, material, clip } = threeOptionMaterialUserDataRootScene();
  const scene = normalizeFbxScene(fromThreeObject(source, {
    animations: [{ clip, rootObject: material.userData }],
    bakeAnimations: false,
    frameRate: 30
  }));
  const tracks = scene.animations[0].tracks;

  assert.deepEqual(tracks.map((track) => [track.target, track.property]), [
    ["option_material_userdata", "opacity"]
  ]);
  assert.ok(Math.abs(tracks[0].keyframes[1].value - 0.5) < 1e-6);
});
