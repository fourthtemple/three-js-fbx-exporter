import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AnimationClip,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  NumberKeyframeTrack,
  Object3D,
  Texture,
  VectorKeyframeTrack
} from "three";
import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { decode } from "./fbx-test-helpers.js";

function assertVectorClose(actual, expected, epsilon = 1e-6) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => {
    assert.ok(Math.abs(value - expected[index]) <= epsilon, `${value} not close to ${expected[index]}`);
  });
}

function quadGeometry() {
  return {
    vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
    faces: [[0, 1, 2, 3]],
    uvs: [0, 0, 1, 0, 1, 1, 0, 1],
    materialIndices: [0]
  };
}

function atlasScene({ animated = false, texture = {}, tracks = null } = {}) {
  return {
    name: "TextureAtlasScene",
    meshes: [
      {
        name: "Quad",
        materials: [
          {
            name: "Mat",
            diffuseTexture: {
              name: "atlas",
              path: "atlas.tga",
              atlasColumns: 4,
              atlasRows: 2,
              atlasFrame: 5,
              ...texture
            }
          }
        ],
        geometry: quadGeometry()
      }
    ],
    animations: animated ? [
      {
        name: "AtlasFlip",
        frameRate: 30,
        tracks: tracks || [
          {
            target: "atlas",
            property: "atlasFrame",
            keyframes: [
              { frame: 0, value: 0 },
              { frame: 30, value: 5 }
            ]
          }
        ]
      }
    ] : []
  };
}

function textureRecord(scene) {
  return scene.meshes[0].materials[0].textures[0];
}

function animationTrack(scene, property) {
  return scene.animations[0].tracks.find((track) => track.property === property);
}

function threeAtlasScene({ textureSource = null, textureUserData = {}, tracks = null } = {}) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0
  ], 3));
  geometry.setAttribute("uv", new Float32BufferAttribute([
    0, 0,
    1, 0,
    1, 1
  ], 2));
  geometry.setIndex([0, 1, 2]);

  const texture = new Texture({ src: "atlas.tga" });
  texture.name = "atlas";
  texture.userData = {
    atlasColumns: 4,
    atlasRows: 2,
    atlasFrame: 5,
    ...textureUserData
  };
  if (textureSource) {
    Object.assign(texture.source, textureSource);
  }
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ name: "Mat", map: texture }));
  mesh.name = "Quad";
  const root = new Object3D();
  root.name = "ThreeTextureAtlasScene";
  root.add(mesh);
  root.animations = [
    new AnimationClip("AtlasFlip", 1, tracks || [
      new NumberKeyframeTrack("Quad.material.map.userData.atlasFrame", [0, 1], [0, 5])
    ])
  ];
  return root;
}

test("normalizes static texture atlas frames into texture offset and repeat", () => {
  const scene = normalizeFbxScene(atlasScene());
  const texture = textureRecord(scene);

  assert.equal(texture.atlasColumns, 4);
  assert.equal(texture.atlasRows, 2);
  assert.equal(texture.atlasFrameCount, 8);
  assert.equal(texture.atlasFrame, 5);
  assert.equal(texture.atlasColumn, 1);
  assert.equal(texture.atlasRow, 1);
  assert.equal(texture.atlasOrigin, "top-left");
  assertVectorClose(texture.translation, [0.25, 0, 0]);
  assertVectorClose(texture.scale, [0.25, 0.5, 1]);
  assert.match(decode(exportFbx(scene)), /Maya\|atlas_columns/);
});

test("normalizes static texture atlas rows and columns into texture offset", () => {
  const scene = normalizeFbxScene(atlasScene({
    texture: {
      atlasFrame: undefined,
      atlasColumn: 3,
      atlasRow: 0
    }
  }));
  const texture = textureRecord(scene);

  assert.equal(texture.atlasFrame, 3);
  assert.equal(texture.atlasColumn, 3);
  assert.equal(texture.atlasRow, 0);
  assertVectorClose(texture.translation, [0.75, 0.5, 0]);
  assertVectorClose(texture.scale, [0.25, 0.5, 1]);
  assert.match(decode(exportFbx(scene)), /Maya\|atlas_column/);
});

