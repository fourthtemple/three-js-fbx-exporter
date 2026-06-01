import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeFbxScene } from "../src/index.js";

function uvMatrixElements({ translation = [0, 0], rotation = 0, scale = [1, 1] } = {}) {
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return [
    scale[0] * cosine,
    -scale[1] * sine,
    0,
    scale[0] * sine,
    scale[1] * cosine,
    0,
    translation[0],
    translation[1],
    1
  ];
}

function assertVectorClose(actual, expected, epsilon = 1e-8) {
  assert.equal(actual.length, expected.length);
  for (let index = 0; index < actual.length; index += 1) {
    assert.ok(
      Math.abs(actual[index] - expected[index]) <= epsilon,
      `expected ${actual[index]} to be within ${epsilon} of ${expected[index]} at index ${index}`
    );
  }
}

function wrappedTextureMatrixScene() {
  return {
    name: "WrappedTextureMatrixScene",
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
        name: "WrappedTextureMatrices",
        frameRate: 30,
        tracks: [
          {
            target: "Sampler",
            property: "uvMatrix",
            keyframes: [
              {
                frame: 0,
                value: {
                  uvMatrix: {
                    elements: uvMatrixElements({
                      translation: [0.125, -0.25],
                      rotation: 0.5,
                      scale: [2, 3]
                    })
                  }
                }
              },
              {
                frame: 30,
                value: {
                  value: {
                    transformMatrix: uvMatrixElements({
                      translation: [0.25, 0.5],
                      rotation: 0.75,
                      scale: [4, 5]
                    })
                  }
                }
              },
              {
                frame: 60,
                defaultValue: {
                  matrix: uvMatrixElements({
                    translation: [0.375, 0.625],
                    rotation: 1,
                    scale: [6, 7]
                  })
                }
              }
            ]
          }
        ]
      }
    ]
  };
}

test("expands wrapped texture matrix keyframe aliases into transform curves", () => {
  const scene = normalizeFbxScene(wrappedTextureMatrixScene());

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureTranslation",
    "textureRotation",
    "textureScale"
  ]);
  assertVectorClose(scene.animations[0].tracks[0].keyframes[0].value, [0.125, -0.25, 0]);
  assertVectorClose(scene.animations[0].tracks[1].keyframes[0].value, [0, 0, 0.5]);
  assertVectorClose(scene.animations[0].tracks[2].keyframes[0].value, [2, 3, 1]);
  assertVectorClose(scene.animations[0].tracks[0].keyframes[1].value, [0.25, 0.5, 0]);
  assertVectorClose(scene.animations[0].tracks[1].keyframes[1].value, [0, 0, 0.75]);
  assertVectorClose(scene.animations[0].tracks[2].keyframes[1].value, [4, 5, 1]);
  assertVectorClose(scene.animations[0].tracks[0].keyframes[2].value, [0.375, 0.625, 0]);
  assertVectorClose(scene.animations[0].tracks[1].keyframes[2].value, [0, 0, 1]);
  assertVectorClose(scene.animations[0].tracks[2].keyframes[2].value, [6, 7, 1]);
});
