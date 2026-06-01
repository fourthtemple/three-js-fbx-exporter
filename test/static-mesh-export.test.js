import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createCubeScene, exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { deflateArrayBytes } from "../src/node/node-array-compressor.js";
import { arrayBufferFrom, blenderPath, blenderTestArgs, checkerTga, decode, hasBlender, withMockDocument } from "./fbx-test-helpers.js";

function multiTextureScene() {
  return {
    name: "MultiTextureScene",
    meshes: [
      {
        name: "MultiTextureQuad",
        materials: [
          {
            name: "MultiTextureMaterial",
            diffuseTexture: { name: "diffuse", fileName: "diffuse.tga", relativeFileName: "diffuse.tga" },
            normalTexture: { name: "normal", fileName: "normal.tga", relativeFileName: "normal.tga" },
            alphaTexture: {
              name: "alpha",
              fileName: "alpha.tga",
              relativeFileName: "alpha.tga",
              content: checkerTga()
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
    ]
  };
}

function fakeInstancedMeshScene() {
  const triangleGeometry = {
    attributes: {
      position: {
        itemSize: 3,
        count: 3,
        array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])
      },
      uv: {
        itemSize: 2,
        count: 3,
        array: new Float32Array([0, 0, 1, 0, 0, 1])
      }
    },
    morphAttributes: {
      position: [
        {
          name: "Puff",
          itemSize: 3,
          count: 3,
          array: new Float32Array([0, 0, 0, 1.2, 0, 0, 0, 1.3, 0])
        },
        {
          name: "Lift",
          itemSize: 3,
          count: 3,
          array: new Float32Array([0, 0, 0, 1, 0, 0.25, 0, 1, 0.5])
        }
      ]
    }
  };
  const instanceMatrices = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    2, 0, 0, 1
  ]);
  const instancedMesh = {
    name: "TriangleBatch",
    type: "InstancedMesh",
    isInstancedMesh: true,
    count: 2,
    instanceMatrix: { array: instanceMatrices },
    instanceColor: {
      itemSize: 3,
      count: 2,
      array: new Float32Array([
        1, 0.25, 0.5,
        0.1, 0.5, 1
      ])
    },
    morphTexture: {
      source: {
        data: {
          width: 3,
          height: 2,
          data: new Float32Array([
            0.75, 0.2, 0.05,
            0.4, 0.6, 0
          ])
        }
      }
    },
    morphTargetInfluences: [0.9, 0.9],
    morphTargetDictionary: { Puff: 0, Lift: 1 },
    geometry: triangleGeometry,
    material: {
      name: "BatchMaterial",
      color: { r: 0.4, g: 0.7, b: 1 }
    },
    position: { x: 1, y: 2, z: 3 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  };
  return {
    name: "FakeInstancedScene",
    type: "Scene",
    traverse(callback) {
      callback(this);
      callback(instancedMesh);
    }
  };
}

function rounded(values) {
  return values.map((value) => Number(value.toFixed(4)));
}

test("exports a static mesh document with geometry, model, and material sections", () => {
  const bytes = exportFbx(createCubeScene());
  const text = decode(bytes);

  assert.match(text, /CubeGeometry/);
  assert.match(text, /Cube/);
  assert.match(text, /WarmGray/);
  assert.match(text, /Vertices/);
  assert.match(text, /PolygonVertexIndex/);
  assert.match(text, /LayerElementNormal/);
  assert.match(text, /LayerElementUV/);
});

test("exports texture, video, and baked transform animation records", () => {
  const bytes = exportFbx(createCubeScene({ animated: true, textured: true }));
  const text = decode(bytes);

  assert.match(text, /Texture/);
  assert.match(text, /Video/);
  assert.match(text, /checker\.tga/);
  assert.match(text, /AnimationStack/);
  assert.match(text, /AnimationLayer/);
  assert.match(text, /AnimationCurveNode/);
  assert.match(text, /AnimationCurve/);
  assert.match(text, /KeyTime/);
  assert.match(text, /KeyValueFloat/);
});

test("exports multiple material texture slots and embedded image content", () => {
  const bytes = exportFbx(multiTextureScene());
  const text = decode(bytes);

  assert.match(text, /DiffuseColor/);
  assert.match(text, /NormalMap/);
  assert.match(text, /TransparencyFactor/);
  assert.match(text, /Content/);
  assert.match(text, /diffuse\.tga/);
  assert.match(text, /normal\.tga/);
  assert.match(text, /alpha\.tga/);
});

test("normalizes internal vertex normals into polygon-vertex normals", () => {
  const scene = normalizeFbxScene({
    name: "VertexNormalScene",
    meshes: [
      {
        name: "VertexNormalQuad",
        materials: [{ name: "Mat" }],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2], [0, 2, 3]],
          normals: [
            1, 0, 0,
            0, 1, 0,
            0, 0, 1,
            -1, 0, 0
          ],
          uvs: [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]
        }
      }
    ]
  });
  const normals = scene.meshes[0].geometry.normals;

  assert.equal(normals.length, 18);
  assert.deepEqual(normals.slice(0, 9), [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.deepEqual(normals.slice(9, 18), [1, 0, 0, 0, 0, 1, -1, 0, 0]);
});

