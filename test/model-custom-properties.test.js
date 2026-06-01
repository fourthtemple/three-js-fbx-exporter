import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AnimationClip,
  BufferGeometry,
  ColorKeyframeTrack,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  NumberKeyframeTrack,
  Scene
} from "three";

import { createStaticMeshFbxDocument, exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import {
  customModelAnimationProperty,
  customModelVectorComponentAnimationProperty,
  normalizeCustomModelProperties
} from "../src/model-custom-properties.js";
import { decode } from "./fbx-test-helpers.js";

function customModelScene({ animated = false } = {}) {
  const scene = {
    name: "CustomModelScene",
    meshes: [
      {
        name: "CustomModelQuad",
        customProperties: [
          { name: "Maya|model_gain", value: 0.65 },
          { name: "Maya|model_tint", kind: "color", value: [0.25, 0.5, 0.75] },
          { name: "Maya|flow_vector", kind: "vector", value: [1, 2, 3] },
          { name: "Maya|enabled", kind: "boolean", value: true },
          { name: "Maya|source_label", kind: "string", value: "rig" }
        ],
        materials: [{ name: "CustomModelMaterial" }],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0]
        }
      }
    ]
  };

  if (animated) {
    scene.animations = [
      {
        name: "ModelCustoms",
        frameRate: 30,
        tracks: [
          {
            target: "CustomModelQuad",
            property: customModelAnimationProperty("scalar", "Maya|model_gain"),
            keyframes: [
              { frame: 0, value: 0.65 },
              { frame: 30, value: 1 }
            ]
          },
          {
            target: "CustomModelQuad",
            property: customModelAnimationProperty("color", "Maya|model_tint"),
            keyframes: [
              { frame: 0, value: [0.25, 0.5, 0.75] },
              { frame: 30, value: [1, 0.75, 0.5] }
            ]
          },
          {
            target: "CustomModelQuad",
            property: customModelVectorComponentAnimationProperty("Maya|flow_vector", 2),
            keyframes: [
              { frame: 0, value: 3 },
              { frame: 30, value: 6 }
            ]
          }
        ]
      }
    ];
  }

  return scene;
}

function quadGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0,
    -1, 1, 0
  ], 3));
  geometry.setAttribute("uv", new Float32BufferAttribute([
    0, 0,
    1, 0,
    1, 1,
    0, 1
  ], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
}

function threeCustomModelScene({
  directCustomProperties = false,
  localAnimations = false,
  userDataOwnedAnimations = false,
  namedAnimations = false
} = {}) {
  const material = new MeshBasicMaterial({ name: "CustomModelMaterial" });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "ThreeCustomModelQuad";
  const customProperties = {
    "Maya|model_gain": { value: 0.65 },
    "Maya|model_tint": { kind: "color", value: [0.25, 0.5, 0.75] },
    "Maya|flow_vector": { kind: "vector", value: [1, 2, 3] }
  };
  const customPropertyPath = directCustomProperties ? "customProperties" : "userData.customProperties";
  if (directCustomProperties) {
    mesh.customProperties = customProperties;
  } else {
    mesh.userData.customProperties = customProperties;
  }

  if (localAnimations) {
    mesh.animations = [
      new AnimationClip("ModelOwnedCustoms", 1, [
        new NumberKeyframeTrack(`${customPropertyPath}[Maya|model_gain].value`, [0, 1], [0.65, 1])
      ])
    ];
  }

  if (userDataOwnedAnimations) {
    mesh.userData.animations = [
      new AnimationClip("ModelUserDataOwnedCustoms", 1, [
        new NumberKeyframeTrack(`${customPropertyPath}[Maya|model_gain].value`, [0, 1], [0.65, 0.95])
      ])
    ];
  }

  if (namedAnimations) {
    mesh.animations = [
      new AnimationClip("ModelPathCustoms", 1, [
        new NumberKeyframeTrack(`ThreeCustomModelQuad.${customPropertyPath}[Maya|model_gain].value`, [0, 1], [0.65, 1]),
        new ColorKeyframeTrack(`ThreeCustomModelQuad.${customPropertyPath}[Maya|model_tint].value`, [0, 1], [
          0.25, 0.5, 0.75,
          1, 0.75, 0.5
        ]),
        new NumberKeyframeTrack(`ThreeCustomModelQuad.${customPropertyPath}[Maya|flow_vector].value[2]`, [0, 1], [3, 6])
      ])
    ];
  }

  const scene = new Scene();
  scene.name = "ThreeCustomModelScene";
  scene.add(mesh);
  return scene;
}

function childNodes(node, name) {
  return node.children.flatMap((child) => [
    ...(child.name === name ? [child] : []),
    ...childNodes(child, name)
  ]);
}

function documentNodes(nodes, name) {
  return nodes.flatMap((node) => [
    ...(node.name === name ? [node] : []),
    ...childNodes(node, name)
  ]);
}

function properties70(node) {
  return childNodes(node, "Properties70")[0];
}

function propertyNames(node) {
  return properties70(node).children
    .filter((property) => property.name === "P")
    .map((property) => property.properties[0]);
}

function meshModelNode(nodes) {
  return documentNodes(nodes, "Model").find((node) => node.properties[2] === "Mesh");
}

test("normalizes model custom properties from arrays and object maps", () => {
  const properties = normalizeCustomModelProperties({
    "Maya|gain": 0.5,
    "Maya|tint": { value: { r: 0.1, g: 0.2, b: 0.3 } },
    "Maya|flow": { kind: "vector", value: [1, 2, 3] },
    "Maya|enabled": true,
    "Maya|label": "rig"
  });

  assert.deepEqual(properties.map((property) => [property.name, property.kind, property.value]), [
    ["Maya|gain", "scalar", 0.5],
    ["Maya|tint", "color", [0.1, 0.2, 0.3]],
    ["Maya|flow", "vector", [1, 2, 3]],
    ["Maya|enabled", "boolean", 1],
    ["Maya|label", "string", "rig"]
  ]);
});

test("writes custom model properties into FBX Model nodes", () => {
  const scene = normalizeFbxScene(customModelScene());
  const mesh = scene.meshes[0];

  assert.deepEqual(mesh.customProperties.map((property) => [property.name, property.kind]), [
    ["Maya|model_gain", "scalar"],
    ["Maya|model_tint", "color"],
    ["Maya|flow_vector", "vector"],
    ["Maya|enabled", "boolean"],
    ["Maya|source_label", "string"]
  ]);

  const text = decode(exportFbx(customModelScene()));
  assert.match(text, /Maya\|model_gain/);
  assert.match(text, /Maya\|model_tint/);
  assert.match(text, /Maya\|flow_vector/);
  assert.match(text, /Maya\|enabled/);
  assert.match(text, /Maya\|source_label/);

  const modelProperties = propertyNames(meshModelNode(createStaticMeshFbxDocument(customModelScene())));
  for (const name of ["Maya|model_gain", "Maya|model_tint", "Maya|flow_vector", "Maya|enabled", "Maya|source_label"]) {
    assert.ok(modelProperties.includes(name), `Model node should include ${name}`);
  }
});

test("routes custom model property animation to Model objects", () => {
  const scene = normalizeFbxScene(customModelScene({ animated: true }));
  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["CustomModelQuad", "customModelScalar:Maya|model_gain"],
    ["CustomModelQuad", "customModelColor:Maya|model_tint"],
    ["CustomModelQuad", "customModelVectorComponent:Maya|flow_vector:2"]
  ]);

  const nodes = createStaticMeshFbxDocument(customModelScene({ animated: true }));
  const connections = documentNodes(nodes, "Connections")[0];
  const modelNode = meshModelNode(nodes);
  const animatedPropertyNames = connections.children
    .filter((node) => node.properties[0] === "OP" && node.properties[2].value === modelNode.properties[0].value)
    .map((node) => node.properties[3]);

  assert.deepEqual(animatedPropertyNames.sort(), [
    "Maya|flow_vector",
    "Maya|model_gain",
    "Maya|model_tint"
  ]);
});

test("adapts Three.js model custom properties into normalized model records", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomModelScene()));
  const mesh = scene.meshes[0];

  assert.deepEqual(mesh.customProperties.map((property) => [property.name, property.kind, property.value]), [
    ["Maya|model_gain", "scalar", 0.65],
    ["Maya|model_tint", "color", [0.25, 0.5, 0.75]],
    ["Maya|flow_vector", "vector", [1, 2, 3]]
  ]);
});

test("adapts Three.js direct model custom properties into normalized model records", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomModelScene({ directCustomProperties: true })));
  const mesh = scene.meshes[0];

  assert.deepEqual(mesh.customProperties.map((property) => [property.name, property.kind, property.value]), [
    ["Maya|model_gain", "scalar", 0.65],
    ["Maya|model_tint", "color", [0.25, 0.5, 0.75]],
    ["Maya|flow_vector", "vector", [1, 2, 3]]
  ]);
});

test("adapts Three.js model-path custom property animation", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomModelScene({ namedAnimations: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["ThreeCustomModelQuad", "customModelScalar:Maya|model_gain"],
    ["ThreeCustomModelQuad", "customModelColor:Maya|model_tint"],
    ["ThreeCustomModelQuad", "customModelVectorComponent:Maya|flow_vector:2"]
  ]);
});

test("adapts Three.js model-owned local custom property animation clips", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomModelScene({ localAnimations: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["ThreeCustomModelQuad", "customModelScalar:Maya|model_gain"]
  ]);
});

test("adapts Three.js model userData-owned local custom property animation clips", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomModelScene({ userDataOwnedAnimations: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations.map((clip) => clip.name), ["ModelUserDataOwnedCustoms"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["ThreeCustomModelQuad", "customModelScalar:Maya|model_gain"]
  ]);
  assert.ok(Math.abs(scene.animations[0].tracks[0].keyframes[1].value - 0.95) < 1e-6);
});
