import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AnimationClip,
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Texture,
  VectorKeyframeTrack
} from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { arrayBufferFrom, withMockDocument } from "./fbx-test-helpers.js";

function rounded(values) {
  return values.map((value) => Number(value.toFixed(4)));
}

function lineTexture() {
  const texture = new Texture({ src: "line.tga" });
  texture.name = "line_map";
  texture.userData.relativeFileName = "line.tga";
  texture.animations = [
    new AnimationClip("LineTextureDrift", 1, [
      new VectorKeyframeTrack("offset", [0, 1], [
        0, 0,
        0.125, 0.25
      ])
    ])
  ];
  return texture;
}

function lineGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array([
    0, 0, 0,
    4, 0, 0,
    0, 3, 0,
    0, 3, 3
  ]), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array([
    1, 0, 0,
    0, 1, 0,
    0, 0, 1,
    1, 1, 0
  ]), 3));
  geometry.setIndex([0, 1, 2, 3, 3, 0]);
  geometry.setDrawRange(0, 4);
  geometry.addGroup(0, 2, 0);
  geometry.addGroup(2, 2, 1);
  return geometry;
}

function lineScene() {
  const primary = new LineBasicMaterial({
    name: "LineMaterialA",
    vertexColors: true,
    linewidth: 0.5
  });
  primary.map = lineTexture();
  const secondary = new LineBasicMaterial({
    name: "LineMaterialB",
    color: 0xffffff,
    linewidth: 0.25
  });
  const line = new LineSegments(lineGeometry(), [primary, secondary]);
  line.name = "GuideLines";
  line.position.set(1, 2, 3);
  return line;
}

function threePointGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array([
    0, 0, 0,
    2, 0, 0,
    2, 2, 0
  ]), 3));
  return geometry;
}

test("adapts Three.js LineSegments into textured ribbon mesh geometry", () => {
  const scene = fromThreeObject(lineScene());
  const mesh = scene.meshes[0];

  assert.equal(mesh.name, "GuideLines");
  assert.deepEqual(mesh.transform.translation, [1, 2, 3]);
  assert.deepEqual(mesh.geometry.faces, [[0, 1, 2], [0, 2, 3], [4, 5, 6], [4, 6, 7]]);
  assert.deepEqual(rounded(mesh.geometry.vertices.slice(0, 12)), [
    0, -0.25, 0,
    4, -0.25, 0,
    4, 0.25, 0,
    0, 0.25, 0
  ]);
  assert.deepEqual(mesh.geometry.materialIndices, [0, 0, 1, 1]);
  assert.deepEqual(mesh.geometry.uvs.slice(0, 12), [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
  assert.deepEqual(rounded(mesh.geometry.colors.slice(0, 8)), [1, 0, 0, 1, 0, 1, 0, 1]);
  assert.equal(mesh.materials[0].shadingModel, "Lambert");
  assert.equal(mesh.materials[0].vertexColors, 1);
  assert.equal(mesh.materials[0].wireframeLinewidth, 0.5);
  assert.equal(mesh.materials[0].diffuseTexture.name, "line_map");
});

test("adapts Three.js Line strips and LineLoop closures into ribbon segments", () => {
  const material = new LineBasicMaterial({ name: "LineMaterial", linewidth: 0.2 });
  const strip = fromThreeObject(new Line(threePointGeometry(), material)).meshes[0];
  const loop = fromThreeObject(new LineLoop(threePointGeometry(), material)).meshes[0];

  assert.equal(strip.geometry.faces.length, 4);
  assert.equal(loop.geometry.faces.length, 6);
});

test("keeps Line texture-owned animation targets connected", () => {
  const scene = normalizeFbxScene(fromThreeObject(lineScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations.map((clip) => clip.name), ["LineTextureDrift"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["line_map", "textureTranslation"]
  ]);
  assert.deepEqual(rounded(scene.animations[0].tracks[0].keyframes[1].value), [0.125, 0.25, 0]);
});

test("exports Three.js LineSegments as an FBXLoader-readable textured mesh", async () => {
  await withMockDocument(async () => {
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(lineScene())), "");
    const mesh = group.getObjectByName("GuideLines");
    const materials = Array.isArray(mesh?.material) ? mesh.material : [mesh?.material].filter(Boolean);

    assert.ok(mesh?.isMesh);
    assert.equal(mesh.geometry.attributes.position.count, 12);
    assert.ok(mesh.geometry.attributes.color);
    assert.equal(materials.length, 2);
    assert.equal(materials[0].name, "LineMaterialA");
    assert.ok(materials[0].map);
  });
});
