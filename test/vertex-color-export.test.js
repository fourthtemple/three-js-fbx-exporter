import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Scene,
  Uint8BufferAttribute
} from "three";
import { createVertexColorScene, exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { arrayBufferFrom, blenderPath, blenderTestArgs, decode, hasBlender } from "./fbx-test-helpers.js";

function assertClose(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} not close to ${expected}`);
}

function vertexColorScene() {
  return createVertexColorScene({ name: "VertexColorScene" });
}

function threeVertexColorScene() {
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
  geometry.setAttribute("color", new Float32BufferAttribute([
    1, 0, 0,
    0, 1, 0,
    0, 0, 1,
    1, 1, 0
  ], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);

  const material = new MeshBasicMaterial({ name: "ColorMaterial", vertexColors: true });
  const mesh = new Mesh(geometry, material);
  mesh.name = "ColorQuad";

  const scene = new Scene();
  scene.name = "ThreeVertexColorScene";
  scene.add(mesh);
  return scene;
}

function threeNormalizedVertexColorScene() {
  const scene = threeVertexColorScene();
  scene.name = "ThreeNormalizedVertexColorScene";
  const geometry = scene.getObjectByName("ColorQuad").geometry;
  geometry.setAttribute("color", new Uint8BufferAttribute([
    255, 0, 0, 128,
    0, 255, 0, 255,
    0, 0, 255, 64,
    255, 255, 0, 32
  ], 4, true));
  return scene;
}

test("exports vertex colors as FBX layer element colors", () => {
  const scene = normalizeFbxScene(vertexColorScene());
  assert.equal(scene.meshes[0].geometry.colors.length, 16);

  const text = decode(exportFbx(scene));
  assert.match(text, /LayerElementColor/);
  assert.match(text, /Colors/);
  assert.match(text, /ColorIndex/);
});

test("Three.js FBXLoader parses vertex colors and enables material vertexColors", async () => {
  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(vertexColorScene())), "");
  const mesh = group.getObjectByName("ColorQuad");

  assert.ok(mesh.geometry.attributes.color);
  assert.equal(mesh.geometry.attributes.color.count, mesh.geometry.attributes.position.count);
  assert.equal(mesh.material.vertexColors, true);
});

test("adapts Three.js color attributes into FBX vertex colors", async () => {
  const source = threeVertexColorScene();
  const scene = fromThreeObject(source);
  const mesh = scene.meshes[0];

  assert.equal(mesh.geometry.colors.length, 24);

  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(source)), "");
  const exportedMesh = group.getObjectByName("ColorQuad");
  assert.ok(exportedMesh.geometry.attributes.color);
  assert.equal(exportedMesh.material.vertexColors, true);
});

test("normalizes Three.js integer color attributes before FBX export", () => {
  const scene = fromThreeObject(threeNormalizedVertexColorScene());
  const colors = scene.meshes[0].geometry.colors;

  assert.equal(colors.length, 24);
  assert.deepEqual(colors.slice(0, 3), [1, 0, 0]);
  assertClose(colors[3], 128 / 255);
  assert.deepEqual(colors.slice(4, 7), [0, 1, 0]);
  assert.equal(colors[7], 1);
});

test("Blender imports vertex colors as color attributes", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "vertex-color.fbx");
  await writeFile(fbxPath, exportFbx(vertexColorScene()));

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
mesh = next((obj.data for obj in bpy.context.scene.objects if obj.type == "MESH"), None)
attrs = list(mesh.color_attributes) if mesh else []
print("FBX_VALIDATE:" + json.dumps({
    "colorAttributes": [(attr.name, attr.domain, attr.data_type, len(attr.data)) for attr in attrs],
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
  assert.equal(info.colorAttributes.length, 1);
  assert.equal(info.colorAttributes[0][0], "Color");
  assert.equal(info.colorAttributes[0][1], "CORNER");
  assert.equal(info.colorAttributes[0][3], 4);
});
