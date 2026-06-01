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
  Scene,
  VectorKeyframeTrack
} from "three";

import { createStaticMeshFbxDocument, exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import {
  customMaterialAnimationProperty,
  customMaterialVectorComponentAnimationProperty,
  normalizeCustomMaterialProperties
} from "../src/material/material-custom-properties.js";
import { decode } from "./fbx-test-helpers.js";

function customMaterialScene({ animated = false } = {}) {
  const scene = {
    name: "CustomMaterialScene",
    meshes: [
      {
        name: "CustomMaterialQuad",
        materials: [
          {
            name: "CustomMaterial",
            customProperties: [
              { name: "Maya|material_gain", value: 0.65 },
              { name: "Maya|material_tint", kind: "color", value: [0.25, 0.5, 0.75] },
              { name: "Maya|flow_vector", kind: "vector", value: [1, 2, 3] },
              { name: "Maya|enabled", kind: "boolean", value: true },
              { name: "Maya|source_label", kind: "string", value: "paint" }
            ]
          }
        ],
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
        name: "MaterialCustoms",
        frameRate: 30,
        tracks: [
          {
            target: "CustomMaterial",
            property: customMaterialAnimationProperty("scalar", "Maya|material_gain"),
            keyframes: [
              { frame: 0, value: 0.65 },
              { frame: 30, value: 1 }
            ]
          },
          {
            target: "CustomMaterial",
            property: customMaterialAnimationProperty("color", "Maya|material_tint"),
            keyframes: [
              { frame: 0, value: [0.25, 0.5, 0.75] },
              { frame: 30, value: [1, 0.75, 0.5] }
            ]
          },
          {
            target: "CustomMaterial",
            property: customMaterialVectorComponentAnimationProperty("Maya|flow_vector", 2),
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

function threeCustomMaterialScene({
  directCustomProperties = false,
  dotCustomPropertyPaths = false,
  materialAnimations = false,
  materialUserDataAnimations = false,
  meshAnimations = false
} = {}) {
  const material = new MeshBasicMaterial({ name: "CustomMaterial" });
  const customProperties = {
    "Maya|material_gain": { value: 0.65 },
    "Maya|material_tint": { kind: "color", value: [0.25, 0.5, 0.75] },
    "Maya|flow_vector": { kind: "vector", value: [1, 2, 3] }
  };
  const customPropertyPath = directCustomProperties ? "customProperties" : "userData.customProperties";
  if (directCustomProperties) {
    material.customProperties = customProperties;
  } else {
    material.userData.customProperties = customProperties;
  }

  const customPropertyTrackPath = (name, suffix = "") => {
    const propertyPath = dotCustomPropertyPaths
      ? `${customPropertyPath}.${name}`
      : `${customPropertyPath}[${name}]`;
    return `${propertyPath}.value${suffix}`;
  };

  if (materialAnimations) {
    material.animations = [
      new AnimationClip("MaterialOwnedCustoms", 1, [
        new NumberKeyframeTrack(customPropertyTrackPath("Maya|material_gain"), [0, 1], [0.65, 1])
      ])
    ];
  }
  if (materialUserDataAnimations) {
    material.userData.animations = [
      new AnimationClip("MaterialUserDataOwnedCustoms", 1, [
        new NumberKeyframeTrack("customProperties[Maya|material_gain].value", [0, 1], [0.65, 0.9])
      ])
    ];
  }

  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "ThreeCustomMaterialQuad";
  if (meshAnimations) {
    mesh.animations = [
      new AnimationClip("MeshMaterialCustoms", 1, [
        new NumberKeyframeTrack(`ThreeCustomMaterialQuad.material.${customPropertyTrackPath("Maya|material_gain")}`, [0, 1], [0.65, 1]),
        new ColorKeyframeTrack(`ThreeCustomMaterialQuad.material.${customPropertyTrackPath("Maya|material_tint")}`, [0, 1], [
          0.25, 0.5, 0.75,
          1, 0.75, 0.5
        ]),
        new VectorKeyframeTrack(`ThreeCustomMaterialQuad.material.${customPropertyTrackPath("Maya|flow_vector", "[2]")}`, [0, 1], [
          1, 2, 3,
          4, 5, 6
        ])
      ])
    ];
  }

  const scene = new Scene();
  scene.name = "ThreeCustomMaterialScene";
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

test("normalizes material custom properties from arrays and object maps", () => {
  const properties = normalizeCustomMaterialProperties({
    "Maya|gain": 0.5,
    "Maya|tint": { value: { r: 0.1, g: 0.2, b: 0.3 } },
    "Maya|flow": { kind: "vector", value: [1, 2, 3] },
    "Maya|enabled": true,
    "Maya|label": "paint"
  });

  assert.deepEqual(properties.map((property) => [property.name, property.kind, property.value]), [
    ["Maya|gain", "scalar", 0.5],
    ["Maya|tint", "color", [0.1, 0.2, 0.3]],
    ["Maya|flow", "vector", [1, 2, 3]],
    ["Maya|enabled", "boolean", 1],
    ["Maya|label", "string", "paint"]
  ]);
});

test("writes custom material properties into FBX Material nodes", () => {
  const scene = normalizeFbxScene(customMaterialScene());
  const material = scene.meshes[0].materials[0];

  assert.deepEqual(material.customProperties.map((property) => [property.name, property.kind]), [
    ["Maya|material_gain", "scalar"],
    ["Maya|material_tint", "color"],
    ["Maya|flow_vector", "vector"],
    ["Maya|enabled", "boolean"],
    ["Maya|source_label", "string"]
  ]);

  const text = decode(exportFbx(customMaterialScene()));
  assert.match(text, /Maya\|material_gain/);
  assert.match(text, /Maya\|material_tint/);
  assert.match(text, /Maya\|flow_vector/);
  assert.match(text, /Maya\|enabled/);
  assert.match(text, /Maya\|source_label/);

  const nodes = createStaticMeshFbxDocument(customMaterialScene());
  const materialProperties = propertyNames(documentNodes(nodes, "Material")[0]);
  for (const name of ["Maya|material_gain", "Maya|material_tint", "Maya|flow_vector", "Maya|enabled", "Maya|source_label"]) {
    assert.ok(materialProperties.includes(name), `Material node should include ${name}`);
  }
});

test("routes custom material property animation to Material objects", () => {
  const scene = normalizeFbxScene(customMaterialScene({ animated: true }));
  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["CustomMaterial", "customMaterialScalar:Maya|material_gain"],
    ["CustomMaterial", "customMaterialColor:Maya|material_tint"],
    ["CustomMaterial", "customMaterialVectorComponent:Maya|flow_vector:2"]
  ]);

  const nodes = createStaticMeshFbxDocument(customMaterialScene({ animated: true }));
  const connections = documentNodes(nodes, "Connections")[0];
  const materialNode = documentNodes(nodes, "Material")[0];
  const animatedPropertyNames = connections.children
    .filter((node) => node.properties[0] === "OP" && node.properties[2].value === materialNode.properties[0].value)
    .map((node) => node.properties[3]);

  assert.deepEqual(animatedPropertyNames.sort(), [
    "Maya|flow_vector",
    "Maya|material_gain",
    "Maya|material_tint"
  ]);
});

test("adapts Three.js material custom properties into normalized material records", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomMaterialScene()));
  const material = scene.meshes[0].materials[0];

  assert.deepEqual(material.customProperties.map((property) => [property.name, property.kind, property.value]), [
    ["Maya|material_gain", "scalar", 0.65],
    ["Maya|material_tint", "color", [0.25, 0.5, 0.75]],
    ["Maya|flow_vector", "vector", [1, 2, 3]]
  ]);
});

test("adapts Three.js direct material custom properties into normalized material records", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomMaterialScene({ directCustomProperties: true })));
  const material = scene.meshes[0].materials[0];

  assert.deepEqual(material.customProperties.map((property) => [property.name, property.kind, property.value]), [
    ["Maya|material_gain", "scalar", 0.65],
    ["Maya|material_tint", "color", [0.25, 0.5, 0.75]],
    ["Maya|flow_vector", "vector", [1, 2, 3]]
  ]);
});

