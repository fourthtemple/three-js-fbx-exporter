import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeFbxScene } from "../src/index.js";
import { roughnessToFbxShininess } from "../src/material-normalizer.js";

function materialScalarKeyframeScene() {
  return {
    name: "MaterialScalarKeyframeScene",
    meshes: [
      {
        name: "Quad",
        materials: [
          {
            name: "PayloadMat",
            opacity: 1,
            roughness: 0.7,
            metalness: 0.1
          }
        ],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          materialIndices: [0]
        }
      }
    ],
    animations: [
      {
        name: "MaterialPayloads",
        frameRate: 30,
        tracks: [
          {
            target: "PayloadMat",
            property: "opacity",
            keyframes: [
              { frame: 0, value: { alpha: 1 } },
              { frame: 30, value: { materialOpacity: 0.25 } }
            ]
          },
          {
            target: "PayloadMat",
            property: "transmission",
            keyframes: [
              { frame: 0, value: { transmission: 0.1 } },
              { frame: 30, value: { materialTransmission: 0.45 } }
            ]
          },
          {
            target: "PayloadMat",
            property: "roughness",
            keyframes: [
              { frame: 0, value: { roughness: 0.7 } },
              { frame: 30, value: { materialRoughness: 0.2 } }
            ]
          },
          {
            target: "PayloadMat",
            property: "metalness",
            keyframes: [
              { frame: 0, value: { metalness: 0.1 } },
              { frame: 30, materialMetalness: 0.8 }
            ]
          }
        ]
      }
    ]
  };
}

test("normalizes object-valued material scalar keyframes", () => {
  const scene = normalizeFbxScene(materialScalarKeyframeScene());

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "opacity",
    "transparencyFactor",
    "shininess",
    "reflectionFactor"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.keyframes.map((keyframe) => keyframe.value)), [
    [1, 0.25],
    [0.1, 0.45],
    [roughnessToFbxShininess(0.7), roughnessToFbxShininess(0.2)],
    [0.1, 0.8]
  ]);
});
