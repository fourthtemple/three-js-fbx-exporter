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
  Texture,
  VectorKeyframeTrack
} from "three";
import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { FBX_KTIME } from "../src/fbx-values.js";
import { decode } from "./fbx-test-helpers.js";

function quadGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0,
    -1, 1, 0
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

function rounded(values) {
  return values.map((value) => Number(value.toFixed(4)));
}

function duplicateTextureScene({ withAnimationNames = false } = {}) {
  const leftTexture = {
    name: "shared_checker",
    fileName: "left.tga",
    alpha: 0.8
  };
  const rightTexture = {
    name: "shared_checker",
    fileName: "right.tga",
    alpha: 0.6
  };
  if (withAnimationNames) {
    leftTexture.animationName = "left_checker";
    rightTexture.animationName = "right_checker";
  }
  return {
    name: "DuplicateTextureScene",
    meshes: [
      {
        name: "LeftQuad",
        materials: [{ name: "LeftMat", diffuseTexture: leftTexture }],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0]
        }
      },
      {
        name: "RightQuad",
        materials: [{ name: "RightMat", diffuseTexture: rightTexture }],
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
        tracks: [
          {
            target: withAnimationNames ? "right_checker" : "shared_checker",
            property: "textureAlpha",
            keyframes: [
              { frame: 0, value: 0.6 },
              { frame: 30, value: 0.25 }
            ]
          }
        ]
      }
    ]
  };
}

function threeDuplicateTextureScene({ directAnimationNames = false, uuidDirectTargets = false } = {}) {
  const leftTexture = new Texture({ src: "left.tga" });
  leftTexture.name = "shared_checker";
  if (directAnimationNames) {
    leftTexture.animationName = "left_checker";
  } else {
    leftTexture.userData.animationName = "left_checker";
  }
  leftTexture.userData.alpha = 0.8;

  const rightTexture = new Texture({ src: "right.tga" });
  rightTexture.name = "shared_checker";
  if (directAnimationNames) {
    rightTexture.animationName = "right_checker";
  } else {
    rightTexture.userData.animationName = "right_checker";
  }
  rightTexture.userData.alpha = 0.6;

  const left = new Mesh(quadGeometry(), new MeshBasicMaterial({ name: "LeftMat", map: leftTexture }));
  left.name = "LeftQuad";
  const right = new Mesh(quadGeometry(), new MeshBasicMaterial({ name: "RightMat", map: rightTexture }));
  right.name = "RightQuad";

  const scene = new Scene();
  scene.name = "ThreeDuplicateTextureScene";
  scene.add(left, right);
  scene.animations = [
    new AnimationClip("TextureFade", 1, [
      new NumberKeyframeTrack(
        uuidDirectTargets ? `${leftTexture.uuid}.__texture.userData.alpha` : "LeftQuad.material.map.userData.alpha",
        [0, 1],
        [0.8, 0.2]
      ),
      uuidDirectTargets
        ? new VectorKeyframeTrack(`${rightTexture.uuid}.__texture.offset`, [0, 1], [0, 0, 0.4, 0.5])
        : new NumberKeyframeTrack("RightQuad.material.map.userData.alpha", [0, 1], [0.6, 0.25])
    ])
  ];
  return scene;
}

function threeOptionTextureRootScene() {
  const texture = new Texture({ src: "option-texture.tga" });
  texture.name = "option_texture";
  texture.userData.alpha = 0.85;

  const mesh = new Mesh(quadGeometry(), new MeshBasicMaterial({ name: "OptionTextureMat", map: texture }));
  mesh.name = "OptionTextureQuad";
  const scene = new Scene();
  scene.name = "ThreeOptionTextureRootScene";
  scene.add(mesh);
  const clip = new AnimationClip("OptionTextureLocal", 1, [
    new VectorKeyframeTrack("offset", [0, 1], [
      0, 0,
      0.25, 0.5
    ]),
    new NumberKeyframeTrack("userData.alpha", [0, 1], [0.85, 0.3])
  ]);
  return { scene, texture, clip };
}

function threeOptionTextureImageRootScene() {
  const image = { name: "OptionVideoImage", currentTime: 0 };
  const texture = new Texture(image);
  texture.name = "option_video_texture";
  texture.offset.set(0, 0);
  const mesh = new Mesh(quadGeometry(), new MeshBasicMaterial({ name: "OptionVideoTextureMat", map: texture }));
  mesh.name = "OptionVideoTextureQuad";
  const scene = new Scene();
  scene.name = "ThreeOptionTextureImageRootScene";
  scene.add(mesh);
  const clip = new AnimationClip("OptionTextureImageLocal", 1, [
    new NumberKeyframeTrack("currentTime", [0, 1], [0, 0.75]),
    new VectorKeyframeTrack("offset", [0, 1], [
      0, 0,
      0.125, 0.25
    ])
  ]);
  return { scene, image, clip };
}

