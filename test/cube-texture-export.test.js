import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  AnimationClip,
  BufferGeometry,
  CubeTexture,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  VectorKeyframeTrack
} from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

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

function checkerDataUrl() {
  return `data:image/x-tga;base64,${Buffer.from(checkerTga()).toString("base64")}`;
}

function faceImage(face, { animate = false, embedded = false } = {}) {
  const image = {
    name: `studio_${face}`,
    src: embedded ? checkerDataUrl() : `env-${face}.tga`,
    width: 4,
    height: 4
  };
  if (animate) {
    image.animations = [
      new AnimationClip("CubeFaceDrift", 1, [
        new VectorKeyframeTrack("offset", [0, 1], [
          0, 0,
          0.35, 0.45
        ])
      ])
    ];
  }
  return image;
}

function rounded(values) {
  return values.map((value) => Number(value.toFixed(6)));
}

function cubeTexture({ animate = false, embedded = false, faceAnimation = false, textureTransform = false } = {}) {
  const texture = new CubeTexture(["px", "nx", "py", "ny", "pz", "nz"].map((face) => {
    return faceImage(face, { animate: faceAnimation && face === "ny", embedded });
  }));
  texture.name = "studio_env";
  if (textureTransform) {
    texture.offset.set(0.125, 0.25);
    texture.repeat.set(2, 3);
    texture.center.set(0.5, 0.75);
    texture.rotation = 0.35;
    texture.channel = 1;
  }
  if (animate) {
    texture.animations = [
      new AnimationClip("CubeTextureDrift", 1, [
        new VectorKeyframeTrack("offset", [0, 1], [
          0, 0,
          0.2, 0.4
        ])
      ])
    ];
  }
  return texture;
}

function cubeTextureFromUserDataSource({ animate = false, faceAnimation = false } = {}) {
  const texture = new CubeTexture([]);
  texture.name = "userdata_env";
  texture.userData.source = {
    data: ["px", "nx", "py", "ny", "pz", "nz"].map((face) => {
      return faceImage(face, { animate: faceAnimation && face === "pz" });
    })
  };
  if (animate) {
    texture.userData.source.animations = [
      new AnimationClip("UserDataCubeTextureDrift", 1, [
        new VectorKeyframeTrack("offset", [0, 1], [
          0, 0,
          0.18, 0.28
        ])
      ])
    ];
  }
  return texture;
}

function cubeTextureScene(options = {}) {
  const material = new MeshStandardMaterial({
    name: "CubeEnvMaterial",
    envMap: cubeTexture(options),
    envMapIntensity: 0.75,
    metalness: 0.5,
    roughness: 0.25
  });
  if (options.envMapRotation) {
    material.envMapRotation.set(0.1, 0.2, 0.3);
  }
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "CubeEnvQuad";
  return mesh;
}

function cubeTextureUserDataSourceScene(options = {}) {
  const material = new MeshStandardMaterial({
    name: "CubeUserDataEnvMaterial",
    envMap: cubeTextureFromUserDataSource(options),
    envMapIntensity: 0.5,
    metalness: 0.25,
    roughness: 0.5
  });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "CubeUserDataEnvQuad";
  return mesh;
}

test("preserves Three.js CubeTexture faces as custom texture lanes", () => {
  const scene = fromThreeObject(cubeTextureScene());
  const material = normalizeFbxScene(scene).meshes[0].materials[0];
  const reflectionTexture = material.textures.find((texture) => texture.property === "ReflectionColor");
  const faceTextures = material.textures.filter((texture) => texture.property.startsWith("Maya|TEX_cube_studio_env_"));

  assert.equal(reflectionTexture.name, "studio_env");
  assert.equal(reflectionTexture.fileName, "env-px.tga");
  assert.equal(material.reflectionFactor, 0.75);
  assert.deepEqual(faceTextures.map((texture) => [texture.name, texture.property, texture.fileName]), [
    ["studio_px", "Maya|TEX_cube_studio_env_px", "env-px.tga"],
    ["studio_nx", "Maya|TEX_cube_studio_env_nx", "env-nx.tga"],
    ["studio_py", "Maya|TEX_cube_studio_env_py", "env-py.tga"],
    ["studio_ny", "Maya|TEX_cube_studio_env_ny", "env-ny.tga"],
    ["studio_pz", "Maya|TEX_cube_studio_env_pz", "env-pz.tga"],
    ["studio_nz", "Maya|TEX_cube_studio_env_nz", "env-nz.tga"]
  ]);
});

