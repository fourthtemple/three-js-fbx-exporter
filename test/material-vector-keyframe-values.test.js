import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeFbxScene } from "../src/index.js";

function materialVectorKeyframeScene() {
  return {
    name: "MaterialVectorKeyframeScene",
    meshes: [
      {
        name: "Quad",
        materials: [
          {
            name: "VectorMat",
            diffuseColor: [1, 0, 0],
            emissiveColor: [0, 0, 0],
            clippingPlanes: [
              { normal: [0, 1, 0], constant: 0 }
            ]
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
        name: "MaterialVectors",
        frameRate: 30,
        tracks: [
          {
            target: "VectorMat",
            property: "color",
            keyframes: [
              { frame: 0, value: { color: [1, 0, 0] } },
              { frame: 30, value: { materialDiffuseColor: { r: 0.1, g: 0.4, b: 0.9 } } }
            ]
          },
          {
            target: "VectorMat",
            property: "emissiveColorB",
            keyframes: [
              { frame: 0, value: { materialEmissiveColor: [0.1, 0.2, 0.3] } },
              { frame: 30, value: { materialEmissiveColorB: 0.8 } }
            ]
          },
          {
            target: "VectorMat",
            property: "clippingPlane0Normal",
            keyframes: [
              { frame: 0, value: { materialClippingPlane0Normal: [0, 1, 0] } },
              { frame: 30, value: { value: { clippingPlane0Normal: [0.5, 0.25, 0.75] } } }
            ]
          },
          {
            target: "VectorMat",
            property: "clippingPlane0NormalY",
            keyframes: [
              { frame: 0, value: { clippingPlane0Normal: [0, 1, 0] } },
              { frame: 30, value: { materialClippingPlane0NormalY: 0.25 } }
            ]
          }
        ]
      }
    ]
  };
}

test("normalizes object-valued material vector and component keyframes", () => {
  const scene = normalizeFbxScene(materialVectorKeyframeScene());

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "diffuseColor",
    "emissiveColorB",
    "clippingPlane0Normal",
    "clippingPlane0NormalY"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.keyframes.map((keyframe) => keyframe.value)), [
    [[1, 0, 0], [0.1, 0.4, 0.9]],
    [0.3, 0.8],
    [[0, 1, 0], [0.5, 0.25, 0.75]],
    [1, 0.25]
  ]);
});
