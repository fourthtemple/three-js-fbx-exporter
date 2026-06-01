import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  AnimationClip,
  BufferGeometry,
  ColorKeyframeTrack,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  NumberKeyframeTrack,
  PerspectiveCamera,
  PointLight,
  Scene,
  SpotLight,
  VectorKeyframeTrack
} from "three";
import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { arrayBufferFrom, blenderPath, blenderTestArgs, decode, hasBlender, withMockDocument } from "./fbx-test-helpers.js";

function baseMesh() {
  return {
    name: "Quad",
    materials: [{ name: "Mat" }],
    geometry: {
      vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
      faces: [[0, 1, 2, 3]],
      uvs: [0, 0, 1, 0, 1, 1, 0, 1],
      materialIndices: [0]
    }
  };
}

function cameraLightScene() {
  return {
    name: "CameraLightScene",
    meshes: [baseMesh()],
    cameras: [
      {
        name: "RenderCamera",
        translation: [0, 2, 8],
        rotation: [-15, 0, 0],
        fov: 50,
        near: 0.2,
        far: 500,
        aspectWidth: 16,
        aspectHeight: 9
      }
    ],
    lights: [
      {
        name: "KeyLight",
        kind: "point",
        translation: [2, 3, 4],
        color: [1, 0.8, 0.6],
        intensity: 2,
        distance: 12
      }
    ],
    animations: [
      {
        name: "CameraMove",
        frameRate: 30,
        tracks: [
          {
            target: "RenderCamera",
            property: "translation",
            keyframes: [
              { frame: 0, value: [0, 2, 8] },
              { frame: 30, value: [1, 2, 8] }
            ]
          }
        ]
      }
    ]
  };
}

