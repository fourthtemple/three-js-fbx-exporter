import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  AnimationClip,
  NumberKeyframeTrack,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera
} from "three";
import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { blenderPath, blenderTestArgs, decode, hasBlender } from "./fbx-test-helpers.js";

function cameraLensScene() {
  return {
    name: "CameraLensScene",
    cameras: [
      {
        name: "RenderCamera",
        translation: [0, 2, 8],
        rotation: [-15, 0, 0],
        fov: 45,
        focalLength: 35,
        focusDistance: 12,
        near: 0.1,
        far: 200,
        aspectWidth: 16,
        aspectHeight: 9
      }
    ],
    animations: [
      {
        name: "LensPull",
        frameRate: 30,
        tracks: [
          {
            target: "RenderCamera",
            property: "focalLength",
            keyframes: [
              { frame: 0, value: 35 },
              { frame: 30, value: 70 }
            ]
          }
        ]
      }
    ]
  };
}

function cameraFocusScene() {
  return {
    name: "CameraFocusScene",
    cameras: [
      {
        name: "FocusCamera",
        translation: [0, 2, 8],
        rotation: [-15, 0, 0],
        fov: 45,
        focalLength: 35,
        focusDistance: 12,
        near: 0.1,
        far: 200,
        aspectWidth: 16,
        aspectHeight: 9
      }
    ],
    animations: [
      {
        name: "FocusPull",
        frameRate: 30,
        tracks: [
          {
            target: "FocusCamera",
            property: "focusDistance",
            keyframes: [
              { frame: 0, value: 12 },
              { frame: 30, value: 24 }
            ]
          }
        ]
      }
    ]
  };
}

function cameraOrthoScene() {
  return {
    name: "CameraOrthoScene",
    cameras: [
      {
        name: "OrthoCamera",
        projection: "orthographic",
        orthoZoom: 6,
        translation: [0, 2, 8],
        rotation: [-15, 0, 0],
        near: 0.1,
        far: 200,
        aspectWidth: 16,
        aspectHeight: 9
      }
    ],
    animations: [
      {
        name: "OrthoPull",
        frameRate: 30,
        tracks: [
          {
            target: "OrthoCamera",
            property: "orthoZoom",
            keyframes: [
              { frame: 0, value: 6 },
              { frame: 30, value: 3 }
            ]
          }
        ]
      }
    ]
  };
}

function threeCameraFovScene() {
  const camera = new PerspectiveCamera(90, 1, 0.1, 250);
  camera.name = "ThreeCamera";
  const root = new Object3D();
  root.name = "ThreeCameraFovScene";
  root.add(camera);
  root.animations = [
    new AnimationClip("FovPull", 1, [
      new NumberKeyframeTrack("ThreeCamera.fov", [0, 1], [90, 60])
    ])
  ];
  return root;
}

function threeCameraFocusScene() {
  const camera = new PerspectiveCamera(55, 1, 0.1, 250);
  camera.name = "ThreeFocusCamera";
  camera.focusDistance = 12;
  const root = new Object3D();
  root.name = "ThreeCameraFocusScene";
  root.add(camera);
  root.animations = [
    new AnimationClip("FocusPull", 1, [
      new NumberKeyframeTrack("ThreeFocusCamera.focusDistance", [0, 1], [12, 24])
    ])
  ];
  return root;
}

function threeOrthographicCameraScene() {
  const camera = new OrthographicCamera(-2, 2, 3, -3, 0.1, 250);
  camera.name = "ThreeOrthoCamera";
  const root = new Object3D();
  root.name = "ThreeOrthographicCameraScene";
  root.add(camera);
  root.animations = [
    new AnimationClip("OrthoPull", 1, [
      new NumberKeyframeTrack("ThreeOrthoCamera.zoom", [0, 1], [1, 2])
    ])
  ];
  return root;
}

