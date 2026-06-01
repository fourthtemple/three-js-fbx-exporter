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
  NumberKeyframeTrack,
  Scene
} from "three";
import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { blenderPath, blenderTestArgs, decode, hasBlender } from "./fbx-test-helpers.js";

function visibilityScene() {
  return {
    name: "VisibilityScene",
    meshes: [
      {
        name: "HiddenQuad",
        visible: false,
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
        name: "Blink",
        frameRate: 30,
        tracks: [
          {
            target: "HiddenQuad",
            property: "visibility",
            keyframes: [
              { frame: 0, value: 0 },
              { frame: 30, value: 1 }
            ]
          }
        ]
      }
    ]
  };
}

function threeVisibilityScene() {
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
  mesh.name = "HiddenQuad";
  mesh.visible = false;

  const scene = new Scene();
  scene.name = "ThreeVisibilityScene";
  scene.add(mesh);
  scene.animations = [
    new AnimationClip("Blink", 1, [
      new NumberKeyframeTrack("HiddenQuad.visible", [0, 1], [0, 1])
    ])
  ];
  return scene;
}

test("normalizes model visibility and visibility animation targets", () => {
  const scene = normalizeFbxScene(visibilityScene());
  const mesh = scene.meshes[0];
  const track = scene.animations[0].tracks[0];

  assert.equal(mesh.visibility, 0);
  assert.equal(track.property, "visibility");
  assert.deepEqual(track.keyframes.map((keyframe) => keyframe.value), [0, 1]);

  const text = decode(exportFbx(scene));
  assert.match(text, /Visibility/);
  assert.match(text, /AnimationCurveNode/);
  assert.match(text, /AnimationCurve/);
});

test("adapts Three.js visible state and visible tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeVisibilityScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const mesh = scene.meshes[0];
  const track = scene.animations[0].tracks[0];

  assert.equal(mesh.visibility, 0);
  assert.equal(track.target, "HiddenQuad");
  assert.equal(track.property, "visibility");
  assert.deepEqual(track.keyframes.map((keyframe) => keyframe.value), [0, 1]);
});

test("Blender imports static FBX model visibility", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "visibility.fbx");
  await writeFile(fbxPath, exportFbx(visibilityScene()));

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
obj = bpy.data.objects.get("HiddenQuad")
print("FBX_VALIDATE:" + json.dumps({
    "hideViewport": obj.hide_viewport if obj else None,
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
  assert.equal(info.hideViewport, true);
});