test("adapts Three.js material-path custom property animation", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomMaterialScene({ meshAnimations: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["CustomMaterial", "customMaterialScalar:Maya|material_gain"],
    ["CustomMaterial", "customMaterialColor:Maya|material_tint"],
    ["CustomMaterial", "customMaterialVectorComponent:Maya|flow_vector:2"]
  ]);
  assert.equal(scene.animations[0].tracks[2].keyframes[1].value, 6);
});

test("adapts Three.js material-path direct custom property animation", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomMaterialScene({
    directCustomProperties: true,
    meshAnimations: true
  }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["CustomMaterial", "customMaterialScalar:Maya|material_gain"],
    ["CustomMaterial", "customMaterialColor:Maya|material_tint"],
    ["CustomMaterial", "customMaterialVectorComponent:Maya|flow_vector:2"]
  ]);
  assert.equal(scene.animations[0].tracks[2].keyframes[1].value, 6);
});

test("adapts Three.js material-path dot custom property animation", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomMaterialScene({
    dotCustomPropertyPaths: true,
    meshAnimations: true
  }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["CustomMaterial", "customMaterialScalar:Maya|material_gain"],
    ["CustomMaterial", "customMaterialColor:Maya|material_tint"],
    ["CustomMaterial", "customMaterialVectorComponent:Maya|flow_vector:2"]
  ]);
  assert.equal(scene.animations[0].tracks[2].keyframes[1].value, 6);
});

test("adapts Three.js material-owned custom property animation clips", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomMaterialScene({ materialAnimations: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["CustomMaterial", "customMaterialScalar:Maya|material_gain"]
  ]);
});

test("adapts Three.js material-owned dot custom property animation clips", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomMaterialScene({
    dotCustomPropertyPaths: true,
    materialAnimations: true
  }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["CustomMaterial", "customMaterialScalar:Maya|material_gain"]
  ]);
});

test("adapts Three.js material-owned direct custom property animation clips", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomMaterialScene({
    directCustomProperties: true,
    materialAnimations: true
  }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["CustomMaterial", "customMaterialScalar:Maya|material_gain"]
  ]);
});

test("adapts Three.js material userData-owned custom property animation clips", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomMaterialScene({
    materialUserDataAnimations: true
  }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations.map((clip) => clip.name), ["MaterialUserDataOwnedCustoms"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["CustomMaterial", "customMaterialScalar:Maya|material_gain"]
  ]);
  assert.equal(Number(scene.animations[0].tracks[0].keyframes[1].value.toFixed(4)), 0.9);
});
