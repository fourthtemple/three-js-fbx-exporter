import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AnimationClip,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  NumberKeyframeTrack,
  Scene,
  Texture
} from "three";
import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { decode } from "./fbx-test-helpers.js";

function rounded(values) {
  return values.map((value) => Number(value.toFixed(4)));
}

function quadGeometry() {
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
  return geometry;
}

function textureAlphaAnimationScene() {
  return {
    name: "TextureAlphaAnimationScene",
    meshes: [
      {
        name: "Quad",
        materials: [
          {
            name: "AlphaMaterial",
            diffuseTexture: {
              name: "fade_checker",
              fileName: "fade.tga",
              relativeFileName: "fade.tga",
              alpha: 0.8
            }
          }
        ],
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
        name: "TextureFade",
        frameRate: 30,
        tracks: [
          {
            target: "fade_checker",
            property: "textureAlpha",
            keyframes: [
              { frame: 0, value: 0.8 },
              { frame: 30, value: 0.25 }
            ]
          }
        ]
      }
    ]
  };
}

function threeTextureAlphaAnimationScene() {
  const texture = new Texture({ src: "fade.tga" });
  texture.name = "fade_checker";
  texture.userData.relativeFileName = "fade.tga";
  texture.userData.alpha = 0.8;

  const material = new MeshBasicMaterial({ name: "AlphaMaterial", map: texture });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "Quad";

  const scene = new Scene();
  scene.name = "ThreeTextureAlphaAnimationScene";
  scene.add(mesh);
  scene.animations = [
    new AnimationClip("TextureFade", 1, [
      new NumberKeyframeTrack("Quad.material.map.userData.alpha", [0, 1], [0.8, 0.25])
    ])
  ];
  return scene;
}

test("normalizes texture alpha animation targets", () => {
  const scene = normalizeFbxScene(textureAlphaAnimationScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;
  const track = scene.animations[0].tracks[0];

  assert.equal(texture.alpha, 0.8);
  assert.equal(track.target, "fade_checker");
  assert.equal(track.property, "textureAlpha");
  assert.deepEqual(rounded(track.keyframes.map((keyframe) => keyframe.value)), [0.8, 0.25]);
});

test("adapts Three.js texture alpha tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeTextureAlphaAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const texture = scene.meshes[0].materials[0].diffuseTexture;
  const track = scene.animations[0].tracks[0];

  assert.equal(texture.alpha, 0.8);
  assert.equal(track.target, "fade_checker");
  assert.equal(track.property, "textureAlpha");
  assert.deepEqual(rounded(track.keyframes.map((keyframe) => keyframe.value)), [0.8, 0.25]);
});

test("writes texture alpha animation curves", () => {
  const text = decode(exportFbx(textureAlphaAnimationScene()));

  assert.match(text, /fade_checker/);
  assert.match(text, /Texture alpha/);
  assert.match(text, /AnimationCurveNode/);
  assert.match(text, /AnimationCurve/);
});
