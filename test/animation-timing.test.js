import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  AnimationClip,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  VectorKeyframeTrack
} from "three";
import { createStaticMeshFbxDocument, exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import {
  buildAnimationObjects,
  buildTakes,
  createAnimationRecords
} from "../src/animation-document.js";
import {
  animationClipFrameRange,
  fbxTimeMode,
  sceneTimeSpan
} from "../src/animation-timing.js";
import { FBX_KTIME, makeIdFactory } from "../src/fbx-values.js";
import { blenderPath, blenderTestArgs, hasBlender } from "./fbx-test-helpers.js";

function timedScene({ frameRate = 24, endFrame = 48 } = {}) {
  return {
    name: "TimedScene",
    frameRate,
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
        name: "Move",
        frameRate,
        startFrame: 0,
        endFrame,
        tracks: [
          {
            target: "Cube",
            property: "translation",
            keyframes: [
              { frame: 0, value: [0, 0, 0] },
              { frame: endFrame, value: [2, 0, 0] }
            ]
          }
        ]
      }
    ]
  };
}

function threeTimedScene() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0
  ], 3));
  geometry.setIndex([0, 1, 2]);

  const mesh = new Mesh(geometry, new MeshBasicMaterial({ name: "Mat" }));
  mesh.name = "Cube";

  const root = new Object3D();
  root.name = "ThreeTimedScene";
  root.add(mesh);
  root.animations = [
    new AnimationClip("Move", 1, [
      new VectorKeyframeTrack("Cube.position", [0, 1], [
        0, 0, 0,
        2, 0, 0
      ])
    ])
  ];
  return root;
}

function threeClipFrameRateScene() {
  const root = threeTimedScene();
  root.name = "ThreeClipFrameRateScene";
  root.animations[0].userData = { frameRate: 12 };
  return root;
}

function threeExplicitDurationScene() {
  const root = threeTimedScene();
  root.name = "ThreeExplicitDurationScene";
  root.animations = [
    new AnimationClip("ShortTake", 1, [
      new VectorKeyframeTrack("Cube.position", [0, 2], [
        0, 0, 0,
        20, 0, 0
      ])
    ])
  ];
  return root;
}

function threeClipFrameWindowScene() {
  const root = threeTimedScene();
  root.name = "ThreeClipFrameWindowScene";
  root.animations[0].userData = {
    frameRate: 12,
    startFrame: 24
  };
  return root;
}

function threeClipExplicitEndFrameScene() {
  const root = threeTimedScene();
  root.name = "ThreeClipExplicitEndFrameScene";
  root.animations[0].userData = {
    frameRate: 12,
    startFrame: 24,
    endFrame: 30
  };
  return root;
}

function threeClipPlaybackRateScene() {
  const root = threeTimedScene();
  root.name = "ThreeClipPlaybackRateScene";
  root.animations[0].userData = {
    frameRate: 12,
    startFrame: 24,
    timeScale: 2
  };
  return root;
}

function threeClipReversePlaybackScene() {
  const root = threeTimedScene();
  root.name = "ThreeClipReversePlaybackScene";
  root.animations[0].userData = {
    frameRate: 12,
    timeScale: -1
  };
  return root;
}

