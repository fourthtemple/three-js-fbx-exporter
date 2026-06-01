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
  Texture
} from "three";
import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import {
  arrayBufferFrom,
  blenderPath,
  blenderTestArgs,
  checkerTga,
  decode,
  hasBlender,
  withMockDocument
} from "./fbx-test-helpers.js";

function checkerDataUrl() {
  return `data:image/x-tga;base64,${Buffer.from(checkerTga()).toString("base64")}`;
}

function uvSetScene() {
  return {
    name: "UvSetScene",
    meshes: [
      {
        name: "UvQuad",
        materials: [
          {
            name: "UvMaterial",
            aoTexture: {
              name: "ao_checker",
              src: checkerDataUrl(),
              uvSet: "UVMap_1"
            }
          }
        ],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          uv2s: [0.1, 0.1, 0.9, 0.1, 0.9, 0.9, 0.1, 0.9],
          materialIndices: [0]
        }
      }
    ]
  };
}

function uv3SetScene() {
  const scene = uvSetScene();
  scene.name = "Uv3SetScene";
  const mesh = scene.meshes[0];
  mesh.materials[0].diffuseTexture = {
    name: "diffuse_checker",
    src: checkerDataUrl(),
    uvSet: "UVMap_2"
  };
  mesh.geometry.uv3s = [
    0.2, 0.2,
    0.8, 0.2,
    0.8, 0.8,
    0.2, 0.8
  ];
  return scene;
}

function threeUvSetScene() {
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
  geometry.setAttribute("uv2", new Float32BufferAttribute([
    0.1, 0.1,
    0.9, 0.1,
    0.9, 0.9,
    0.1, 0.9
  ], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);

  const aoMap = new Texture({ src: checkerDataUrl(), name: "ao_image" });
  aoMap.name = "ao_checker";

  const material = new MeshBasicMaterial({ name: "UvMaterial" });
  material.aoMap = aoMap;

  const scene = new Scene();
  scene.name = "ThreeUvSetScene";
  const mesh = new Mesh(geometry, material);
  mesh.name = "UvQuad";
  scene.add(mesh);
  return scene;
}

function threeDirectTextureUvSetScene() {
  const scene = threeUvSetScene();
  scene.name = "ThreeDirectTextureUvSetScene";
  const texture = scene.children[0].material.aoMap;
  texture.uvSetName = "UVMap_1";
  texture.userData = {};
  return scene;
}

test("exports multiple UV sets for textured meshes", () => {
  const scene = normalizeFbxScene(uvSetScene());
  const geometry = scene.meshes[0].geometry;

  assert.equal(geometry.uvSets.length, 2);
  assert.deepEqual(geometry.uvSets.map((uvSet) => uvSet.name), ["UVMap", "UVMap_1"]);
  const aoTexture = scene.meshes[0].materials[0].textures.find((texture) => texture.property === "Maya|TEX_ao_map");
  assert.equal(aoTexture.uvSet, "UVMap_1");

  const text = decode(exportFbx(scene));
  assert.match(text, /LayerElementUV/);
  assert.match(text, /UVMap_1/);
  assert.match(text, /UVSet/);
  assert.match(text, /Maya\|TEX_ao_map/);
});

test("normalizes internal uv3 shorthand into a third FBX UV set", () => {
  const scene = normalizeFbxScene(uv3SetScene());
  const mesh = scene.meshes[0];

  assert.equal(mesh.geometry.uvSets.length, 3);
  assert.deepEqual(mesh.geometry.uvSets.map((uvSet) => uvSet.name), ["UVMap", "UVMap_1", "UVMap_2"]);
  assert.equal(mesh.materials[0].diffuseTexture.uvSet, "UVMap_2");

  const text = decode(exportFbx(scene));
  assert.match(text, /UVMap_2/);
  assert.match(text, /diffuse_checker/);
});

test("Three.js FBXLoader parses secondary UVs and AO texture connections", async () => {
  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(uvSetScene())), "");
    const mesh = group.getObjectByName("UvQuad");

    assert.ok(mesh.geometry.attributes.uv);
    assert.ok(mesh.geometry.attributes.uv1);
    assert.equal(mesh.geometry.attributes.uv.count, mesh.geometry.attributes.uv1.count);
    assert.ok(mesh.material.aoMap);
    assert.equal(mesh.material.aoMap.name, "ao_checker");
  });
});

test("adapts Three.js uv2 attributes and aoMap textures", async () => {
  const source = threeUvSetScene();
  const scene = fromThreeObject(source);
  const mesh = scene.meshes[0];

  assert.equal(mesh.geometry.uvSets.length, 2);
  assert.deepEqual(mesh.geometry.uvSets.map((uvSet) => uvSet.name), ["UVMap", "UVMap_1"]);
  assert.equal(mesh.materials[0].aoTexture.fileName, "ao_checker.tga");
  assert.equal(mesh.materials[0].aoTexture.uvSet, "UVMap_1");

  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(source)), "");
    const exportedMesh = group.getObjectByName("UvQuad");
    assert.ok(exportedMesh.geometry.attributes.uv1);
    assert.ok(exportedMesh.material.aoMap);
  });
});

test("adapts direct Three.js texture UV-set aliases", () => {
  const scene = fromThreeObject(threeDirectTextureUvSetScene());
  const material = scene.meshes[0].materials[0];

  assert.equal(material.aoTexture.uvSet, "UVMap_1");
});

test("Blender imports secondary UV layers and packed AO image", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "uv-set.fbx");
  await writeFile(fbxPath, exportFbx(uvSetScene()));

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
mesh = next((obj.data for obj in bpy.context.scene.objects if obj.type == "MESH"), None)
images = [img for img in bpy.data.images if img.filepath or img.packed_file]
print("FBX_VALIDATE:" + json.dumps({
    "uvLayers": [layer.name for layer in mesh.uv_layers] if mesh else [],
    "images": len(images),
    "imageNames": sorted(img.name for img in images),
    "packed": sum(1 for img in images if img.packed_file),
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
  assert.deepEqual(info.uvLayers, ["UVMap", "UVMap_1"]);
  assert.equal(info.images, 1);
  assert.deepEqual(info.imageNames, ["ao_checker"]);
  assert.equal(info.packed, 1);
});
