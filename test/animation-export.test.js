import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  AnimationClip,
  BufferGeometry,
  Euler,
  Float32BufferAttribute,
  InterpolateDiscrete,
  InterpolateSmooth,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NumberKeyframeTrack,
  Object3D,
  Quaternion,
  QuaternionKeyframeTrack,
  Scene,
  Texture,
  Vector3,
  VectorKeyframeTrack
} from "three";
import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { arrayBufferFrom, blenderPath, blenderTestArgs, decode, hasBlender, withMockDocument } from "./fbx-test-helpers.js";

function multiClipScene() {
  return {
    name: "MultiClipScene",
    meshes: [
      {
        name: "Cube",
        materials: [{ name: "Mat" }],
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
        name: "MoveX",
        frameRate: 30,
        startFrame: 0,
        endFrame: 30,
        tracks: [
          {
            target: "Cube",
            property: "translation",
            keyframes: [
              { frame: 0, value: [0, 0, 0] },
              { frame: 30, value: [1, 0, 0] }
            ]
          }
        ]
      },
      {
        name: "ScaleUp",
        frameRate: 30,
        startFrame: 0,
        endFrame: 30,
        tracks: [
          {
            target: "Cube",
            property: "scale",
            keyframes: [
              { frame: 0, value: [1, 1, 1] },
              { frame: 30, value: [2, 2, 2] }
            ]
          }
        ]
      }
    ]
  };
}

function singleKeyTransformScene() {
  const scene = multiClipScene();
  scene.name = "SingleKeyTransformScene";
  scene.animations = [
    {
      name: "PoseHold",
      frameRate: 30,
      startFrame: 12,
      endFrame: 12,
      tracks: [
        {
          target: "Cube",
          property: "translation",
          keyframes: [
            { frame: 12, value: [3, 4, 5] }
          ]
        }
      ]
    }
  ];
  return scene;
}

function singleKeyTextureScene() {
  const scene = singleKeyTransformScene();
  scene.name = "SingleKeyTextureScene";
  scene.meshes[0].materials[0].diffuseTexture = {
    name: "Checker",
    fileName: "checker.tga",
    relativeFileName: "checker.tga"
  };
  scene.animations[0].tracks = [
    {
      target: "Checker",
      property: "textureAlpha",
      keyframes: [
        { frame: 12, value: 0.42 }
      ]
    }
  ];
  return scene;
}

function modelTransformMetadataAnimationScene() {
  return {
    name: "ModelTransformMetadataScene",
    nodes: [
      {
        name: "PivotCtrl",
        rotationPivot: [1, 2, 3],
        geometricScaling: [1, 1, 1]
      }
    ],
    animations: [
      {
        name: "PivotMetadata",
        frameRate: 30,
        startFrame: 0,
        endFrame: 30,
        tracks: [
          {
            target: "PivotCtrl",
            property: "rotationPivot",
            keyframes: [
              { frame: 0, value: [1, 2, 3] },
              { frame: 30, value: [4, 5, 6] }
            ]
          },
          {
            target: "PivotCtrl",
            property: "geometricScaleZ",
            keyframes: [
              { frame: 0, value: 1 },
              { frame: 30, value: 0.5 }
            ]
          }
        ]
      }
    ]
  };
}

function threeMultiClipScene() {
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

  const mesh = new Mesh(geometry, new MeshBasicMaterial({ name: "Mat" }));
  mesh.name = "Cube";

  const root = new Object3D();
  root.name = "ThreeMultiClipScene";
  root.add(mesh);
  root.animations = [
    new AnimationClip("MoveX", 1, [
      new VectorKeyframeTrack("Cube.position", [0, 1], [0, 0, 0, 1, 0, 0])
    ]),
    new AnimationClip("ScaleUp", 1, [
      new VectorKeyframeTrack("Cube.scale", [0, 1], [1, 1, 1, 2, 2, 2])
    ]),
    new AnimationClip("IgnoredUnsupported", 1, [
      new NumberKeyframeTrack("Cube.material.userData.unsupportedFlag", [0, 1], [0, 1])
    ])
  ];
  return root;
}

