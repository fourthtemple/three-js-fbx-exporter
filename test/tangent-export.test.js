import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Scene,
  Uint16BufferAttribute
} from "three";
import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { arrayBufferFrom, decode } from "./fbx-test-helpers.js";

function tangentScene() {
  return {
    name: "TangentScene",
    meshes: [
      {
        name: "TangentQuad",
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2], [0, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1],
          tangents: [
            1, 0, 0, 1,
            1, 0, 0, 1,
            1, 0, 0, 1,
            1, 0, 0, 1
          ],
          binormals: [
            0, 1, 0,
            0, 1, 0,
            0, 1, 0,
            0, 1, 0
          ]
        }
      }
    ]
  };
}

function threeTangentScene() {
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
  geometry.setAttribute("tangent", new Float32BufferAttribute([
    1, 0, 0, 1,
    1, 0, 0, 1,
    1, 0, 0, 1,
    1, 0, 0, 1
  ], 4));
  geometry.setIndex(new Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1));

  const mesh = new Mesh(geometry, new MeshBasicMaterial({ name: "TangentMaterial" }));
  mesh.name = "TangentQuad";
  const scene = new Scene();
  scene.name = "ThreeTangentScene";
  scene.add(mesh);
  return scene;
}

test("normalizes tangent and binormal data by polygon vertex", () => {
  const scene = normalizeFbxScene(tangentScene());
  const geometry = scene.meshes[0].geometry;

  assert.equal(geometry.tangents.length, 18);
  assert.equal(geometry.binormals.length, 18);
  assert.deepEqual(geometry.tangents.slice(0, 3), [1, 0, 0]);
  assert.deepEqual(geometry.binormals.slice(0, 3), [0, 1, 0]);
});

test("writes FBX tangent-space layers", () => {
  const text = decode(exportFbx(tangentScene()));

  assert.match(text, /LayerElementBinormal/);
  assert.match(text, /LayerElementTangent/);
  assert.match(text, /Binormals/);
  assert.match(text, /Tangents/);
});

test("adapts Three.js tangent attributes into FBX tangent space", () => {
  const scene = fromThreeObject(threeTangentScene());
  const geometry = scene.meshes[0].geometry;

  assert.equal(geometry.tangents.length, 18);
  assert.equal(geometry.binormals.length, 18);
  assert.deepEqual(geometry.tangents.slice(0, 3), [1, 0, 0]);
  assert.deepEqual(geometry.binormals.slice(0, 3), [0, 1, 0]);
});

test("Three.js FBXLoader parses tangent-space meshes", async () => {
  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(threeTangentScene())), "");
  const mesh = group.getObjectByName("TangentQuad");

  assert.equal(mesh.isMesh, true);
  assert.ok(mesh.geometry.attributes.position);
});
