import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AnimationClip,
  Sprite,
  SpriteMaterial,
  Texture,
  VectorKeyframeTrack
} from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { arrayBufferFrom, withMockDocument } from "./fbx-test-helpers.js";

function rounded(values) {
  return values.map((value) => Number(value.toFixed(4)));
}

function spriteScene() {
  const texture = new Texture({ src: "sprite.tga" });
  texture.name = "sprite_map";
  texture.userData.relativeFileName = "sprite.tga";
  texture.animations = [
    new AnimationClip("SpriteTextureDrift", 1, [
      new VectorKeyframeTrack("offset", [0, 1], [
        0, 0,
        0.25, 0.5
      ])
    ])
  ];

  const material = new SpriteMaterial({
    name: "SpriteMaterial",
    map: texture,
    rotation: Math.PI / 2
  });
  const sprite = new Sprite(material);
  sprite.name = "Billboard";
  sprite.center.set(0, 0);
  sprite.position.set(1, 2, 3);
  sprite.scale.set(2, 3, 1);

  return sprite;
}

test("adapts Three.js Sprite center and material rotation into mesh geometry", () => {
  const scene = fromThreeObject(spriteScene());
  const mesh = scene.meshes[0];

  assert.equal(mesh.name, "Billboard");
  assert.deepEqual(mesh.transform.translation, [1, 2, 3]);
  assert.deepEqual(mesh.transform.scale, [2, 3, 1]);
  assert.deepEqual(rounded(mesh.geometry.vertices), [
    0, 0, 0,
    0, 1, 0,
    -1, 1, 0,
    -1, 0, 0
  ]);
  assert.deepEqual(mesh.geometry.faces, [[0, 1, 2], [0, 2, 3]]);
  assert.deepEqual(mesh.geometry.uvs, [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
  assert.equal(mesh.materials[0].shadingModel, "Lambert");
  assert.equal(mesh.materials[0].diffuseTexture.name, "sprite_map");
});

test("keeps Sprite texture-owned animation targets connected", () => {
  const scene = normalizeFbxScene(fromThreeObject(spriteScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations.map((clip) => clip.name), ["SpriteTextureDrift"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["sprite_map", "textureTranslation"]
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes[1].value, [0.25, 0.5, 0]);
});

test("exports Three.js Sprite as an FBXLoader-readable textured mesh", async () => {
  await withMockDocument(async () => {
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(spriteScene())), "");
    const mesh = group.getObjectByName("Billboard");

    assert.ok(mesh?.isMesh);
    assert.equal(mesh.geometry.attributes.position.count, 6);
    assert.equal(mesh.material.name, "SpriteMaterial");
    assert.ok(mesh.material.map);
  });
});
