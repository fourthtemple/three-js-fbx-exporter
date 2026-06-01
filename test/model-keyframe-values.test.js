import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeFbxScene } from "../src/index.js";

function wrappedModelKeyframeScene() {
  return {
    name: "WrappedModelKeyframeScene",
    meshes: [
      {
        name: "AnimatedQuad",
        materials: [{ name: "Mat" }],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          materialIndices: [0],
          morphTargets: [
            {
              name: "Puff",
              indices: [2, 3],
              vertices: [0, 0, 0.5, 0, 0, 0.5]
            }
          ]
        }
      }
    ],
    animations: [
      {
        name: "WrappedModelKeys",
        frameRate: 30,
        tracks: [
          {
            target: "AnimatedQuad",
            property: "position",
            keyframes: [
              { frame: 0, value: { position: [0, 0, 0] } },
              { frame: 30, value: { translation: { x: 1, y: 2, z: 3 } } }
            ]
          },
          {
            target: "AnimatedQuad",
            property: "rotationY",
            keyframes: [
              { frame: 0, value: { rotation: [0, 0, 0] } },
              { frame: 30, value: { value: { rotation: [0, 90, 0] } } }
            ]
          },
          {
            target: "AnimatedQuad",
            property: "scaleZ",
            keyframes: [
              { frame: 0, value: { scale: [1, 1, 1] } },
              { frame: 30, value: { scaling: [1, 1, 2] } }
            ]
          },
          {
            target: "AnimatedQuad",
            property: "morph",
            morphTarget: "Puff",
            keyframes: [
              { frame: 0, value: { weight: 0 } },
              { frame: 30, value: { morphTargetInfluence: 0.8 } }
            ]
          },
          {
            target: "AnimatedQuad",
            property: "visible",
            keyframes: [
              { frame: 0, value: { visible: 1 } },
              { frame: 30, value: { visibility: 0 } }
            ]
          }
        ]
      }
    ]
  };
}

test("normalizes object-valued model transform, morph, and visibility keyframes", () => {
  const scene = normalizeFbxScene(wrappedModelKeyframeScene());

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "translation",
    "rotationY",
    "scaleZ",
    "morph",
    "visibility"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.keyframes.map((keyframe) => keyframe.value)), [
    [[0, 0, 0], [1, 2, 3]],
    [0, 90],
    [1, 2],
    [0, 0.8],
    [1, 0]
  ]);
});