function duplicateUuidTargetScene() {
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

  const first = new Mesh(geometry, new MeshBasicMaterial({ name: "SharedMaterial" }));
  first.name = "Twin";

  const texture = new Texture();
  texture.name = "second_map";
  const secondMaterial = new MeshBasicMaterial({
    name: "SharedMaterial",
    map: texture,
    transparent: true,
    opacity: 1
  });
  secondMaterial.userData.animationName = "second_material";
  const second = new Mesh(geometry.clone(), secondMaterial);
  second.name = "Twin";

  const root = new Object3D();
  root.name = "DuplicateUuidTargetScene";
  root.add(first, second);
  root.animations = [
    new AnimationClip("UuidTargets", 1, [
      new VectorKeyframeTrack(`${second.uuid}.position`, [0, 1], [0, 0, 0, 2, 0, 0]),
      new NumberKeyframeTrack(`${second.uuid}.material.opacity`, [0, 1], [1, 0.5]),
      new VectorKeyframeTrack(`${second.uuid}.material.map.offset`, [0, 1], [0, 0, 0.25, 0.5])
    ])
  ];
  return root;
}

function rootRelativeTrackScene() {
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

  const texture = new Texture();
  texture.name = "root_map";
  const material = new MeshBasicMaterial({
    name: "RootMaterial",
    map: texture,
    transparent: true,
    opacity: 1
  });

  const mesh = new Mesh(geometry, material);
  mesh.name = "RootQuad";
  mesh.animations = [
    new AnimationClip("RootRelativeTracks", 1, [
      new VectorKeyframeTrack(".position", [0, 1], [0, 0, 0, 1, 2, 3]),
      new NumberKeyframeTrack(".material.opacity", [0, 1], [1, 0.25]),
      new VectorKeyframeTrack(".material.map.offset", [0, 1], [0, 0, 0.4, 0.6])
    ])
  ];
  return mesh;
}

function bareRootLocalTrackScene() {
  const scene = rootRelativeTrackScene();
  scene.animations = [
    new AnimationClip("BareRootLocalTracks", 1, [
      new VectorKeyframeTrack("position", [0, 1], [0, 0, 0, 2, 3, 4]),
      new NumberKeyframeTrack("material.opacity", [0, 1], [1, 0.5]),
      new VectorKeyframeTrack("material.map.offset", [0, 1], [0, 0, 0.2, 0.7])
    ])
  ];
  return scene;
}

function childOwnedAnimationScene() {
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

  const scene = new Scene();
  scene.name = "ChildOwnedAnimationScene";

  const leftTexture = new Texture();
  leftTexture.name = "left_map";
  const left = new Mesh(geometry, new MeshBasicMaterial({
    name: "LeftMaterial",
    map: leftTexture
  }));
  left.name = "LeftQuad";
  left.animations = [
    new AnimationClip("LeftLocalMove", 1, [
      new VectorKeyframeTrack(".position", [0, 1], [0, 0, 0, 1, 0, 0]),
      new VectorKeyframeTrack(".material.map.offset", [0, 1], [0, 0, 0.2, 0.3])
    ])
  ];

  const right = new Mesh(geometry.clone(), new MeshBasicMaterial({ name: "RightMaterial" }));
  right.name = "RightQuad";
  right.animations = [
    new AnimationClip("RightLocalMove", 1, [
      new VectorKeyframeTrack(".position", [0, 1], [0, 0, 0, -1, 0, 0])
    ])
  ];

  scene.add(left, right);
  return scene;
}

function childUserDataOwnedAnimationScene() {
  const scene = childOwnedAnimationScene();
  const left = scene.getObjectByName("LeftQuad");
  const right = scene.getObjectByName("RightQuad");
  left.animations = [];
  right.animations = [];
  left.userData.animations = [
    new AnimationClip("LeftUserDataLocalMove", 1, [
      new VectorKeyframeTrack("position", [0, 1], [0, 0, 0, 0, 2, 0]),
      new VectorKeyframeTrack("material.map.offset", [0, 1], [0, 0, 0.35, 0.45])
    ])
  ];
  right.userData.animations = [
    new AnimationClip("RightUserDataLocalMove", 1, [
      new VectorKeyframeTrack(".position", [0, 1], [0, 0, 0, 0, -2, 0])
    ])
  ];
  return scene;
}