test("preserves CubeTexture faces stored under userData source data", () => {
  const scene = fromThreeObject(cubeTextureUserDataSourceScene());
  const material = normalizeFbxScene(scene).meshes[0].materials[0];
  const reflectionTexture = material.textures.find((texture) => texture.property === "ReflectionColor");
  const faceTextures = material.textures.filter((texture) => texture.property.startsWith("Maya|TEX_cube_userdata_env_"));

  assert.equal(reflectionTexture.name, "userdata_env");
  assert.equal(reflectionTexture.fileName, "env-px.tga");
  assert.equal(material.reflectionFactor, 0.5);
  assert.deepEqual(faceTextures.map((texture) => [texture.name, texture.property, texture.fileName]), [
    ["studio_px", "Maya|TEX_cube_userdata_env_px", "env-px.tga"],
    ["studio_nx", "Maya|TEX_cube_userdata_env_nx", "env-nx.tga"],
    ["studio_py", "Maya|TEX_cube_userdata_env_py", "env-py.tga"],
    ["studio_ny", "Maya|TEX_cube_userdata_env_ny", "env-ny.tga"],
    ["studio_pz", "Maya|TEX_cube_userdata_env_pz", "env-pz.tga"],
    ["studio_nz", "Maya|TEX_cube_userdata_env_nz", "env-nz.tga"]
  ]);
});