function layeredTimedScene() {
  return {
    name: "LayeredTimedScene",
    frameRate: 24,
    animations: [
      {
        name: "LayeredMove",
        frameRate: 24,
        layers: [
          {
            name: "Base",
            startFrame: 12,
            tracks: [
              {
                target: "Cube",
                property: "translation",
                keyframes: [
                  { frame: 12, value: [0, 0, 0] },
                  { frame: 24, value: [1, 0, 0] }
                ]
              }
            ]
          },
          {
            name: "Detail",
            endFrame: 48,
            tracks: [
              {
                target: "Cube",
                property: "rotation",
                keyframes: [
                  { frame: 18, value: [0, 0, 0] },
                  { frame: 42, value: [0, 0, 30] }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
}

function findChild(node, name) {
  return node.children.find((child) => child.name === name);
}

function propertyValue(properties, name) {
  const property = properties.children.find((child) => child.name === "P" && child.properties[0] === name);
  const value = property?.properties.at(-1);
  return value?.value ?? value;
}

test("maps common and custom frame rates to FBX time modes", () => {
  assert.deepEqual(fbxTimeMode(24), { timeMode: 11, customFrameRate: 24 });
  assert.deepEqual(fbxTimeMode(29.97), { timeMode: 9, customFrameRate: 30 / 1.001 });
  assert.deepEqual(fbxTimeMode(12), { timeMode: 14, customFrameRate: 12 });
});

test("computes clip and scene time spans from explicit bounds and keys", () => {
  const clip = {
    frameRate: 24,
    startFrame: 12,
    tracks: [
      {
        keyframes: [
          { frame: 24, value: [0, 0, 0] },
          { frame: 36, value: [1, 0, 0] }
        ]
      }
    ]
  };
  assert.deepEqual(animationClipFrameRange(clip), { startFrame: 12, endFrame: 36 });
  assert.deepEqual(sceneTimeSpan({ frameRate: 24, animations: [clip] }), {
    startTime: FBX_KTIME / 2,
    stopTime: Math.round(FBX_KTIME * 1.5)
  });
});

test("computes clip and exported take spans from layered animation tracks", () => {
  const scene = layeredTimedScene();
  const clip = scene.animations[0];

  assert.deepEqual(animationClipFrameRange(clip), { startFrame: 12, endFrame: 48 });
  assert.deepEqual(sceneTimeSpan(scene), {
    startTime: FBX_KTIME / 2,
    stopTime: FBX_KTIME * 2
  });

  const records = createAnimationRecords(scene, [{
    name: "Cube",
    ids: { model: 1001 },
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  }], makeIdFactory());
  const stack = buildAnimationObjects(records).find((node) => node.name === "AnimationStack");
  const stackProperties = findChild(stack, "Properties70");
  const take = findChild(buildTakes(records), "Take");
  const takeLocalTime = findChild(take, "LocalTime").properties.map((property) => property.value);

  assert.equal(propertyValue(stackProperties, "LocalStart"), FBX_KTIME / 2);
  assert.equal(propertyValue(stackProperties, "LocalStop"), FBX_KTIME * 2);
  assert.deepEqual(takeLocalTime, [FBX_KTIME / 2, FBX_KTIME * 2]);
});

test("writes global timeline settings into GlobalSettings", () => {
  const document = createStaticMeshFbxDocument(timedScene());
  const globalSettings = document.find((node) => node.name === "GlobalSettings");
  const properties = findChild(globalSettings, "Properties70");

  assert.equal(propertyValue(properties, "TimeMode"), 11);
  assert.equal(propertyValue(properties, "TimeSpanStart"), 0);
  assert.equal(propertyValue(properties, "TimeSpanStop"), FBX_KTIME * 2);
  assert.equal(propertyValue(properties, "CustomFrameRate"), 24);
});

test("propagates Three.js export frame rate into global timeline settings", () => {
  const scene = fromThreeObject(threeTimedScene(), { frameRate: 24 });
  assert.equal(scene.frameRate, 24);
  assert.equal(scene.animations[0].frameRate, 24);

  const document = createStaticMeshFbxDocument(scene);
  const globalSettings = document.find((node) => node.name === "GlobalSettings");
  const properties = findChild(globalSettings, "Properties70");

  assert.equal(propertyValue(properties, "TimeMode"), 11);
  assert.equal(propertyValue(properties, "TimeSpanStart"), 0);
  assert.equal(propertyValue(properties, "TimeSpanStop"), FBX_KTIME);
  assert.equal(propertyValue(properties, "CustomFrameRate"), 24);
});

test("adapts Three.js clip frame-rate metadata independently from scene timing", () => {
  const scene = fromThreeObject(threeClipFrameRateScene(), {
    frameRate: 30,
    bakeAnimations: false
  });

  assert.equal(scene.frameRate, 30);
  assert.equal(scene.animations[0].frameRate, 12);
  assert.equal(scene.animations[0].endFrame, 12);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes.map((keyframe) => keyframe.frame), [0, 12]);

  const document = createStaticMeshFbxDocument(scene);
  const globalSettings = document.find((node) => node.name === "GlobalSettings");
  const properties = findChild(globalSettings, "Properties70");

  assert.equal(propertyValue(properties, "TimeSpanStop"), FBX_KTIME);
});

test("clamps exported Three.js keys to explicit clip duration", () => {
  const scene = fromThreeObject(threeExplicitDurationScene(), {
    frameRate: 10,
    bakeAnimations: false
  });
  const clip = scene.animations[0];
  const keyframes = clip.tracks[0].keyframes;

  assert.equal(clip.endFrame, 10);
  assert.deepEqual(keyframes.map((keyframe) => keyframe.frame), [0, 10]);
  assert.deepEqual(keyframes.map((keyframe) => keyframe.value), [
    [0, 0, 0],
    [10, 0, 0]
  ]);
});

test("adapts Three.js clip frame windows and offsets exported keyframes", () => {
  const scene = fromThreeObject(threeClipFrameWindowScene(), {
    frameRate: 30,
    bakeAnimations: false
  });
  const clip = scene.animations[0];
  const keyframes = clip.tracks[0].keyframes;

  assert.equal(scene.frameRate, 30);
  assert.equal(clip.frameRate, 12);
  assert.equal(clip.startFrame, 24);
  assert.equal(clip.endFrame, 36);
  assert.deepEqual(keyframes.map((keyframe) => keyframe.frame), [24, 36]);

  const document = createStaticMeshFbxDocument(scene);
  const globalSettings = document.find((node) => node.name === "GlobalSettings");
  const properties = findChild(globalSettings, "Properties70");

  assert.equal(propertyValue(properties, "TimeSpanStart"), FBX_KTIME * 2);
  assert.equal(propertyValue(properties, "TimeSpanStop"), FBX_KTIME * 3);
});

test("retimes Three.js clip keyframes into explicit frame windows", () => {
  const scene = fromThreeObject(threeClipExplicitEndFrameScene(), {
    frameRate: 30,
    bakeAnimations: false
  });
  const clip = scene.animations[0];
  const keyframes = clip.tracks[0].keyframes;

  assert.equal(clip.frameRate, 12);
  assert.equal(clip.startFrame, 24);
  assert.equal(clip.endFrame, 30);
  assert.deepEqual(keyframes.map((keyframe) => keyframe.frame), [24, 30]);

  const document = createStaticMeshFbxDocument(scene);
  const globalSettings = document.find((node) => node.name === "GlobalSettings");
  const properties = findChild(globalSettings, "Properties70");

  assert.equal(propertyValue(properties, "TimeSpanStart"), FBX_KTIME * 2);
  assert.equal(propertyValue(properties, "TimeSpanStop"), Math.round(FBX_KTIME * 2.5));
});

test("adapts Three.js clip playback speed into exported key timing", () => {
  const scene = fromThreeObject(threeClipPlaybackRateScene(), {
    frameRate: 30,
    bakeAnimations: false
  });
  const clip = scene.animations[0];
  const keyframes = clip.tracks[0].keyframes;

  assert.equal(clip.frameRate, 12);
  assert.equal(clip.startFrame, 24);
  assert.equal(clip.endFrame, 30);
  assert.deepEqual(keyframes.map((keyframe) => keyframe.frame), [24, 30]);

  const document = createStaticMeshFbxDocument(scene);
  const globalSettings = document.find((node) => node.name === "GlobalSettings");
  const properties = findChild(globalSettings, "Properties70");

  assert.equal(propertyValue(properties, "TimeSpanStart"), FBX_KTIME * 2);
  assert.equal(propertyValue(properties, "TimeSpanStop"), Math.round(FBX_KTIME * 2.5));
});

test("adapts negative Three.js clip playback speed into reversed FBX key timing", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeClipReversePlaybackScene(), {
    frameRate: 30,
    bakeAnimations: false
  }));
  const clip = scene.animations[0];
  const keyframes = clip.tracks[0].keyframes;

  assert.equal(clip.frameRate, 12);
  assert.equal(clip.startFrame, 0);
  assert.equal(clip.endFrame, 12);
  assert.deepEqual(keyframes.map((keyframe) => keyframe.frame), [0, 12]);
  assert.deepEqual(keyframes.map((keyframe) => keyframe.value), [
    [2, 0, 0],
    [0, 0, 0]
  ]);
});

test("Blender imports custom global frame rate", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "timed-scene.fbx");
  await writeFile(fbxPath, exportFbx(timedScene({ frameRate: 24, endFrame: 24 })));

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
print("FBX_VALIDATE:" + json.dumps({
    "fps": bpy.context.scene.render.fps,
    "fpsBase": bpy.context.scene.render.fps_base,
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
  assert.equal(info.fps, 24);
  assert.equal(info.fpsBase, 1);
});