test("adapts a Three.js-like BufferGeometry mesh", () => {
  const source = {
    name: "FakeThreeScene",
    traverse(callback) {
      callback(this);
      callback({
        name: "Triangle",
        geometry: {
          attributes: {
            position: {
              itemSize: 3,
              count: 3,
              array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])
            },
            normal: {
              itemSize: 3,
              count: 3,
              array: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1])
            },
            uv: {
              itemSize: 2,
              count: 3,
              array: new Float32Array([0, 0, 1, 0, 0, 1])
            }
          }
        },
        material: {
          name: "TriangleMaterial",
          color: { r: 1, g: 0.2, b: 0.1 }
        },
        position: { x: 2, y: 3, z: 4 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      });
    }
  };

  const scene = fromThreeObject(source);
  assert.equal(scene.meshes.length, 1);
  assert.equal(scene.meshes[0].geometry.faces.length, 1);
  assert.deepEqual(scene.meshes[0].transform.translation, [2, 3, 4]);

  const bytes = exportFbx(source);
  assert.match(decode(bytes), /Triangle/);
});

test("adapts Three.js drawRange without exporting hidden triangles", () => {
  const source = {
    name: "DrawRangeScene",
    traverse(callback) {
      callback(this);
      callback({
        name: "RangedQuad",
        geometry: {
          index: { array: new Uint16Array([0, 1, 2, 0, 2, 3]) },
          drawRange: { start: 3, count: 3 },
          groups: [
            { start: 0, count: 3, materialIndex: 0 },
            { start: 3, count: 3, materialIndex: 1 }
          ],
          attributes: {
            position: {
              itemSize: 3,
              count: 4,
              array: new Float32Array([
                -1, -1, 0,
                1, -1, 0,
                1, 1, 0,
                -1, 1, 0
              ])
            },
            uv: {
              itemSize: 2,
              count: 4,
              array: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])
            }
          }
        },
        material: [
          { name: "HiddenMaterial", color: { r: 1, g: 0, b: 0 } },
          { name: "VisibleMaterial", color: { r: 0, g: 1, b: 0 } }
        ]
      });
    }
  };

  const scene = fromThreeObject(source);
  const geometry = scene.meshes[0].geometry;

  assert.deepEqual(geometry.faces, [[0, 2, 3]]);
  assert.deepEqual(geometry.materialIndices, [1]);
  assert.deepEqual(geometry.uvs, [0, 0, 1, 1, 0, 1]);

  const bytes = exportFbx(source);
  assert.match(decode(bytes), /VisibleMaterial/);
});

test("adapts Three.js triangle strip and fan draw modes", () => {
  const strip = {
    name: "StripQuad",
    geometry: {
      drawMode: "triangle-strip",
      index: { array: new Uint16Array([0, 1, 2, 3]) },
      groups: [
        { start: 0, count: 1, materialIndex: 0 },
        { start: 1, count: 3, materialIndex: 1 }
      ],
      attributes: {
        position: {
          itemSize: 3,
          count: 4,
          array: new Float32Array([
            -1, -1, 0,
            1, -1, 0,
            -1, 1, 0,
            1, 1, 0
          ])
        },
        uv: {
          itemSize: 2,
          count: 4,
          array: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
        }
      }
    },
    material: [
      { name: "StripFirst", color: { r: 1, g: 0, b: 0 } },
      { name: "StripSecond", color: { r: 0, g: 1, b: 0 } }
    ]
  };
  const fan = {
    name: "FanQuad",
    drawMode: 2,
    geometry: {
      index: { array: new Uint16Array([0, 1, 2, 3]) },
      attributes: {
        position: {
          itemSize: 3,
          count: 4,
          array: new Float32Array([
            0, 0, 0,
            1, 0, 0,
            1, 1, 0,
            0, 1, 0
          ])
        },
        uv: {
          itemSize: 2,
          count: 4,
          array: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])
        }
      }
    },
    material: { name: "FanMaterial", color: { r: 0, g: 0, b: 1 } }
  };
  const source = {
    name: "DrawModeScene",
    traverse(callback) {
      callback(this);
      callback(strip);
      callback(fan);
    }
  };

  const scene = fromThreeObject(source);
  assert.deepEqual(scene.meshes[0].geometry.faces, [[0, 1, 2], [3, 2, 1]]);
  assert.deepEqual(scene.meshes[0].geometry.materialIndices, [0, 1]);
  assert.deepEqual(scene.meshes[1].geometry.faces, [[0, 1, 2], [0, 2, 3]]);

  const bytes = exportFbx(source);
  const text = decode(bytes);
  assert.match(text, /StripSecond/);
  assert.match(text, /FanMaterial/);
});