test("normalizes static texture atlas tile pairs into texture offset", () => {
  const scene = normalizeFbxScene(atlasScene({
    texture: {
      atlasFrame: undefined,
      atlasTile: [2, 1]
    }
  }));
  const texture = textureRecord(scene);

  assert.equal(texture.atlasFrame, 6);
  assert.equal(texture.atlasColumn, 2);
  assert.equal(texture.atlasRow, 1);
  assertVectorClose(texture.translation, [0.5, 0, 0]);
  assertVectorClose(texture.scale, [0.25, 0.5, 1]);
});

test("normalizes source-owned texture atlas metadata into texture offset", () => {
  const scene = normalizeFbxScene(atlasScene({
    texture: {
      atlasColumns: undefined,
      atlasRows: undefined,
      atlasFrame: undefined,
      source: {
        atlasColumns: 4,
        atlasRows: 2,
        atlasTile: [2, 1]
      }
    }
  }));
  const texture = textureRecord(scene);

  assert.equal(texture.atlasColumns, 4);
  assert.equal(texture.atlasRows, 2);
  assert.equal(texture.atlasFrame, 6);
  assert.equal(texture.atlasColumn, 2);
  assert.equal(texture.atlasRow, 1);
  assertVectorClose(texture.translation, [0.5, 0, 0]);
  assertVectorClose(texture.scale, [0.25, 0.5, 1]);
});

test("adapts Three.js static texture atlas tile pairs before FBX export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAtlasScene({
    textureUserData: {
      atlasFrame: undefined,
      atlasCell: { column: 3, row: 0 }
    }
  })));
  const texture = textureRecord(scene);

  assert.equal(texture.atlasFrame, 3);
  assert.equal(texture.atlasColumn, 3);
  assert.equal(texture.atlasRow, 0);
  assertVectorClose(texture.translation, [0.75, 0.5, 0]);
  assertVectorClose(texture.scale, [0.25, 0.5, 1]);
  assert.match(decode(exportFbx(scene)), /Maya\|atlas_frame/);
});

test("adapts Three.js source-owned static texture atlas metadata before FBX export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAtlasScene({
    textureUserData: {
      atlasColumns: undefined,
      atlasRows: undefined,
      atlasFrame: undefined
    },
    textureSource: {
      atlasColumns: 4,
      atlasRows: 2,
      atlasCell: { column: 2, row: 1 }
    },
    tracks: []
  })));
  const texture = textureRecord(scene);

  assert.equal(texture.atlasFrame, 6);
  assert.equal(texture.atlasColumn, 2);
  assert.equal(texture.atlasRow, 1);
  assertVectorClose(texture.translation, [0.5, 0, 0]);
  assertVectorClose(texture.scale, [0.25, 0.5, 1]);
  assert.match(decode(exportFbx(scene)), /Maya\|atlas_frame/);
});

test("expands internal texture atlas frame animation into transform curves", () => {
  const scene = normalizeFbxScene(atlasScene({ animated: true }));
  const translationTrack = animationTrack(scene, "textureTranslation");
  const scaleTrack = animationTrack(scene, "textureScale");

  assert.ok(translationTrack);
  assert.ok(scaleTrack);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), ["textureTranslation", "textureScale"]);
  assertVectorClose(translationTrack.keyframes[0].value, [0, 0.5, 0]);
  assertVectorClose(translationTrack.keyframes[1].value, [0.25, 0, 0]);
  assertVectorClose(scaleTrack.keyframes[0].value, [0.25, 0.5, 1]);
  assertVectorClose(scaleTrack.keyframes[1].value, [0.25, 0.5, 1]);
});

test("expands internal texture atlas tile animation into transform curves", () => {
  const scene = normalizeFbxScene(atlasScene({
    animated: true,
    tracks: [
      {
        target: "atlas",
        property: "atlasTile",
        keyframes: [
          { frame: 0, value: [0, 0] },
          { frame: 30, value: [3, 1] }
        ]
      }
    ]
  }));
  const translationTrack = animationTrack(scene, "textureTranslation");
  const scaleTrack = animationTrack(scene, "textureScale");

  assert.ok(translationTrack);
  assert.ok(scaleTrack);
  assertVectorClose(translationTrack.keyframes[0].value, [0, 0.5, 0]);
  assertVectorClose(translationTrack.keyframes[1].value, [0.75, 0, 0]);
  assertVectorClose(scaleTrack.keyframes[0].value, [0.25, 0.5, 1]);
  assertVectorClose(scaleTrack.keyframes[1].value, [0.25, 0.5, 1]);
});

