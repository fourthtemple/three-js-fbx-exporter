import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeFbxScene } from "../src/index.js";

function wrappedSceneKeyframeScene() {
  return {
    name: "WrappedSceneKeyframeScene",
    cameras: [
      {
        name: "RenderCamera",
        projection: "perspective",
        focalLength: 35,
        focusDistance: 12
      },
      {
        name: "OrthoCamera",
        projection: "orthographic",
        orthoZoom: 6
      }
    ],
    lights: [
      {
        name: "KeyLight",
        kind: "spot",
        color: [1, 0.8, 0.6],
        intensity: 2,
        distance: 12,
        innerAngle: 25,
        outerAngle: 35
      }
    ],
    animations: [
      {
        name: "ScenePayloads",
        frameRate: 30,
        tracks: [
          {
            target: "RenderCamera",
            property: "focalLength",
            keyframes: [
              { frame: 0, value: { lens: 35 } },
              { frame: 30, value: { cameraFocalLength: 70 } }
            ]
          },
          {
            target: "RenderCamera",
            property: "focusDistance",
            keyframes: [
              { frame: 0, value: { value: { focusDistance: 12 } } },
              { frame: 30, value: { cameraFocusDistance: 24 } }
            ]
          },
          {
            target: "OrthoCamera",
            property: "orthoZoom",
            keyframes: [
              { frame: 0, value: { orthoScale: 6 } },
              { frame: 30, cameraOrthoZoom: 3 }
            ]
          },
          {
            target: "KeyLight",
            property: "lightIntensity",
            keyframes: [
              { frame: 0, value: { intensity: 2 } },
              { frame: 30, value: { lightIntensity: 4 } }
            ]
          },
          {
            target: "KeyLight",
            property: "lightColor",
            keyframes: [
              { frame: 0, value: { color: [1, 0.8, 0.6] } },
              { frame: 30, value: { lightColor: { r: 0.4, g: 0.7, b: 1 } } }
            ]
          },
          {
            target: "KeyLight",
            property: "distance",
            keyframes: [
              { frame: 0, value: { farAttenuationEnd: 12 } },
              { frame: 30, value: { lightDistance: 24 } }
            ]
          },
          {
            target: "KeyLight",
            property: "innerAngle",
            keyframes: [
              { frame: 0, value: { hotSpotAngle: 25 } },
              { frame: 30, value: { lightInnerAngle: 18 } }
            ]
          },
          {
            target: "KeyLight",
            property: "outerAngle",
            keyframes: [
              { frame: 0, value: { spotOuterAngle: 35 } },
              { frame: 30, value: { coneAngle: 55 } }
            ]
          }
        ]
      }
    ]
  };
}

test("normalizes object-valued camera and light keyframes", () => {
  const scene = normalizeFbxScene(wrappedSceneKeyframeScene());

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "cameraFocalLength",
    "cameraFocusDistance",
    "cameraOrthoZoom",
    "lightIntensity",
    "lightColor",
    "lightDistance",
    "lightInnerAngle",
    "lightOuterAngle"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.keyframes.map((keyframe) => keyframe.value)), [
    [35, 70],
    [12, 24],
    [6, 3],
    [2, 4],
    [[1, 0.8, 0.6], [0.4, 0.7, 1]],
    [12, 24],
    [25, 18],
    [35, 55]
  ]);
});