function dottedObjectNameAnimationScene() {
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

  const texture = new Texture();
  texture.name = "cat_body_map";
  const material = new MeshBasicMaterial({
    name: "CatBodyMaterial",
    map: texture,
    transparent: true,
    opacity: 1
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "Cat.Body";

  const root = new Object3D();
  root.name = "DottedObjectNameAnimationScene";
  root.add(mesh);
  root.animations = [
    new AnimationClip("DottedTargets", 1, [
      new VectorKeyframeTrack("Cat.Body.position", [0, 1], [0, 0, 0, 2, 1, 0]),
      new NumberKeyframeTrack("Cat.Body.material.opacity", [0, 1], [1, 0.35]),
      new VectorKeyframeTrack("Cat.Body.material.map.offset", [0, 1], [0, 0, 0.15, 0.45])
    ])
  ];
  return root;
}

function animatedQuadScene(name, track) {
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

  const mesh = new Mesh(geometry, new MeshBasicMaterial({ name: "Mat" }));
  mesh.name = "Cube";

  const root = new Object3D();
  root.name = name;
  root.add(mesh);
  root.animations = [new AnimationClip(name, track.times[track.times.length - 1] || 0, [track])];
  return root;
}

function smoothThreeAnimationScene() {
  const track = new VectorKeyframeTrack("Cube.position", [0, 1, 2], [
    0, 0, 0,
    1, 1, 1,
    2, 0, 0
  ]);
  track.setInterpolation(InterpolateSmooth);

  return animatedQuadScene("SmoothMove", track);
}

function clipBakeFrameRateScene() {
  const scene = smoothThreeAnimationScene();
  scene.name = "ClipBakeFrameRate";
  scene.animations[0].userData = { bakeFrameRate: 12 };
  return scene;
}

function trackBakeFrameRateScene() {
  const scene = clipBakeFrameRateScene();
  scene.name = "TrackBakeFrameRate";
  scene.animations[0].tracks[0].userData = { bakeFrameRate: 6 };
  return scene;
}

function sourceTrimScene() {
  const scene = animatedQuadScene("SourceTrim", new VectorKeyframeTrack("Cube.position", [0, 1, 2], [
    0, 0, 0,
    10, 0, 0,
    20, 0, 0
  ]));
  scene.animations[0].userData = {
    sourceStartTime: 0.5,
    sourceEndTime: 1.5,
    bakeFrameRate: 2
  };
  return scene;
}

function discreteThreeAnimationScene() {
  const track = new VectorKeyframeTrack("Cube.position", [0, 1], [
    0, 0, 0,
    4, 0, 0
  ]);
  track.setInterpolation(InterpolateDiscrete);

  return animatedQuadScene("DiscreteMove", track);
}

function componentThreeAnimationScene() {
  const scene = animatedQuadScene("ComponentMove", new NumberKeyframeTrack("Cube.position[x]", [0, 1], [0, 3]));
  scene.animations = [
    new AnimationClip("ComponentMove", 1, [
      new NumberKeyframeTrack("Cube.position[x]", [0, 1], [0, 3]),
      new NumberKeyframeTrack("Cube.rotation[y]", [0, 1], [0, Math.PI / 2]),
      new NumberKeyframeTrack("Cube.scale[2]", [0, 1], [1, 2])
    ])
  ];
  return scene;
}

function matrixElements({ translation = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  return new Matrix4().compose(
    new Vector3(...translation),
    new Quaternion().setFromEuler(new Euler(...rotation)),
    new Vector3(...scale)
  ).toArray();
}

function matrixThreeAnimationScene() {
  const scene = animatedQuadScene("MatrixMove", new VectorKeyframeTrack("Cube.matrix.elements", [0, 1], [
    ...matrixElements(),
    ...matrixElements({
      translation: [2, 3, 4],
      rotation: [0, 0, Math.PI / 2],
      scale: [2, 3, 4]
    })
  ]));
  return scene;
}

function modelMetadataThreeAnimationScene() {
  const scene = animatedQuadScene("ModelMetadataMove", new VectorKeyframeTrack("Cube.position", [0], [0, 0, 0]));
  const mesh = scene.getObjectByName("Cube");
  mesh.userData.rotationPivot = [0.1, 0.2, 0.3];
  mesh.userData.geometricScaling = [1, 1, 1];
  scene.animations = [
    new AnimationClip("ModelMetadataMove", 1, [
      new VectorKeyframeTrack("Cube.userData.rotationPivot", [0, 1], [
        0.1, 0.2, 0.3,
        1, 2, 3
      ]),
      new NumberKeyframeTrack("Cube.userData.geometricScale[z]", [0, 1], [1, 0.5])
    ])
  ];
  return scene;
}

function assertClose(actual, expected, epsilon = 1e-5) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} not close to ${expected}`);
}

test("exports multiple normalized animation clips as FBX stacks", async () => {
  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const bytes = exportFbx(multiClipScene());
  const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");

  assert.equal(group.animations.length, 2);
  assert.deepEqual(group.animations.map((clip) => clip.name), ["MoveX", "ScaleUp"]);
  assert.deepEqual(group.animations.map((clip) => clip.tracks.map((track) => track.name)), [
    ["Cube.position"],
    ["Cube.scale"]
  ]);
});

test("exports single-key transform animation curves", async () => {
  const scene = normalizeFbxScene(singleKeyTransformScene());
  assert.equal(scene.animations[0].tracks[0].keyframes.length, 1);
  assert.equal(scene.animations[0].tracks[0].keyframes[0].frame, 12);

  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(scene)), "");
  const track = group.animations[0].tracks.find((candidate) => candidate.name === "Cube.position");

  assert.ok(track);
  assert.equal(track.times.length, 1);
  assertClose(track.times[0], 0.4);
  assert.deepEqual(Array.from(track.values), [3, 4, 5]);
});

test("exports single-key texture animation curves", () => {
  const scene = normalizeFbxScene(singleKeyTextureScene());
  const track = scene.animations[0].tracks[0];
  const text = decode(exportFbx(scene));

  assert.equal(track.target, "Checker");
  assert.equal(track.property, "textureAlpha");
  assert.deepEqual(track.keyframes, [
    { frame: 12, value: 0.42, interpolation: "linear" }
  ]);
  assert.match(text, /Texture alpha/);
  assert.match(text, /PoseHold/);
});

test("exports model transform metadata animation curves", () => {
  const scene = normalizeFbxScene(modelTransformMetadataAnimationScene());
  const text = decode(exportFbx(scene));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "rotationPivot",
    "geometricScalingZ"
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes[1].value, [4, 5, 6]);
  assert.equal(scene.animations[0].tracks[1].keyframes[1].value, 0.5);
  assert.match(text, /RotationPivot/);
  assert.match(text, /GeometricScaling/);
  assert.match(text, /PivotMetadata/);
});

test("adapts multiple Three.js AnimationClips and ignores unsupported tracks", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeMultiClipScene(), { frameRate: 30 }));

  assert.equal(scene.animations.length, 2);
  assert.deepEqual(scene.animations.map((clip) => clip.name), ["MoveX", "ScaleUp"]);
  assert.deepEqual(scene.animations.map((clip) => clip.tracks[0].property), ["translation", "scale"]);
});

test("exports multiple Three.js AnimationClips as FBXLoader clips", async () => {
  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const bytes = exportFbx(threeMultiClipScene(), { frameRate: 30 });
  const group = new FBXLoader().parse(arrayBufferFrom(bytes), "");

  assert.equal(group.animations.length, 2);
  assert.deepEqual(group.animations.map((clip) => clip.name), ["MoveX", "ScaleUp"]);
  assert.deepEqual(group.animations.map((clip) => clip.tracks.map((track) => track.name)), [
    ["Cube.position"],
    ["Cube.scale"]
  ]);
});

test("adapts Three.js UUID-targeted animation tracks to deterministic export names", async () => {
  const source = duplicateUuidTargetScene();
  const scene = normalizeFbxScene(fromThreeObject(source, {
    frameRate: 30,
    bakeAnimations: false
  }));

  assert.deepEqual(scene.meshes.map((mesh) => mesh.name), ["Twin", "Twin_2"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["Twin_2", "translation"],
    ["second_material", "opacity"],
    ["second_map", "textureTranslation"]
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes[1].value, [2, 0, 0]);
  assert.deepEqual(scene.animations[0].tracks[2].keyframes[1].value, [0.25, 0.5, 0]);

  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(source, {
      frameRate: 30,
      bakeAnimations: false
    })), "");
    assert.ok(group.getObjectByName("Twin"));
    assert.ok(group.getObjectByName("Twin_2"));
    assert.deepEqual(group.animations[0].tracks.map((track) => track.name), [
      "Twin_2.position"
    ]);
  });
});

test("adapts Three.js root-relative animation tracks", async () => {
  const source = rootRelativeTrackScene();
  const scene = normalizeFbxScene(fromThreeObject(source, {
    frameRate: 30,
    bakeAnimations: false
  }));

  assert.equal(scene.meshes[0].name, "RootQuad");
  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["RootQuad", "translation"],
    ["RootMaterial", "opacity"],
    ["root_map", "textureTranslation"]
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes[1].value, [1, 2, 3]);
  assert.deepEqual(
    scene.animations[0].tracks[2].keyframes[1].value.map((value) => Number(value.toFixed(4))),
    [0.4, 0.6, 0]
  );

  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(source, {
      frameRate: 30,
      bakeAnimations: false
    })), "");
    assert.ok(group.getObjectByName("RootQuad"));
    assert.deepEqual(group.animations[0].tracks.map((track) => track.name), [
      "RootQuad.position"
    ]);
  });
});

test("adapts bare Three.js root-local animation tracks", () => {
  const scene = normalizeFbxScene(fromThreeObject(bareRootLocalTrackScene(), {
    frameRate: 30,
    bakeAnimations: false
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["RootQuad", "translation"],
    ["RootMaterial", "opacity"],
    ["root_map", "textureTranslation"]
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes[1].value, [2, 3, 4]);
  assert.deepEqual(
    scene.animations[0].tracks[2].keyframes[1].value.map((value) => Number(value.toFixed(4))),
    [0.2, 0.7, 0]
  );
});

test("collects child Object3D animation clips with local root-relative targets", async () => {
  const source = childOwnedAnimationScene();
  const scene = normalizeFbxScene(fromThreeObject(source, {
    frameRate: 30,
    bakeAnimations: false
  }));

  assert.deepEqual(scene.animations.map((clip) => clip.name), ["LeftLocalMove", "RightLocalMove"]);
  assert.deepEqual(scene.animations.map((clip) => clip.tracks.map((track) => [track.target, track.property])), [
    [
      ["LeftQuad", "translation"],
      ["left_map", "textureTranslation"]
    ],
    [
      ["RightQuad", "translation"]
    ]
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes[1].value, [1, 0, 0]);
  assert.deepEqual(scene.animations[1].tracks[0].keyframes[1].value, [-1, 0, 0]);

  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(source, {
      frameRate: 30,
      bakeAnimations: false
    })), "");
    assert.deepEqual(group.animations.map((clip) => clip.name), ["LeftLocalMove", "RightLocalMove"]);
    assert.deepEqual(group.animations.map((clip) => clip.tracks.map((track) => track.name)), [
      ["LeftQuad.position"],
      ["RightQuad.position"]
    ]);
  });
});

test("collects child Object3D userData animation clips with local targets", () => {
  const scene = normalizeFbxScene(fromThreeObject(childUserDataOwnedAnimationScene(), {
    frameRate: 30,
    bakeAnimations: false
  }));

  assert.deepEqual(scene.animations.map((clip) => clip.name), [
    "LeftUserDataLocalMove",
    "RightUserDataLocalMove"
  ]);
  assert.deepEqual(scene.animations.map((clip) => clip.tracks.map((track) => [track.target, track.property])), [
    [
      ["LeftQuad", "translation"],
      ["left_map", "textureTranslation"]
    ],
    [
      ["RightQuad", "translation"]
    ]
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes[1].value, [0, 2, 0]);
  assert.deepEqual(
    scene.animations[0].tracks[1].keyframes[1].value.map((value) => Number(value.toFixed(4))),
    [0.35, 0.45, 0]
  );
  assert.deepEqual(scene.animations[1].tracks[0].keyframes[1].value, [0, -2, 0]);
});

test("adapts Three.js animation tracks for object names containing dots", async () => {
  const source = dottedObjectNameAnimationScene();
  const scene = normalizeFbxScene(fromThreeObject(source, {
    frameRate: 30,
    bakeAnimations: false
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["Cat.Body", "translation"],
    ["CatBodyMaterial", "opacity"],
    ["cat_body_map", "textureTranslation"]
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes[1].value, [2, 1, 0]);
  assert.deepEqual(
    scene.animations[0].tracks[2].keyframes[1].value.map((value) => Number(value.toFixed(4))),
    [0.15, 0.45, 0]
  );

  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(source, {
      frameRate: 30,
      bakeAnimations: false
    })), "");
    assert.ok(group.getObjectByName("CatBody"));
    assert.deepEqual(group.animations[0].tracks.map((track) => track.name), [
      "CatBody.position"
    ]);
  });
});

test("bakes smooth Three.js interpolation into sampled transform keys", async () => {
  const scene = normalizeFbxScene(fromThreeObject(smoothThreeAnimationScene(), { frameRate: 30 }));
  const keyframes = scene.animations[0].tracks[0].keyframes;
  const halfway = keyframes.find((keyframe) => keyframe.frame === 15);

  assert.ok(keyframes.length > 3);
  assert.ok(halfway);
  assertClose(halfway.value[0], 0.5);
  assertClose(halfway.value[1], 0.625);

  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(smoothThreeAnimationScene(), { frameRate: 30 })), "");
  const track = group.animations[0].tracks.find((candidate) => candidate.name === "Cube.position");
  const sampleIndex = track.times.findIndex((time) => Math.abs(time - 0.5) < 1e-6);

  assert.notEqual(sampleIndex, -1);
  assertClose(track.values[sampleIndex * 3], 0.5);
  assertClose(track.values[sampleIndex * 3 + 1], 0.625);
});

test("uses Three.js clip-specific bake frame rate when sampling curves", () => {
  const scene = normalizeFbxScene(fromThreeObject(clipBakeFrameRateScene(), { frameRate: 24 }));
  const keyframes = scene.animations[0].tracks[0].keyframes;
  const frames = keyframes.map((keyframe) => Number(keyframe.frame.toFixed(6)));

  assert.equal(keyframes.length, 25);
  assert.deepEqual(frames.slice(0, 4), [0, 2, 4, 6]);
  assert.ok(!frames.includes(1));

  const halfway = keyframes.find((keyframe) => keyframe.frame === 12);
  assert.ok(halfway);
  assertClose(halfway.value[0], 0.5);
  assertClose(halfway.value[1], 0.625);
});

test("uses Three.js track-specific bake frame rate over clip defaults", () => {
  const scene = normalizeFbxScene(fromThreeObject(trackBakeFrameRateScene(), { frameRate: 24 }));
  const keyframes = scene.animations[0].tracks[0].keyframes;
  const frames = keyframes.map((keyframe) => Number(keyframe.frame.toFixed(6)));

  assert.equal(keyframes.length, 13);
  assert.deepEqual(frames.slice(0, 4), [0, 4, 8, 12]);
  assert.ok(!frames.includes(2));

  const halfway = keyframes.find((keyframe) => keyframe.frame === 12);
  assert.ok(halfway);
  assertClose(halfway.value[0], 0.5);
  assertClose(halfway.value[1], 0.625);
});

test("trims Three.js clip source ranges before FBX key export", () => {
  const scene = normalizeFbxScene(fromThreeObject(sourceTrimScene(), { frameRate: 4 }));
  const clip = scene.animations[0];
  const keyframes = clip.tracks[0].keyframes;

  assert.equal(clip.startFrame, 0);
  assert.equal(clip.endFrame, 4);
  assert.deepEqual(keyframes.map((keyframe) => keyframe.frame), [0, 2, 4]);
  assert.deepEqual(keyframes.map((keyframe) => keyframe.value), [
    [5, 0, 0],
    [10, 0, 0],
    [15, 0, 0]
  ]);
});

test("adds trim boundary keys when preserving sparse Three.js animation keys", () => {
  const scene = normalizeFbxScene(fromThreeObject(sourceTrimScene(), {
    frameRate: 4,
    bakeAnimations: false
  }));
  const clip = scene.animations[0];
  const keyframes = clip.tracks[0].keyframes;

  assert.equal(clip.startFrame, 0);
  assert.equal(clip.endFrame, 4);
  assert.deepEqual(keyframes.map((keyframe) => keyframe.frame), [0, 2, 4]);
  assert.deepEqual(keyframes.map((keyframe) => keyframe.value), [
    [5, 0, 0],
    [10, 0, 0],
    [15, 0, 0]
  ]);
});

test("bakes discrete Three.js interpolation with a hold key before the step", () => {
  const scene = normalizeFbxScene(fromThreeObject(discreteThreeAnimationScene(), { frameRate: 30 }));
  const keyframes = scene.animations[0].tracks[0].keyframes;
  const beforeStep = keyframes.find((keyframe) => keyframe.frame > 29.99 && keyframe.frame < 30);
  const step = keyframes.find((keyframe) => keyframe.frame === 30);

  assert.ok(beforeStep);
  assert.ok(step);
  assert.deepEqual(beforeStep.value, [0, 0, 0]);
  assert.deepEqual(step.value, [4, 0, 0]);
});

test("can preserve original Three.js animation keys when baking is disabled", () => {
  const scene = normalizeFbxScene(fromThreeObject(smoothThreeAnimationScene(), {
    frameRate: 30,
    bakeAnimations: false
  }));
  const keyframes = scene.animations[0].tracks[0].keyframes;

  assert.equal(keyframes.length, 3);
  assert.deepEqual(keyframes.map((keyframe) => keyframe.frame), [0, 30, 60]);
});

test("adapts Three.js scalar transform component tracks", () => {
  const scene = normalizeFbxScene(fromThreeObject(componentThreeAnimationScene(), {
    frameRate: 30,
    bakeAnimations: false
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "translationX",
    "rotationY",
    "scaleZ"
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes.map((keyframe) => keyframe.value), [0, 3]);
  assertClose(scene.animations[0].tracks[1].keyframes[0].value, 0);
  assertClose(scene.animations[0].tracks[1].keyframes[1].value, 90);
  assert.deepEqual(scene.animations[0].tracks[2].keyframes.map((keyframe) => keyframe.value), [1, 2]);
});

test("adapts Three.js quaternion component tracks into one rotation curve", async () => {
  const quaternion = new Quaternion().setFromEuler(new Euler(0, Math.PI / 3, 0));
  const source = animatedQuadScene("QuaternionComponentMove", new NumberKeyframeTrack("Cube.quaternion[1]", [0, 1], [
    0,
    quaternion.y
  ]));
  source.animations = [
    new AnimationClip("QuaternionComponentMove", 1, [
      new NumberKeyframeTrack("Cube.quaternion[1]", [0, 1], [
        0,
        quaternion.y
      ]),
      new NumberKeyframeTrack("Cube.quaternion.w", [0, 1], [
        1,
        quaternion.w
      ])
    ])
  ];

  const scene = normalizeFbxScene(fromThreeObject(source, {
    frameRate: 30,
    bakeAnimations: false
  }));
  const expected = new Euler().setFromQuaternion(quaternion, "XYZ");

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["Cube", "rotation"]
  ]);
  assert.equal(scene.animations[0].tracks[0].keyframes.length, 2);
  assertClose(scene.animations[0].tracks[0].keyframes[1].value[0], expected.x * 180 / Math.PI);
  assertClose(scene.animations[0].tracks[0].keyframes[1].value[1], expected.y * 180 / Math.PI);
  assertClose(scene.animations[0].tracks[0].keyframes[1].value[2], expected.z * 180 / Math.PI);

  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(source, {
    frameRate: 30,
    bakeAnimations: false
  })), "");
  assert.deepEqual(group.animations[0].tracks.map((track) => track.name), [
    "Cube.quaternion"
  ]);
});

test("adapts Three.js matrix animation tracks into transform curves", async () => {
  const scene = normalizeFbxScene(fromThreeObject(matrixThreeAnimationScene(), {
    frameRate: 30,
    bakeAnimations: false
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "translation",
    "rotation",
    "scale"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), ["Cube", "Cube", "Cube"]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes[1].value, [2, 3, 4]);
  assertClose(scene.animations[0].tracks[1].keyframes[1].value[2], 90);
  assert.deepEqual(scene.animations[0].tracks[2].keyframes[1].value, [2, 3, 4]);

  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(matrixThreeAnimationScene(), {
    frameRate: 30,
    bakeAnimations: false
  })), "");
  assert.deepEqual(group.animations[0].tracks.map((track) => track.name), [
    "Cube.position",
    "Cube.quaternion",
    "Cube.scale"
  ]);
});

test("adapts Three.js model transform metadata animation tracks", () => {
  const source = modelMetadataThreeAnimationScene();
  const scene = normalizeFbxScene(fromThreeObject(source, {
    frameRate: 30,
    bakeAnimations: false
  }));
  const text = decode(exportFbx(source, {
    frameRate: 30,
    bakeAnimations: false
  }));

  assert.deepEqual(scene.meshes[0].transform.rotationPivot, [0.1, 0.2, 0.3]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["Cube", "rotationPivot"],
    ["Cube", "geometricScalingZ"]
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes[1].value, [1, 2, 3]);
  assert.equal(scene.animations[0].tracks[1].keyframes[1].value, 0.5);
  assert.match(text, /RotationPivot/);
  assert.match(text, /GeometricScaling/);
});

test("adapts Three.js quaternion tracks using the target rotation order", () => {
  const quaternion = new Quaternion().setFromEuler(new Euler(0.3, 0.7, -0.4, "ZYX"));
  const root = animatedQuadScene("RotationOrderQuat", new QuaternionKeyframeTrack("Cube.quaternion", [0, 1], [
    0, 0, 0, 1,
    ...quaternion.toArray()
  ]));
  root.getObjectByName("Cube").rotation.order = "ZYX";

  const scene = normalizeFbxScene(fromThreeObject(root, {
    frameRate: 30,
    bakeAnimations: false
  }));
  const rotationTrack = scene.animations[0].tracks.find((track) => track.property === "rotation");
  const expected = new Euler().setFromQuaternion(quaternion, "ZYX");

  assert.equal(scene.meshes[0].transform.rotationOrder, 5);
  assert.ok(rotationTrack);
  assertClose(rotationTrack.keyframes[1].value[0], expected.x * 180 / Math.PI);
  assertClose(rotationTrack.keyframes[1].value[1], expected.y * 180 / Math.PI);
  assertClose(rotationTrack.keyframes[1].value[2], expected.z * 180 / Math.PI);
});

test("Blender imports multiple FBX animation stacks as actions", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "multi-clip.fbx");
  await writeFile(fbxPath, exportFbx(multiClipScene()));

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
print("FBX_VALIDATE:" + json.dumps({
    "actions": sorted((action.name, len(action.fcurves)) for action in bpy.data.actions),
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
  assert.deepEqual(info.actions, [["Cube|MoveX", 9], ["Cube|ScaleUp", 9]]);
});