test("expands object-valued texture atlas frame and tile aliases", () => {
  const frameScene = normalizeFbxScene(atlasScene({
    animated: true,
    tracks: [
      {
        target: "atlas",
        property: "atlasFrame",
        keyframes: [
          { frame: 0, value: { textureAtlasFrame: 0 } },
          { frame: 30, value: { frameIndex: 5 } },
          { frame: 60, value: { value: { atlasFrame: 7 } } }
        ]
      }
    ]
  }));
  const tileScene = normalizeFbxScene(atlasScene({
    animated: true,
    tracks: [
      {
        target: "atlas",
        property: "atlasTile",
        keyframes: [
          { frame: 0, value: { textureAtlasTile: [0, 0] } },
          { frame: 30, value: { atlasCell: { textureAtlasColumn: 3, textureAtlasRow: 1 } } },
          { frame: 60, value: { defaultValue: { atlasCell: { x: 2, y: 0 } } } }
        ]
      }
    ]
  }));

  assertVectorClose(animationTrack(frameScene, "textureTranslation").keyframes[0].value, [0, 0.5, 0]);
  assertVectorClose(animationTrack(frameScene, "textureTranslation").keyframes[1].value, [0.25, 0, 0]);
  assertVectorClose(animationTrack(frameScene, "textureTranslation").keyframes[2].value, [0.75, 0, 0]);
  assertVectorClose(animationTrack(tileScene, "textureTranslation").keyframes[0].value, [0, 0.5, 0]);
  assertVectorClose(animationTrack(tileScene, "textureTranslation").keyframes[1].value, [0.75, 0, 0]);
  assertVectorClose(animationTrack(tileScene, "textureTranslation").keyframes[2].value, [0.5, 0.5, 0]);
});

test("expands internal texture atlas column and row animation into component curves", () => {
  const scene = normalizeFbxScene(atlasScene({
    animated: true,
    tracks: [
      {
        target: "atlas",
        property: "atlasColumn",
        keyframes: [
          { frame: 0, value: 1 },
          { frame: 30, value: 3 }
        ]
      },
      {
        target: "atlas",
        property: "atlasRow",
        keyframes: [
          { frame: 0, value: 1 },
          { frame: 30, value: 0 }
        ]
      }
    ]
  }));
  const columnTrack = animationTrack(scene, "textureTranslationX");
  const rowTrack = animationTrack(scene, "textureTranslationY");
  const scaleTrack = animationTrack(scene, "textureScale");

  assert.ok(columnTrack);
  assert.ok(rowTrack);
  assert.equal(scaleTrack, undefined);
  assert.deepEqual(columnTrack.keyframes.map((keyframe) => keyframe.value), [0.25, 0.75]);
  assert.deepEqual(rowTrack.keyframes.map((keyframe) => keyframe.value), [0, 0.5]);
});

test("expands object-valued texture atlas column and row aliases", () => {
  const scene = normalizeFbxScene(atlasScene({
    animated: true,
    tracks: [
      {
        target: "atlas",
        property: "atlasColumn",
        keyframes: [
          { frame: 0, value: { textureAtlasColumn: 1 } },
          { frame: 30, value: { column: 3 } },
          { frame: 60, value: { value: { col: 2 } } }
        ]
      },
      {
        target: "atlas",
        property: "atlasRow",
        keyframes: [
          { frame: 0, value: { textureAtlasRow: 1 } },
          { frame: 30, value: { row: 0 } },
          { frame: 60, value: { defaultValue: { tileY: 0 } } }
        ]
      }
    ]
  }));

  assert.deepEqual(animationTrack(scene, "textureTranslationX").keyframes.map((keyframe) => keyframe.value), [0.25, 0.75, 0.5]);
  assert.deepEqual(animationTrack(scene, "textureTranslationY").keyframes.map((keyframe) => keyframe.value), [0, 0.5, 0.5]);
});

test("expands track-local texture atlas column animation with scale fallback", () => {
  const scene = normalizeFbxScene(atlasScene({
    animated: true,
    texture: {
      atlasColumns: undefined,
      atlasRows: undefined,
      atlasFrame: undefined
    },
    tracks: [
      {
        target: "atlas",
        property: "atlasColumn",
        atlasColumns: 4,
        atlasRows: 2,
        keyframes: [
          { frame: 0, value: 0 },
          { frame: 30, value: 2 }
        ]
      }
    ]
  }));
  const columnTrack = animationTrack(scene, "textureTranslationX");
  const scaleTrack = animationTrack(scene, "textureScale");

  assert.ok(columnTrack);
  assert.ok(scaleTrack);
  assert.deepEqual(columnTrack.keyframes.map((keyframe) => keyframe.value), [0, 0.5]);
  assertVectorClose(scaleTrack.keyframes[0].value, [0.25, 0.5, 1]);
  assertVectorClose(scaleTrack.keyframes[1].value, [0.25, 0.5, 1]);
});