function threeBareTextureTargetScene() {
  const image = { name: "BareVideoImage", currentTime: 0 };
  const texture = new Texture(image);
  texture.name = "bare_texture";
  texture.offset.set(0, 0);
  const mesh = new Mesh(quadGeometry(), new MeshBasicMaterial({ name: "BareTextureMat", map: texture }));
  mesh.name = "BareTextureQuad";
  const scene = new Scene();
  scene.name = "ThreeBareTextureTargetScene";
  scene.add(mesh);
  scene.animations = [
    new AnimationClip("BareTextureTarget", 1, [
      new VectorKeyframeTrack("bare_texture.offset", [0, 1], [
        0, 0,
        0.3, 0.45
      ]),
      new NumberKeyframeTrack("BareVideoImage.currentTime", [0, 1], [0, 0.6])
    ])
  ];
  return scene;
}

function threeSharedTextureAcrossSlotsScene() {
  const texture = new Texture({ src: "shared-mask.tga" });
  texture.name = "shared_mask";

  const material = new MeshBasicMaterial({
    name: "MaskedMaterial",
    map: texture,
    alphaMap: texture,
    transparent: true
  });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "MaskedQuad";
  mesh.animations = [
    new AnimationClip("SharedSlotDrift", 1, [
      new VectorKeyframeTrack("MaskedQuad.material.map.offset", [0, 1], [
        0, 0,
        0.1, 0.2
      ]),
      new VectorKeyframeTrack("MaskedQuad.material.alphaMap.offset", [0, 1], [
        0, 0,
        0.3, 0.4
      ])
    ])
  ];
  return mesh;
}

function threeOptionSharedTextureRootScene() {
  const texture = new Texture({ src: "shared-option-mask.tga" });
  texture.name = "shared_option_mask";

  const material = new MeshBasicMaterial({
    name: "OptionSharedMaskedMaterial",
    map: texture,
    alphaMap: texture,
    transparent: true
  });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "OptionSharedMaskedQuad";
  const clip = new AnimationClip("OptionSharedSlotDrift", 1, [
    new VectorKeyframeTrack("offset", [0, 1], [
      0, 0,
      0.2, 0.35
    ])
  ]);
  return { mesh, texture, clip };
}

test("rejects ambiguous texture animation target names", () => {
  assert.throws(() => exportFbx(duplicateTextureScene()), /Animation target is ambiguous: shared_checker/);
});

test("uses explicit texture animation names to disambiguate duplicate display names", () => {
  const scene = normalizeFbxScene(duplicateTextureScene({ withAnimationNames: true }));
  const textures = scene.meshes.flatMap((mesh) => mesh.materials.flatMap((material) => material.textures));
  const text = decode(exportFbx(scene));

  assert.deepEqual(textures.map((texture) => texture.name), ["shared_checker", "shared_checker"]);
  assert.deepEqual(textures.map((texture) => texture.animationName), ["left_checker", "right_checker"]);
  assert.equal(scene.animations[0].tracks[0].target, "right_checker");
  assert.match(text, /AnimationCurveNode/);
});

test("adapts Three.js texture animation names before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeDuplicateTextureScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const textures = scene.meshes.flatMap((mesh) => mesh.materials.flatMap((material) => material.textures));
  const tracks = scene.animations[0].tracks;

  assert.deepEqual(textures.map((texture) => texture.name), ["shared_checker", "shared_checker"]);
  assert.deepEqual(textures.map((texture) => texture.animationName), ["left_checker", "right_checker"]);
  assert.deepEqual(tracks.map((track) => track.target), ["left_checker", "right_checker"]);
  assert.deepEqual(rounded(tracks.map((track) => track.keyframes[1].value)), [0.2, 0.25]);
});

test("adapts direct Three.js texture animation names before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeDuplicateTextureScene({ directAnimationNames: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const textures = scene.meshes.flatMap((mesh) => mesh.materials.flatMap((material) => material.textures));
  const tracks = scene.animations[0].tracks;

  assert.deepEqual(textures.map((texture) => texture.animationName), ["left_checker", "right_checker"]);
  assert.deepEqual(tracks.map((track) => track.target), ["left_checker", "right_checker"]);
});