function lightAttributeAnimationScene() {
  return {
    name: "LightAttributeAnimationScene",
    meshes: [baseMesh()],
    lights: [
      {
        name: "KeyLight",
        kind: "point",
        translation: [2, 3, 4],
        color: [1, 0.8, 0.6],
        intensity: 2,
        distance: 12
      }
    ],
    animations: [
      {
        name: "LightPulse",
        frameRate: 30,
        tracks: [
          {
            target: "KeyLight",
            property: "lightIntensity",
            keyframes: [
              { frame: 0, value: 2 },
              { frame: 30, value: 4 }
            ]
          },
          {
            target: "KeyLight",
            property: "lightColor",
            keyframes: [
              { frame: 0, value: [1, 0.8, 0.6] },
              { frame: 30, value: [0.4, 0.7, 1] }
            ]
          },
          {
            target: "KeyLight",
            property: "lightDistance",
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

function spotLightAttributeAnimationScene() {
  return {
    name: "SpotLightAttributeAnimationScene",
    meshes: [baseMesh()],
    lights: [
      {
        name: "SpotKey",
        kind: "spot",
        translation: [0, 4, 2],
        color: [1, 1, 1],
        intensity: 2,
        distance: 18,
        innerAngle: 25,
        outerAngle: 35
      }
    ],
    animations: [
      {
        name: "SpotCone",
        frameRate: 30,
        tracks: [
          {
            target: "SpotKey",
            property: "innerAngle",
            keyframes: [
              { frame: 0, value: 25 },
              { frame: 30, value: 18 }
            ]
          },
          {
            target: "SpotKey",
            property: "outerAngle",
            keyframes: [
              { frame: 0, value: 35 },
              { frame: 30, value: 55 }
            ]
          }
        ]
      }
    ]
  };
}

function lightTransformAnimationScene() {
  return {
    name: "LightTransformAnimationScene",
    meshes: [baseMesh()],
    lights: [
      {
        name: "KeyLight",
        kind: "point",
        translation: [2, 3, 4],
        color: [1, 1, 1],
        intensity: 2,
        distance: 12
      }
    ],
    animations: [
      {
        name: "LightMove",
        frameRate: 30,
        tracks: [
          {
            target: "KeyLight",
            property: "translation",
            keyframes: [
              { frame: 0, value: [2, 3, 4] },
              { frame: 30, value: [5, 6, 7] }
            ]
          }
        ]
      }
    ]
  };
}

function threeCameraLightScene() {
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
  mesh.name = "Quad";

  const camera = new PerspectiveCamera(55, 16 / 9, 0.1, 250);
  camera.name = "ThreeCamera";
  camera.position.set(0, 3, 9);

  const light = new PointLight(0xffcc99, 3, 15);
  light.name = "ThreeLight";
  light.position.set(2, 3, 4);

  const scene = new Scene();
  scene.name = "ThreeCameraLightScene";
  scene.add(mesh, camera, light);
  scene.animations = [
    new AnimationClip("ThreeCameraMove", 1, [
      new VectorKeyframeTrack("ThreeCamera.position", [0, 1], [0, 3, 9, 1, 3, 9])
    ])
  ];
  return scene;
}

function threeLightAttributeAnimationScene() {
  const scene = threeCameraLightScene();
  scene.name = "ThreeLightAttributeAnimationScene";
  scene.animations = [
    new AnimationClip("ThreeLightPulse", 1, [
      new NumberKeyframeTrack("ThreeLight.intensity", [0, 1], [3, 5]),
      new ColorKeyframeTrack("ThreeLight.color", [0, 1], [
        1, 0.8, 0.6,
        0.4, 0.7, 1
      ]),
      new NumberKeyframeTrack("ThreeLight.distance", [0, 1], [15, 30])
    ])
  ];
  return scene;
}

function threeSpotLightAttributeAnimationScene() {
  const scene = threeCameraLightScene();
  scene.name = "ThreeSpotLightAttributeAnimationScene";
  const spot = new SpotLight(0xffffff, 2, 18, Math.PI / 4, 0.25);
  spot.name = "ThreeSpot";
  spot.position.set(0, 4, 2);
  scene.add(spot);
  scene.animations = [
    new AnimationClip("ThreeSpotCone", 1, [
      new NumberKeyframeTrack("ThreeSpot.angle", [0, 1], [Math.PI / 6, Math.PI / 4]),
      new NumberKeyframeTrack("ThreeSpot.penumbra", [0, 1], [0, 0.5])
    ])
  ];
  return scene;
}

function assertClose(actual, expected, epsilon = 1e-5) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} not close to ${expected}`);
}

function rounded(values) {
  return values.map((value) => Number(value.toFixed(4)));
}

test("normalizes camera and light scene objects as animation targets", () => {
  const scene = normalizeFbxScene(cameraLightScene());

  assert.equal(scene.cameras.length, 1);
  assert.equal(scene.lights.length, 1);
  assert.equal(scene.animations[0].tracks[0].target, "RenderCamera");
});

test("normalizes light attribute animation targets", () => {
  const scene = normalizeFbxScene(lightAttributeAnimationScene());

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "lightIntensity",
    "lightColor",
    "lightDistance"
  ]);
  assert.deepEqual(scene.animations[0].tracks[1].keyframes[1].value, [0.4, 0.7, 1]);
});

test("normalizes spot light cone animation targets", () => {
  const scene = normalizeFbxScene(spotLightAttributeAnimationScene());

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "lightInnerAngle",
    "lightOuterAngle"
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes.map((keyframe) => keyframe.value), [25, 18]);
  assert.deepEqual(scene.animations[0].tracks[1].keyframes.map((keyframe) => keyframe.value), [35, 55]);
});

test("Three.js FBXLoader parses exported cameras, lights, and camera animation", async () => {
  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(cameraLightScene())), "");
    const camera = group.getObjectByName("RenderCamera");
    const light = group.getObjectByName("KeyLight");

    assert.equal(camera.isPerspectiveCamera, true);
    assert.equal(light.isPointLight, true);
    assert.equal(light.intensity, 2);
    assert.equal(light.distance, 12);
    assert.equal(group.animations.length, 1);
    assert.deepEqual(group.animations[0].tracks.map((track) => track.name), ["RenderCamera.position"]);
  });
});

test("Three.js FBXLoader parses light transform animation", async () => {
  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(lightTransformAnimationScene())), "");
    const light = group.getObjectByName("KeyLight");
    const track = group.animations[0].tracks.find((candidate) => candidate.name === "KeyLight.position");

    assert.equal(light.isPointLight, true);
    assert.ok(track);
    assert.deepEqual(Array.from(track.values), [2, 3, 4, 5, 6, 7]);
  });
});

test("adapts Three.js cameras and lights before export", async () => {
  const scene = fromThreeObject(threeCameraLightScene(), { frameRate: 30 });

  assert.deepEqual(scene.cameras.map((camera) => camera.name), ["ThreeCamera"]);
  assert.deepEqual(scene.lights.map((light) => light.name), ["ThreeLight"]);
  assert.equal(scene.animations[0].tracks[0].target, "ThreeCamera");

  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(threeCameraLightScene(), { frameRate: 30 })), "");

    assert.equal(group.getObjectByName("ThreeCamera").isPerspectiveCamera, true);
    assert.equal(group.getObjectByName("ThreeLight").isPointLight, true);
    assert.deepEqual(group.animations[0].tracks.map((track) => track.name), ["ThreeCamera.position"]);
  });
});

test("adapts Three.js light attribute tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeLightAttributeAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "lightIntensity",
    "lightColor",
    "lightDistance"
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes.map((keyframe) => keyframe.value), [3, 5]);
  assert.deepEqual(rounded(scene.animations[0].tracks[1].keyframes[1].value), [0.4, 0.7, 1]);
  assert.deepEqual(scene.animations[0].tracks[2].keyframes.map((keyframe) => keyframe.value), [15, 30]);
});

test("adapts Three.js spot light cone tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeSpotLightAttributeAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  const spot = scene.lights.find((light) => light.name === "ThreeSpot");
  const tracks = scene.animations[0].tracks;

  assert.equal(spot.kind, "spot");
  assertClose(spot.outerAngle, 45);
  assertClose(spot.innerAngle, 33.75);
  assert.deepEqual(tracks.map((track) => track.property), [
    "lightOuterAngle",
    "lightInnerAngle"
  ]);
  assert.deepEqual(rounded(tracks[0].keyframes.map((keyframe) => keyframe.value)), [30, 45]);
  assert.deepEqual(rounded(tracks[1].keyframes.map((keyframe) => keyframe.value)), [45, 22.5]);
});

test("writes light attribute animation curves", () => {
  const text = decode(exportFbx(lightAttributeAnimationScene()));

  assert.match(text, /KeyLight/);
  assert.match(text, /Intensity/);
  assert.match(text, /Color/);
  assert.match(text, /FarAttenuationEnd/);
  assert.match(text, /AnimationCurveNode/);
  assert.match(text, /AnimationCurve/);
});

test("writes spot light cone animation curves", () => {
  const text = decode(exportFbx(spotLightAttributeAnimationScene()));

  assert.match(text, /SpotKey/);
  assert.match(text, /InnerAngle/);
  assert.match(text, /OuterAngle/);
  assert.match(text, /AnimationCurveNode/);
  assert.match(text, /AnimationCurve/);
});

test("Blender imports exported cameras and lights", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "camera-light.fbx");
  await writeFile(fbxPath, exportFbx(cameraLightScene()));

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
print("FBX_VALIDATE:" + json.dumps({
    "cameras": sorted(obj.name for obj in bpy.context.scene.objects if obj.type == "CAMERA"),
    "lights": sorted([{
        "name": obj.name,
        "type": obj.data.type,
        "energy": round(obj.data.energy, 4),
        "color": [round(v, 4) for v in obj.data.color],
    } for obj in bpy.context.scene.objects if obj.type == "LIGHT"], key=lambda item: item["name"]),
    "meshes": sorted(obj.name for obj in bpy.context.scene.objects if obj.type == "MESH"),
    "actions": sorted(action.name for action in bpy.data.actions),
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
  assert.deepEqual(info.lights, [
    {
      name: "KeyLight",
      type: "POINT",
      energy: 2,
      color: [1, 0.8, 0.6]
    }
  ]);
  assert.deepEqual(info.meshes, ["Quad"]);
  assert.deepEqual(info.actions, ["RenderCamera|CameraMove"]);
});

test("Blender imports light transform animation", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "light-transform.fbx");
  await writeFile(fbxPath, exportFbx(lightTransformAnimationScene()));

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
def clean(value):
    value = round(value, 4)
    return 0 if abs(value) < 0.00005 else value
actions = []
for action in bpy.data.actions:
    actions.append({
        "name": action.name,
        "curves": sorted((fc.data_path, fc.array_index, [clean(kp.co.y) for kp in fc.keyframe_points]) for fc in action.fcurves),
    })
print("FBX_VALIDATE:" + json.dumps({
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
  assert.deepEqual(info.actions, [
    {
      name: "KeyLight|LightMove",
      curves: [
        ["location", 0, [0.02, 0.05]],
        ["location", 1, [-0.04, -0.07]],
        ["location", 2, [0.03, 0.06]],
        ["rotation_euler", 0, [0, 0]],
        ["rotation_euler", 1, [0, 0]],
        ["rotation_euler", 2, [0, 0]],
        ["scale", 0, [0.01, 0.01]],
        ["scale", 1, [0.01, 0.01]],
        ["scale", 2, [0.01, 0.01]]
      ]
    }
  ]);
});