test("adapts Three.js texture atlas frame tracks before FBX export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAtlasScene(), {
    frameRate: 30,
    bakeAnimations: false
  }));
  const texture = textureRecord(scene);
  const translationTrack = animationTrack(scene, "textureTranslation");

  assert.equal(texture.name, "atlas");
  assertVectorClose(texture.translation, [0.25, 0, 0]);
  assert.ok(translationTrack);
  assertVectorClose(translationTrack.keyframes[0].value, [0, 0.5, 0]);
  assertVectorClose(translationTrack.keyframes[1].value, [0.25, 0, 0]);
  assert.match(decode(exportFbx(scene)), /AtlasFlip/);
});

test("adapts Three.js texture atlas column and row tracks before FBX export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAtlasScene({
    tracks: [
      new NumberKeyframeTrack("Quad.material.map.userData.atlasColumn", [0, 1], [1, 3]),
      new NumberKeyframeTrack("Quad.material.map.userData.atlasRow", [0, 1], [1, 0])
    ]
  }), {
    frameRate: 30,
    bakeAnimations: false
  }));
  const columnTrack = animationTrack(scene, "textureTranslationX");
  const rowTrack = animationTrack(scene, "textureTranslationY");
  const scaleTrack = animationTrack(scene, "textureScale");

  assert.ok(columnTrack);
  assert.ok(rowTrack);
  assert.equal(scaleTrack, undefined);
  assert.deepEqual(columnTrack.keyframes.map((keyframe) => keyframe.value), [0.25, 0.75]);
  assert.deepEqual(rowTrack.keyframes.map((keyframe) => keyframe.value), [0, 0.5]);
  assert.match(decode(exportFbx(scene)), /AtlasFlip/);
});

test("adapts Three.js texture atlas tile vector tracks before FBX export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAtlasScene({
    tracks: [
      new VectorKeyframeTrack("Quad.material.map.userData.atlasTile", [0, 1], [
        0, 0,
        3, 1
      ])
    ]
  }), {
    frameRate: 30,
    bakeAnimations: false
  }));
  const translationTrack = animationTrack(scene, "textureTranslation");
  const scaleTrack = animationTrack(scene, "textureScale");

  assert.ok(translationTrack);
  assert.ok(scaleTrack);
  assertVectorClose(translationTrack.keyframes[0].value, [0, 0.5, 0]);
  assertVectorClose(translationTrack.keyframes[1].value, [0.75, 0, 0]);
  assertVectorClose(scaleTrack.keyframes[0].value, [0.25, 0.5, 1]);
  assertVectorClose(scaleTrack.keyframes[1].value, [0.25, 0.5, 1]);
  assert.match(decode(exportFbx(scene)), /AtlasFlip/);
});

test("adapts Three.js source-owned texture atlas tile vector tracks before FBX export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAtlasScene({
    textureUserData: {
      atlasColumns: undefined,
      atlasRows: undefined,
      atlasFrame: undefined
    },
    textureSource: {
      atlasColumns: 4,
      atlasRows: 2,
      atlasFrame: 5
    },
    tracks: [
      new VectorKeyframeTrack("Quad.material.map.source.atlasTile", [0, 1], [
        0, 0,
        3, 1
      ])
    ]
  }), {
    frameRate: 30,
    bakeAnimations: false
  }));
  const translationTrack = animationTrack(scene, "textureTranslation");
  const scaleTrack = animationTrack(scene, "textureScale");

  assert.ok(translationTrack);
  assert.ok(scaleTrack);
  assertVectorClose(translationTrack.keyframes[0].value, [0, 0.5, 0]);
  assertVectorClose(translationTrack.keyframes[1].value, [0.75, 0, 0]);
  assertVectorClose(scaleTrack.keyframes[0].value, [0.25, 0.5, 1]);
  assertVectorClose(scaleTrack.keyframes[1].value, [0.25, 0.5, 1]);
  assert.match(decode(exportFbx(scene)), /AtlasFlip/);
});