function assertClose(actual, expected, epsilon = 1e-4) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} not close to ${expected}`);
}

test("normalizes camera focal length animation targets", () => {
  const scene = normalizeFbxScene(cameraLensScene());
  const track = scene.animations[0].tracks[0];

  assert.equal(track.target, "RenderCamera");
  assert.equal(track.property, "cameraFocalLength");
  assert.deepEqual(track.keyframes.map((keyframe) => keyframe.value), [35, 70]);
});

test("adapts Three.js camera fov tracks into focal length animation", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCameraFovScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const track = scene.animations[0].tracks[0];

  assert.equal(track.target, "ThreeCamera");
  assert.equal(track.property, "cameraFocalLength");
  assertClose(track.keyframes[0].value, 17.5);
  assertClose(track.keyframes[1].value, 30.310889);
});

test("normalizes camera focus distance animation targets", () => {
  const scene = normalizeFbxScene(cameraFocusScene());
  const track = scene.animations[0].tracks[0];

  assert.equal(track.target, "FocusCamera");
  assert.equal(track.property, "cameraFocusDistance");
  assert.deepEqual(track.keyframes.map((keyframe) => keyframe.value), [12, 24]);
});

test("normalizes camera orthographic zoom animation targets", () => {
  const scene = normalizeFbxScene(cameraOrthoScene());
  const camera = scene.cameras[0];
  const track = scene.animations[0].tracks[0];

  assert.equal(camera.projection, "orthographic");
  assert.equal(camera.orthoZoom, 6);
  assert.equal(track.target, "OrthoCamera");
  assert.equal(track.property, "cameraOrthoZoom");
  assert.deepEqual(track.keyframes.map((keyframe) => keyframe.value), [6, 3]);
});

test("adapts Three.js orthographic camera zoom tracks into OrthoZoom animation", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeOrthographicCameraScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const camera = scene.cameras[0];
  const track = scene.animations[0].tracks[0];

  assert.equal(camera.projection, "orthographic");
  assert.equal(camera.orthoZoom, 6);
  assert.equal(track.target, "ThreeOrthoCamera");
  assert.equal(track.property, "cameraOrthoZoom");
  assert.deepEqual(track.keyframes.map((keyframe) => keyframe.value), [6, 3]);
});

test("adapts Three.js camera focus distance tracks", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCameraFocusScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const track = scene.animations[0].tracks[0];

  assert.equal(track.target, "ThreeFocusCamera");
  assert.equal(track.property, "cameraFocusDistance");
  assert.deepEqual(track.keyframes.map((keyframe) => keyframe.value), [12, 24]);
});

test("writes camera focal length animation curves", () => {
  const text = decode(exportFbx(cameraLensScene()));

  assert.match(text, /RenderCamera/);
  assert.match(text, /FocalLength/);
  assert.match(text, /AnimationCurveNode/);
  assert.match(text, /AnimationCurve/);
});

test("writes camera focus distance animation curves", () => {
  const text = decode(exportFbx(cameraFocusScene()));

  assert.match(text, /FocusCamera/);
  assert.match(text, /FocusDistance/);
  assert.match(text, /AnimationCurveNode/);
  assert.match(text, /AnimationCurve/);
});

test("writes camera orthographic zoom animation curves", () => {
  const text = decode(exportFbx(cameraOrthoScene()));

  assert.match(text, /OrthoCamera/);
  assert.match(text, /CameraProjectionType/);
  assert.match(text, /OrthoZoom/);
  assert.match(text, /CameraOrthoZoom/);
  assert.match(text, /AnimationCurveNode/);
  assert.match(text, /AnimationCurve/);
});

test("Blender imports camera focal length animation", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "camera-lens.fbx");
  await writeFile(fbxPath, exportFbx(cameraLensScene()));

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
actions = []
for action in bpy.data.actions:
    actions.append({
        "name": action.name,
        "curves": sorted((fc.data_path, fc.array_index, [round(kp.co.y, 4) for kp in fc.keyframe_points]) for fc in action.fcurves if fc.keyframe_points),
    })
print("FBX_VALIDATE:" + json.dumps({
    "cameras": sorted(obj.name for obj in bpy.context.scene.objects if obj.type == "CAMERA"),
    "actions": sorted(actions, key=lambda action: action["name"]),
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
  assert.deepEqual(info.cameras, ["RenderCamera"]);
  assert.deepEqual(info.actions, [
    {
      name: "RenderCamera|LensPull",
      curves: [["lens", 0, [35, 70]]]
    }
  ]);
});

test("Blender imports camera focus distance and focus animation in scene units", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "camera-focus.fbx");
  await writeFile(fbxPath, exportFbx(cameraFocusScene()));

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
camera = bpy.data.cameras["FocusCamera"]
actions = []
for action in bpy.data.actions:
    actions.append({
        "name": action.name,
        "curves": sorted((fc.data_path, fc.array_index, [round(kp.co.y, 4) for kp in fc.keyframe_points]) for fc in action.fcurves if fc.keyframe_points),
    })
print("FBX_VALIDATE:" + json.dumps({
    "focusDistance": round(camera.dof.focus_distance, 4),
    "actions": sorted(actions, key=lambda action: action["name"]),
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
  assert.equal(info.focusDistance, 12);
  assert.deepEqual(info.actions, [
    {
      name: "FocusCamera|FocusPull",
      curves: [["dof.focus_distance", 0, [12, 24]]]
    }
  ]);
});

test("Blender imports orthographic camera scale", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "camera-ortho.fbx");
  await writeFile(fbxPath, exportFbx(cameraOrthoScene()));

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
camera = bpy.data.cameras["OrthoCamera"]
actions = []
for action in bpy.data.actions:
    actions.append({
        "name": action.name,
        "curves": sorted((fc.data_path, fc.array_index, [round(kp.co.y, 4) for kp in fc.keyframe_points]) for fc in action.fcurves if fc.keyframe_points),
    })
print("FBX_VALIDATE:" + json.dumps({
    "type": camera.type,
    "orthoScale": round(camera.ortho_scale, 4),
    "actions": sorted(actions, key=lambda action: action["name"]),
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
  assert.equal(info.type, "ORTHO");
  assert.equal(info.orthoScale, 6);
  assert.deepEqual(info.actions, []);
});