test("expands Three.js InstancedMesh entries into individual FBX mesh models", async () => {
  const source = fakeInstancedMeshScene();
  const scene = fromThreeObject(source);

  assert.deepEqual(scene.nodes.map((node) => node.name), ["TriangleBatch"]);
  assert.deepEqual(scene.nodes[0].transform.translation, [1, 2, 3]);
  assert.deepEqual(scene.meshes.map((mesh) => mesh.name), ["TriangleBatch_1", "TriangleBatch_2"]);
  assert.deepEqual(scene.meshes.map((mesh) => mesh.parent), ["TriangleBatch", "TriangleBatch"]);
  assert.deepEqual(scene.meshes.map((mesh) => mesh.transform.translation), [
    [0, 0, 0],
    [2, 0, 0]
  ]);
  assert.deepEqual(scene.meshes.map((mesh) => rounded(mesh.geometry.colors.slice(0, 4))), [
    [1, 0.25, 0.5, 1],
    [0.1, 0.5, 1, 1]
  ]);
  assert.deepEqual(scene.meshes.map((mesh) => mesh.geometry.morphTargets.map((target) => target.name)), [
    ["Puff", "Lift"],
    ["Puff", "Lift"]
  ]);
  assert.deepEqual(scene.meshes.map((mesh) => rounded(mesh.geometry.morphTargets.map((target) => target.weight))), [
    [0.2, 0.05],
    [0.6, 0]
  ]);

  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(source)), "");
  const meshes = [];
  group.traverse((object) => {
    if (object.isMesh) {
      meshes.push(object);
    }
  });
  assert.deepEqual(meshes.map((mesh) => mesh.name), ["TriangleBatch_1", "TriangleBatch_2"]);
  assert.ok(meshes.every((mesh) => mesh.morphTargetDictionary.Puff === 0));
  assert.ok(meshes.every((mesh) => mesh.morphTargetDictionary.Lift === 1));
  assert.ok(meshes.every((mesh) => mesh.geometry.attributes.color));
  assert.ok(meshes.every((mesh) => mesh.material.vertexColors));
});

test("adapts real Three.js InstancedMesh morphTexture weights per expanded mesh", async () => {
  const {
    BufferAttribute,
    BufferGeometry,
    InstancedMesh,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    Scene
  } = await import("three");
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array([
    0, 0, 0,
    1, 0, 0,
    0, 1, 0
  ]), 3));
  geometry.morphAttributes.position = [
    new BufferAttribute(new Float32Array([
      0, 0, 0,
      1.5, 0, 0,
      0, 1.5, 0
    ]), 3),
    new BufferAttribute(new Float32Array([
      0, 0, 0,
      1, 0, 0.25,
      0, 1, 0.5
    ]), 3)
  ];
  geometry.morphAttributes.position[0].name = "Puff";
  geometry.morphAttributes.position[1].name = "Lift";

  const material = new MeshBasicMaterial({ name: "MorphBatchMaterial" });
  const instancedMesh = new InstancedMesh(geometry, material, 2);
  instancedMesh.name = "RealMorphBatch";
  instancedMesh.setMatrixAt(0, new Matrix4().identity());
  instancedMesh.setMatrixAt(1, new Matrix4().makeTranslation(2, 0, 0));

  const morphSource = new Mesh(geometry, material);
  morphSource.morphTargetInfluences = [0.15, 0.35];
  instancedMesh.setMorphAt(0, morphSource);
  morphSource.morphTargetInfluences = [0.8, 0.1];
  instancedMesh.setMorphAt(1, morphSource);

  const root = new Scene();
  root.add(instancedMesh);
  const scene = fromThreeObject(root);

  assert.deepEqual(scene.meshes.map((mesh) => mesh.name), ["RealMorphBatch_1", "RealMorphBatch_2"]);
  assert.deepEqual(scene.meshes.map((mesh) => rounded(mesh.geometry.morphTargets.map((target) => target.weight))), [
    [0.15, 0.35],
    [0.8, 0.1]
  ]);
});

