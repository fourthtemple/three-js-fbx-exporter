import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AnimationClip,
  BufferAttribute,
  BufferGeometry,
  Points,
  PointsMaterial,
  Texture,
  VectorKeyframeTrack
} from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { arrayBufferFrom, withMockDocument } from "./fbx-test-helpers.js";

function rounded(values) {
  return values.map((value) => Number(value.toFixed(4)));
}

function pointsScene() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array([
    0, 0, 0,
    4, 0, 0,
    0, 3, 0
  ]), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array([
    1, 0, 0,
    0, 1, 0,
    0.25, 0.5, 1
  ]), 3));
  geometry.setIndex([2, 0, 1]);
  geometry.setDrawRange(0, 2);

  const texture = new Texture({ src: "point.tga" });
  texture.name = "point_map";
  texture.userData.relativeFileName = "point.tga";
  texture.animations = [
    new AnimationClip("PointTextureDrift", 1, [
      new VectorKeyframeTrack("offset", [0, 1], [
        0, 0,
        0.2, 0.4
      ])
    ])
  ];

  const material = new PointsMaterial({
    name: "PointMaterial",
    map: texture,
    size: 2,
    vertexColors: true
  });
  const points = new Points(geometry, material);
  points.name = "Sparkles";
  points.position.set(1, 2, 3);
  return points;
}

test("adapts Three.js Points into textured quad mesh geometry", () => {
  const scene = fromThreeObject(pointsScene());
  const mesh = scene.meshes[0];

  assert.equal(mesh.name, "Sparkles");
  assert.deepEqual(mesh.transform.translation, [1, 2, 3]);
  assert.deepEqual(mesh.geometry.faces, [[0, 1, 2], [0, 2, 3], [4, 5, 6], [4, 6, 7]]);
  assert.deepEqual(rounded(mesh.geometry.vertices.slice(0, 12)), [
    -1, 2, 0,
    1, 2, 0,
    1, 4, 0,
    -1, 4, 0
  ]);
  assert.deepEqual(rounded(mesh.geometry.vertices.slice(12, 24)), [
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0,
    -1, 1, 0
  ]);
  assert.deepEqual(mesh.geometry.uvs.slice(0, 12), [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
  assert.deepEqual(rounded(mesh.geometry.colors.slice(0, 4)), [0.25, 0.5, 1, 1]);
  assert.deepEqual(rounded(mesh.geometry.colors.slice(24, 28)), [1, 0, 0, 1]);
  assert.equal(mesh.materials[0].shadingModel, "Lambert");
  assert.equal(mesh.materials[0].vertexColors, 1);
  assert.equal(mesh.materials[0].diffuseTexture.name, "point_map");
});

test("keeps Points texture-owned animation targets connected", () => {
  const scene = normalizeFbxScene(fromThreeObject(pointsScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations.map((clip) => clip.name), ["PointTextureDrift"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["point_map", "textureTranslation"]
  ]);
  assert.deepEqual(rounded(scene.animations[0].tracks[0].keyframes[1].value), [0.2, 0.4, 0]);
});

test("exports Three.js Points as an FBXLoader-readable textured mesh", async () => {
  await withMockDocument(async () => {
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(pointsScene())), "");
    const mesh = group.getObjectByName("Sparkles");

    assert.ok(mesh?.isMesh);
    assert.equal(mesh.geometry.attributes.position.count, 12);
    assert.ok(mesh.geometry.attributes.color);
    assert.equal(mesh.material.name, "PointMaterial");
    assert.ok(mesh.material.map);
    assert.equal(mesh.material.vertexColors, true);
  });
});
