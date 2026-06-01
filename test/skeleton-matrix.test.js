import assert from "node:assert/strict";
import { test } from "node:test";
import { createStaticMeshFbxDocument, exportFbx } from "../src/index.js";
import {
  identityMatrix,
  inverseAffineMatrix,
  matrixFromQuaternion,
  multiplyMatrices,
  transformMatrix
} from "../src/core/transform-matrix.js";
import { arrayBufferFrom, withMockDocument } from "./fbx-test-helpers.js";

function assertClose(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} not close to ${expected}`);
}

function assertMatrixClose(actual, expected, epsilon = 1e-6) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assertClose(value, expected[index], epsilon));
}

function rotatedSkeletonScene() {
  return {
    name: "RotatedSkeletonScene",
    meshes: [
      {
        name: "Body",
        materials: [{ name: "BodyMat" }],
        geometry: {
          vertices: [-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0]
        },
        skin: {
          bones: [
            {
              name: "Root",
              transform: {
                translation: [0, 0, 0],
                rotation: [0, 0, 90],
                scale: [1, 1, 1]
              }
            },
            {
              name: "Spine",
              parent: "Root",
              transform: {
                translation: [0, 1, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1]
              }
            }
          ],
          clusters: [
            { bone: "Root", indices: [0, 1], weights: [1, 1] },
            { bone: "Spine", indices: [2, 3], weights: [1, 1] }
          ]
        }
      }
    ]
  };
}

function explicitBindMatrixScene() {
  const meshBind = transformMatrix({ translation: [5, 0, 0] });
  const spineBind = transformMatrix({ translation: [0, 2, 0] });
  return {
    name: "ExplicitBindMatrixScene",
    meshes: [
      {
        name: "Body",
        materials: [{ name: "BodyMat" }],
        geometry: {
          vertices: [-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0]
        },
        skin: {
          bindMatrix: meshBind,
          bones: [
            {
              name: "Root",
              transform: { translation: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }
            },
            {
              name: "Spine",
              parent: "Root",
              inverseBindMatrix: inverseAffineMatrix(spineBind),
              transform: { translation: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }
            }
          ],
          clusters: [
            { bone: "Root", indices: [0, 1], weights: [1, 1] },
            { bone: "Spine", indices: [2, 3], weights: [1, 1] }
          ]
        }
      }
    ]
  };
}

function flattenNodes(nodes) {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}

function nodeClassName(node) {
  return String(node.properties[1] || "").split("\0")[0];
}

function clusterNode(document, name) {
  return flattenNodes(document)
    .filter((node) => node.name === "Deformer" && node.properties[2] === "Cluster")
    .find((node) => nodeClassName(node) === name);
}

function childArray(node, name) {
  return node.children.find((child) => child.name === name).properties[0].value;
}

test("transform matrices compose and invert full TRS values", () => {
  const root = transformMatrix({ rotation: [0, 0, 90], scale: [1, 1, 1] });
  const child = transformMatrix({ translation: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] });
  const global = multiplyMatrices(root, child);

  assertClose(global[12], -1);
  assertClose(global[13], 0);
  assertClose(global[0], 0);
  assertClose(global[1], 1);
  assertMatrixClose(multiplyMatrices(inverseAffineMatrix(global), global), identityMatrix());
});

test("quaternion matrices preserve zero scalar components", () => {
  assertMatrixClose(
    matrixFromQuaternion({ x: 0, y: 1, z: 0, w: 0 }),
    transformMatrix({ rotation: [0, 180, 0] })
  );
});

test("exports full TransformLink matrices for rotated bind bones", () => {
  const document = createStaticMeshFbxDocument(rotatedSkeletonScene());
  const spineCluster = clusterNode(document, "Spine");
  const transformLink = childArray(spineCluster, "TransformLink");

  assertClose(transformLink[12], -1);
  assertClose(transformLink[13], 0);
  assertClose(transformLink[0], 0);
  assertClose(transformLink[1], 1);
});

test("exports explicit mesh and inverse bone bind matrices when supplied", () => {
  const document = createStaticMeshFbxDocument(explicitBindMatrixScene());
  const spineCluster = clusterNode(document, "Spine");
  const transform = childArray(spineCluster, "Transform");
  const transformLink = childArray(spineCluster, "TransformLink");

  assertClose(transformLink[12], 0);
  assertClose(transformLink[13], 2);
  assertClose(transform[12], 5);
  assertClose(transform[13], -2);
});

test("Three.js FBXLoader still parses rotated bind skeletons", async () => {
  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(rotatedSkeletonScene())), "");
    const skinned = [];
    group.traverse((object) => {
      if (object.isSkinnedMesh) {
        skinned.push(object);
      }
    });

    assert.equal(skinned.length, 1);
    assert.deepEqual(skinned[0].skeleton.bones.map((bone) => bone.name), ["Root", "Spine"]);
    assert.ok(skinned[0].geometry.attributes.skinIndex);
    assert.ok(skinned[0].geometry.attributes.skinWeight);
  });
});