test("Three.js FBXLoader parses the generated static mesh", async () => {
  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const bytes = exportFbx(createCubeScene());
  const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");
  const meshes = [];
  group.traverse((object) => {
    if (object.isMesh) {
      meshes.push(object);
    }
  });

  assert.equal(meshes.length, 1);
  assert.ok(meshes[0].geometry.attributes.position.count >= 8);
  assert.ok(meshes[0].material);
});

test("Three.js FBXLoader parses FBX 7500 static meshes", async () => {
  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const bytes = exportFbx(createCubeScene(), { version: 7500 });
  const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");
  const mesh = group.children.find((object) => object.isMesh);

  assert.ok(mesh);
  assert.equal(mesh.name, "Cube");
  assert.ok(mesh.geometry.attributes.position.count >= 8);
});

test("Three.js FBXLoader parses compressed typed-array static meshes", async () => {
  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const bytes = exportFbx(createCubeScene(), { compressArrayBytes: deflateArrayBytes });
  const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");
  const mesh = group.children.find((object) => object.isMesh);

  assert.ok(mesh);
  assert.equal(mesh.name, "Cube");
  assert.ok(mesh.geometry.attributes.position.count >= 8);
});

test("Three.js FBXLoader parses compressed animated textured meshes", async () => {
  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const bytes = exportFbx(createCubeScene({ animated: true, textured: true }), {
      compressArrayBytes: deflateArrayBytes
    });
    const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");
    const mesh = group.children.find((object) => object.isMesh);

    assert.equal(group.animations.length, 1);
    assert.deepEqual(group.animations[0].tracks.map((track) => track.name), ["Cube.position", "Cube.quaternion"]);
    assert.ok(mesh.material.map);
    assert.equal(mesh.material.map.name, "checker");
  });
});

test("Three.js FBXLoader parses generated textures and transform animation", async () => {
  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const bytes = exportFbx(createCubeScene({ animated: true, textured: true }));
    const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");
    const mesh = group.children.find((object) => object.isMesh);

    assert.equal(group.animations.length, 1);
    assert.deepEqual(group.animations[0].tracks.map((track) => track.name), ["Cube.position", "Cube.quaternion"]);
    assert.ok(mesh.material.map);
    assert.equal(mesh.material.map.name, "checker");
  });
});

test("Three.js FBXLoader parses multiple supported material texture slots", async () => {
  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const bytes = exportFbx(multiTextureScene());
    const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");
    const mesh = group.children.find((object) => object.isMesh);

    assert.ok(mesh.material.map);
    assert.ok(mesh.material.normalMap);
    assert.ok(mesh.material.alphaMap);
    assert.equal(mesh.material.transparent, true);
  });
});

test("Blender imports multiple material texture slots including embedded content", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "multi-texture.fbx");
  await writeFile(join(tempDir, "diffuse.tga"), checkerTga());
  await writeFile(join(tempDir, "normal.tga"), checkerTga());
  await writeFile(fbxPath, exportFbx(multiTextureScene()));

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
images = [img for img in bpy.data.images if img.filepath or img.packed_file]
print("FBX_VALIDATE:" + json.dumps({
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
  assert.equal(info.images, 3);
  assert.deepEqual(info.imageNames, ["alpha", "diffuse", "normal"]);
  assert.equal(info.packed, 1);
});

test("Blender imports the generated static mesh", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "static-mesh.fbx");
  await writeFile(fbxPath, exportFbx(createCubeScene()));

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
data = meshes[0].data if meshes else None
print("FBX_VALIDATE:" + json.dumps({
    "meshObjects": len(meshes),
    "vertices": len(data.vertices) if data else 0,
    "polygons": len(data.polygons) if data else 0,
    "materials": len(data.materials) if data else 0,
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
  assert.equal(info.meshObjects, 1);
  assert.equal(info.vertices, 8);
  assert.equal(info.polygons, 6);
  assert.equal(info.materials, 1);
});

test("Blender imports generated textures and transform animation", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "feature-sample.fbx");
  await writeFile(join(tempDir, "checker.tga"), checkerTga());
  await writeFile(fbxPath, exportFbx(createCubeScene({ animated: true, textured: true })));

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
images = [img for img in bpy.data.images if img.filepath]
actions = list(bpy.data.actions)
animated = [obj.name for obj in bpy.context.scene.objects if obj.animation_data and obj.animation_data.action]
print("FBX_VALIDATE:" + json.dumps({
    "meshObjects": len(meshes),
    "images": len(images),
    "actions": len(actions),
    "fcurves": len(actions[0].fcurves) if actions else 0,
    "animated": animated,
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
  assert.equal(info.meshObjects, 1);
  assert.equal(info.images, 1);
  assert.equal(info.actions, 1);
  assert.equal(info.fcurves, 9);
  assert.deepEqual(info.animated, ["Cube"]);
});