test("adapts Three.js texture UUID aliases for direct texture animation tracks", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeDuplicateTextureScene({ uuidDirectTargets: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const tracks = scene.animations[0].tracks;

  assert.deepEqual(tracks.map((track) => [track.target, track.property]), [
    ["left_checker", "textureAlpha"],
    ["right_checker", "textureTranslation"]
  ]);
  assert.ok(Math.abs(tracks[0].keyframes[1].value - 0.2) < 1e-6);
  assert.deepEqual(rounded(tracks[1].keyframes[1].value), [0.4, 0.5, 0]);
});

test("adapts bare Three.js texture and media target aliases without explicit texture marker", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeBareTextureTargetScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const tracks = scene.animations[0].tracks;

  assert.deepEqual(tracks.map((track) => [track.target, track.property]), [
    ["bare_texture", "textureTranslation"],
    ["bare_texture", "videoCurrentTime"]
  ]);
  assert.deepEqual(rounded(tracks[0].keyframes[1].value), [0.3, 0.45, 0]);
  assert.equal(tracks[1].keyframes[1].value, Math.round(Math.fround(0.6) * FBX_KTIME));
});

test("adapts option-provided clips rooted at Three.js texture objects", () => {
  const { scene: source, texture, clip } = threeOptionTextureRootScene();
  const scene = normalizeFbxScene(fromThreeObject(source, {
    animations: [{ clip, rootObject: texture }],
    bakeAnimations: false,
    frameRate: 30
  }));
  const tracks = scene.animations[0].tracks;

  assert.deepEqual(tracks.map((track) => [track.target, track.property]), [
    ["option_texture", "textureTranslation"],
    ["option_texture", "textureAlpha"]
  ]);
  assert.deepEqual(rounded(tracks[0].keyframes[1].value), [0.25, 0.5, 0]);
  assert.ok(Math.abs(tracks[1].keyframes[1].value - 0.3) < 1e-6);
});

test("adapts option-provided clips rooted at Three.js texture image/media objects", () => {
  const { scene: source, image, clip } = threeOptionTextureImageRootScene();
  const scene = normalizeFbxScene(fromThreeObject(source, {
    animations: [{ clip, rootObject: image }],
    bakeAnimations: false,
    frameRate: 30
  }));
  const tracks = scene.animations[0].tracks;

  assert.deepEqual(tracks.map((track) => [track.target, track.property]), [
    ["option_video_texture", "videoCurrentTime"],
    ["option_video_texture", "textureTranslation"]
  ]);
  assert.equal(tracks[0].keyframes[1].value, Math.round(0.75 * FBX_KTIME));
  assert.deepEqual(rounded(tracks[1].keyframes[1].value), [0.125, 0.25, 0]);
});

test("disambiguates shared Three.js textures used by multiple material slots", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeSharedTextureAcrossSlotsScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const material = scene.meshes[0].materials[0];
  const alphaTexture = material.textures.find((texture) => texture.property === "TransparencyFactor");
  const tracks = scene.animations[0].tracks;
  const text = decode(exportFbx(threeSharedTextureAcrossSlotsScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.equal(material.diffuseTexture.name, "shared_mask");
  assert.equal(alphaTexture.name, "shared_mask");
  assert.notEqual(material.diffuseTexture.animationName, alphaTexture.animationName);
  assert.deepEqual(tracks.map((track) => track.target), [
    material.diffuseTexture.animationName,
    alphaTexture.animationName
  ]);
  assert.deepEqual(tracks.map((track) => track.keyframes[1].value.map((value) => Number(value.toFixed(4)))), [
    [0.1, 0.2, 0],
    [0.3, 0.4, 0]
  ]);
  assert.match(text, /SharedSlotDrift/);
});

test("fans out option-provided clips rooted at shared Three.js textures into one take", () => {
  const { mesh: source, texture, clip } = threeOptionSharedTextureRootScene();
  const scene = normalizeFbxScene(fromThreeObject(source, {
    animations: [{ clip, rootObject: texture }],
    bakeAnimations: false,
    frameRate: 30
  }));
  const material = scene.meshes[0].materials[0];
  const alphaTexture = material.textures.find((item) => item.property === "TransparencyFactor");
  const animation = scene.animations[0];

  assert.equal(scene.animations.length, 1);
  assert.equal(animation.name, "OptionSharedSlotDrift");
  assert.notEqual(material.diffuseTexture.animationName, alphaTexture.animationName);
  assert.deepEqual(animation.tracks.map((track) => [track.target, track.property]), [
    [material.diffuseTexture.animationName, "textureTranslation"],
    [alphaTexture.animationName, "textureTranslation"]
  ]);
  assert.deepEqual(animation.tracks.map((track) => rounded(track.keyframes[1].value)), [
    [0.2, 0.35, 0],
    [0.2, 0.35, 0]
  ]);
});