test("routes CubeTexture-owned animation through the primary reflection texture and face lanes", () => {
  const scene = normalizeFbxScene(fromThreeObject(cubeTextureScene({ animate: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations.map((clip) => clip.name), ["CubeTextureDrift"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["studio_env", "textureTranslation"],
    ["studio_px", "textureTranslation"],
    ["studio_nx", "textureTranslation"],
    ["studio_py", "textureTranslation"],
    ["studio_ny", "textureTranslation"],
    ["studio_pz", "textureTranslation"],
    ["studio_nz", "textureTranslation"]
  ]);
  assert.deepEqual(
    scene.animations[0].tracks.map((track) => rounded(track.keyframes[1].value)),
    Array.from({ length: 7 }, () => [0.2, 0.4, 0])
  );
});

test("routes CubeTexture face-owned animation only to that face lane", () => {
  const scene = normalizeFbxScene(fromThreeObject(cubeTextureScene({ faceAnimation: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations.map((clip) => clip.name), ["CubeFaceDrift"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["studio_ny", "textureTranslation"]
  ]);
  assert.deepEqual(rounded(scene.animations[0].tracks[0].keyframes[1].value), [0.35, 0.45, 0]);
});

test("routes userData source-owned CubeTexture animation through primary and face lanes", () => {
  const scene = normalizeFbxScene(fromThreeObject(cubeTextureUserDataSourceScene({ animate: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations.map((clip) => clip.name), ["UserDataCubeTextureDrift"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["userdata_env", "textureTranslation"],
    ["studio_px", "textureTranslation"],
    ["studio_nx", "textureTranslation"],
    ["studio_py", "textureTranslation"],
    ["studio_ny", "textureTranslation"],
    ["studio_pz", "textureTranslation"],
    ["studio_nz", "textureTranslation"]
  ]);
  assert.deepEqual(
    scene.animations[0].tracks.map((track) => rounded(track.keyframes[1].value)),
    Array.from({ length: 7 }, () => [0.18, 0.28, 0])
  );
});

test("routes userData source CubeTexture face-owned animation only to that face lane", () => {
  const scene = normalizeFbxScene(fromThreeObject(cubeTextureUserDataSourceScene({ faceAnimation: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations.map((clip) => clip.name), ["CubeFaceDrift"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["studio_pz", "textureTranslation"]
  ]);
  assert.deepEqual(rounded(scene.animations[0].tracks[0].keyframes[1].value), [0.35, 0.45, 0]);
});

test("preserves CubeTexture face transforms and material envMapRotation", () => {
  const scene = fromThreeObject(cubeTextureScene({
    envMapRotation: true,
    textureTransform: true
  }));
  const material = normalizeFbxScene(scene).meshes[0].materials[0];
  const reflectionTexture = material.textures.find((texture) => texture.property === "ReflectionColor");
  const faceTextures = material.textures.filter((texture) => texture.property.startsWith("Maya|TEX_cube_studio_env_"));

  assert.deepEqual(rounded(reflectionTexture.translation), [0.125, 0.25, 0]);
  assert.deepEqual(rounded(reflectionTexture.scale), [2, 3, 1]);
  assert.deepEqual(rounded(reflectionTexture.rotation), [0.1, 0.2, 0.3]);
  assert.deepEqual(faceTextures.map((texture) => [
    texture.name,
    rounded(texture.translation),
    rounded(texture.scale),
    rounded(texture.rotation),
    texture.uvSet
  ]), [
    ["studio_px", [0.125, 0.25, 0], [2, 3, 1], [0.1, 0.2, 0.3], "UVMap_1"],
    ["studio_nx", [0.125, 0.25, 0], [2, 3, 1], [0.1, 0.2, 0.3], "UVMap_1"],
    ["studio_py", [0.125, 0.25, 0], [2, 3, 1], [0.1, 0.2, 0.3], "UVMap_1"],
    ["studio_ny", [0.125, 0.25, 0], [2, 3, 1], [0.1, 0.2, 0.3], "UVMap_1"],
    ["studio_pz", [0.125, 0.25, 0], [2, 3, 1], [0.1, 0.2, 0.3], "UVMap_1"],
    ["studio_nz", [0.125, 0.25, 0], [2, 3, 1], [0.1, 0.2, 0.3], "UVMap_1"]
  ]);
});

test("writes Three.js CubeTexture face lanes into an FBXLoader-readable file", async () => {
  const bytes = exportFbx(cubeTextureScene());
  const text = decode(bytes);

  assert.match(text, /Maya\|TEX_cube_studio_env_px/);
  assert.match(text, /Maya\|TEX_cube_studio_env_nz/);
  assert.match(text, /env-px\.tga/);
  assert.match(text, /env-nz\.tga/);

  await withMockDocument(async () => {
    const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");
    const mesh = group.getObjectByName("CubeEnvQuad");

    assert.ok(mesh?.isMesh);
    assert.equal(mesh.material.name, "CubeEnvMaterial");
  });
});

test("embeds data URL CubeTexture faces instead of leaking data URLs as filenames", () => {
  const scene = fromThreeObject(cubeTextureScene({ embedded: true }));
  const material = normalizeFbxScene(scene).meshes[0].materials[0];
  const reflectionTexture = material.textures.find((texture) => texture.property === "ReflectionColor");
  const faceTextures = material.textures.filter((texture) => texture.property.startsWith("Maya|TEX_cube_studio_env_"));

  assert.equal(reflectionTexture.fileName, "studio_env.tga");
  assert.equal(reflectionTexture.mimeType, "image/x-tga");
  assert.deepEqual(Array.from(reflectionTexture.content), Array.from(checkerTga()));
  assert.deepEqual(faceTextures.map((texture) => [texture.name, texture.fileName, texture.mimeType, texture.content.length]), [
    ["studio_px", "studio_px.tga", "image/x-tga", checkerTga().length],
    ["studio_nx", "studio_nx.tga", "image/x-tga", checkerTga().length],
    ["studio_py", "studio_py.tga", "image/x-tga", checkerTga().length],
    ["studio_ny", "studio_ny.tga", "image/x-tga", checkerTga().length],
    ["studio_pz", "studio_pz.tga", "image/x-tga", checkerTga().length],
    ["studio_nz", "studio_nz.tga", "image/x-tga", checkerTga().length]
  ]);

  const text = decode(exportFbx(cubeTextureScene({ embedded: true })));
  assert.match(text, /studio_env\.tga/);
  assert.match(text, /studio_nz\.tga/);
  assert.match(text, /Content/);
  assert.doesNotMatch(text, /data:image/);
});

test("imports CubeTexture-preserving files in Blender", async (t) => {
  if (!hasBlender) {
    t.skip("Blender is not available outside the sandbox");
    return;
  }

  const fbxPath = join(tmpdir(), `fbx-exporter-cube-texture-${Date.now()}.fbx`);
  await writeFile(fbxPath, exportFbx(cubeTextureScene()));

  const script = `
import bpy
import json
import sys

bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
mesh = bpy.data.objects.get("CubeEnvQuad")
material = bpy.data.materials.get("CubeEnvMaterial")
print("BLENDER_CUBE_TEXTURE " + json.dumps({
    "material": material is not None,
    "mesh": mesh is not None,
    "meshMaterials": [slot.material.name for slot in mesh.material_slots if slot.material] if mesh else []
}, sort_keys=True))
`;
  const result = spawnSync(blenderPath, blenderTestArgs(script, fbxPath), {
    encoding: "utf8",
    timeout: 30000
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /BLENDER_CUBE_TEXTURE/);
  assert.match(result.stdout, /"mesh": true/);
  assert.match(result.stdout, /"material": true/);
  assert.match(result.stdout, /"meshMaterials": \["CubeEnvMaterial"\]/);
});
