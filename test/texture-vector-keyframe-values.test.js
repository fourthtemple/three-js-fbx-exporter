import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeFbxScene } from "../src/index.js";

function wrappedTextureVectorScene() {
  return {
    name: "WrappedTextureVectorScene",
    meshes: [
      {
        name: "Quad",
        materials: [
          {
            name: "Mat",
            diffuseTexture: {
              name: "Sampler",
              fileName: "sampler.tga",
              relativeFileName: "sampler.tga"
            }
          }
        ],
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
        name: "WrappedTextureVectors",
        frameRate: 30,
        tracks: [
          {
            target: "Sampler",
            property: "offset",
            keyframes: [
              { frame: 0, value: { offset: [0.25, 0.5, 0] } },
              { frame: 30, value: { textureTranslation: { x: 0.75, y: 0.25, z: 0 } } }
            ]
          },
          {
            target: "Sampler",
            property: "textureRotation",
            keyframes: [
              { frame: 0, value: { rotation: 0.25 } },
              { frame: 30, value: { textureRotation: [0, 0, 0.5] } }
            ]
          },
          {
            target: "Sampler",
            property: "textureScale",
            keyframes: [
              { frame: 0, value: { repeat: { x: 2, y: 3, z: 1 } } },
              { frame: 30, value: { textureScale: [4, 5, 1] } }
            ]
          },
          {
            target: "Sampler",
            property: "textureRotationPivot",
            keyframes: [
              { frame: 0, value: { center: [0.5, 0.25, 0] } },
              { frame: 30, value: { rotationPivot: { x: 0.75, y: 0.5, z: 0 } } }
            ]
          },
          {
            target: "Sampler",
            property: "textureScalingPivot",
            keyframes: [
              { frame: 0, value: { value: { pivot: [0.5, 0.25, 0] } } },
              { frame: 30, value: { textureScalingPivot: [0.8, 0.6, 0] } }
            ]
          }
        ]
      }
    ]
  };
}

test("normalizes object-valued texture vector keyframe aliases", () => {
  const scene = normalizeFbxScene(wrappedTextureVectorScene());

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureTranslation",
    "textureRotation",
    "textureScale",
    "textureRotationPivot",
    "textureScalingPivot"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.keyframes.map((keyframe) => keyframe.value)), [
    [[0.25, 0.5, 0], [0.75, 0.25, 0]],
    [[0, 0, 0.25], [0, 0, 0.5]],
    [[2, 3, 1], [4, 5, 1]],
    [[0.5, 0.25, 0], [0.75, 0.5, 0]],
    [[0.5, 0.25, 0], [0.8, 0.6, 0]]
  ]);
});
