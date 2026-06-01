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
  Texture,
  VectorKeyframeTrack
} from "three";
import { createStaticMeshFbxDocument, exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import {
  customTextureAnimationProperty,
  customTextureVectorComponentAnimationProperty,
  normalizeCustomTextureProperties
} from "../src/texture-custom-properties.js";
import { decode } from "./fbx-test-helpers.js";

function textureCustomPropertiesFixture() {
  return [
    { name: "Maya|texture_gain", value: 0.65 },
    { name: "Maya|texture_tint", kind: "color", value: [0.25, 0.5, 0.75] },
    { name: "Maya|scroll_vector", kind: "vector", value: [1, 2, 3] },
    { name: "Maya|enabled", kind: "boolean", value: true },
    { name: "Maya|source_label", kind: "string", value: "paint" }
  ];
}

function customTextureScene({ animated = false, sourceCustomProperties = false } = {}) {
  const diffuseTexture = {
    name: "painted_checker",
    fileName: "checker.tga"
  };
  if (sourceCustomProperties) {
    diffuseTexture.source = {
      data: {
        customProperties: textureCustomPropertiesFixture()
      }
    };
  } else {
    diffuseTexture.customProperties = textureCustomPropertiesFixture();
  }

  const scene = {
    name: "CustomTextureScene",
    meshes: [
      {
        name: "CustomTextureQuad",
        materials: [
          {
            name: "CustomTextureMaterial",
            diffuseTexture
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
        name: "TextureCustoms",
        frameRate: 30,
        tracks: [
          {
            target: "painted_checker",
            property: customTextureAnimationProperty("scalar", "Maya|texture_gain"),
            keyframes: [
              { frame: 0, value: 0.65 },
              { frame: 30, value: { "Maya|texture_gain": 1 } }
            ]
          },
          {
            target: "painted_checker",
            property: customTextureAnimationProperty("color", "Maya|texture_tint"),
            keyframes: [
              { frame: 0, value: [0.25, 0.5, 0.75] },
              { frame: 30, value: { "Maya|texture_tint": [1, 0.75, 0.5] } }
            ]
          },
          {
            target: "painted_checker",
            property: customTextureVectorComponentAnimationProperty("Maya|scroll_vector", 1),
            keyframes: [
              { frame: 0, value: 2 },
              { frame: 30, value: { "Maya|scroll_vector": [3, 4, 5] } }
            ]
          }
        ]
      }
    ];
  }

  return scene;
}

function threeQuadGeometry() {
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

function threeCustomTextureScene({
  directCustomProperties = false,
  materialAnimations = false,
  sourceCustomProperties = false,
  sourceTextureAnimations = false,
  textureAnimations = false
} = {}) {
  const texture = new Texture({ src: "checker.tga", name: "checker_image" });
  texture.name = "painted_checker";
  const customProperties = {
    "Maya|texture_gain": { value: 0.65 },
    "Maya|texture_tint": { kind: "color", value: [0.25, 0.5, 0.75] },
    "Maya|scroll_vector": { kind: "vector", value: [1, 2, 3] }
  };
  const customPropertyPath = sourceCustomProperties
    ? "source.customProperties"
    : directCustomProperties ? "customProperties" : "userData.customProperties";
  if (sourceCustomProperties) {
    texture.source.customProperties = customProperties;
  } else if (directCustomProperties) {
    texture.customProperties = customProperties;
  } else {
    texture.userData.customProperties = customProperties;
  }

  if (textureAnimations) {
    texture.animations = [
      new AnimationClip("TextureOwnedCustoms", 1, [
        new NumberKeyframeTrack(`${customPropertyPath}[Maya|texture_gain].value`, [0, 1], [0.65, 1]),
        new NumberKeyframeTrack(`${customPropertyPath}[Maya|texture_tint].value.r`, [0, 1], [0.25, 1])
      ])
    ];
  }
  if (sourceTextureAnimations) {
    texture.source.animations = [
      new AnimationClip("TextureSourceOwnedCustoms", 1, [
        new NumberKeyframeTrack("customProperties[Maya|texture_gain].value", [0, 1], [0.65, 1]),
        new NumberKeyframeTrack("customProperties[Maya|texture_tint].value.r", [0, 1], [0.25, 1])
      ])
    ];
  }

  const material = new MeshBasicMaterial({ name: "CustomTextureMaterial", map: texture });
  const mesh = new Mesh(threeQuadGeometry(), material);
  mesh.name = "ThreeCustomTextureQuad";

  if (materialAnimations) {
    mesh.animations = [
      new AnimationClip("MaterialPathTextureCustoms", 1, [
        new NumberKeyframeTrack(`ThreeCustomTextureQuad.material.map.${customPropertyPath}[Maya|texture_gain].value`, [0, 1], [0.65, 1]),
        new ColorKeyframeTrack(`ThreeCustomTextureQuad.material.map.${customPropertyPath}[Maya|texture_tint].value`, [0, 1], [
          0.25, 0.5, 0.75,
          1, 0.75, 0.5
        ]),
        new NumberKeyframeTrack(`ThreeCustomTextureQuad.material.map.${customPropertyPath}[Maya|texture_tint].value.r`, [0, 1], [0.25, 1]),
        new VectorKeyframeTrack(`ThreeCustomTextureQuad.material.map.${customPropertyPath}[Maya|scroll_vector].value[1]`, [0, 1], [
          1, 2, 3,
          3, 4, 5
        ])
      ])
    ];
  }

  const scene = new Scene();
  scene.name = "ThreeCustomTextureScene";
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

test("normalizes texture custom properties from arrays and object maps", () => {
  const properties = normalizeCustomTextureProperties({
    "Maya|gain": 0.5,
    "Maya|tint": { value: { r: 0.1, g: 0.2, b: 0.3 } },
    "Maya|scroll": { kind: "vector", value: [1, 2, 3] },
    "Maya|enabled": true,
    "Maya|label": "paint"
  });

  assert.deepEqual(properties.map((property) => [property.name, property.kind, property.value]), [
    ["Maya|gain", "scalar", 0.5],
    ["Maya|tint", "color", [0.1, 0.2, 0.3]],
    ["Maya|scroll", "vector", [1, 2, 3]],
    ["Maya|enabled", "boolean", 1],
    ["Maya|label", "string", "paint"]
  ]);
});

test("writes custom texture properties into FBX Texture and Video nodes", () => {
  const scene = normalizeFbxScene(customTextureScene());
  const texture = scene.meshes[0].materials[0].textures[0];

  assert.deepEqual(texture.customProperties.map((property) => [property.name, property.kind]), [
    ["Maya|texture_gain", "scalar"],
    ["Maya|texture_tint", "color"],
    ["Maya|scroll_vector", "vector"],
    ["Maya|enabled", "boolean"],
    ["Maya|source_label", "string"]
  ]);

  const text = decode(exportFbx(customTextureScene()));
  assert.match(text, /Maya\|texture_gain/);
  assert.match(text, /Maya\|texture_tint/);
  assert.match(text, /Maya\|scroll_vector/);
  assert.match(text, /Maya\|enabled/);
  assert.match(text, /Maya\|source_label/);

  const nodes = createStaticMeshFbxDocument(customTextureScene());
  const textureProperties = propertyNames(documentNodes(nodes, "Texture")[0]);
  const videoProperties = propertyNames(documentNodes(nodes, "Video")[0]);
  for (const name of ["Maya|texture_gain", "Maya|texture_tint", "Maya|scroll_vector", "Maya|enabled", "Maya|source_label"]) {
    assert.ok(textureProperties.includes(name), `Texture node should include ${name}`);
    assert.ok(videoProperties.includes(name), `Video node should include ${name}`);
  }
});

test("normalizes source-owned internal texture custom properties", () => {
  const scene = normalizeFbxScene(customTextureScene({ sourceCustomProperties: true }));
  const texture = scene.meshes[0].materials[0].textures[0];

  assert.deepEqual(texture.customProperties.map((property) => [property.name, property.kind, property.value]), [
    ["Maya|texture_gain", "scalar", 0.65],
    ["Maya|texture_tint", "color", [0.25, 0.5, 0.75]],
    ["Maya|scroll_vector", "vector", [1, 2, 3]],
    ["Maya|enabled", "boolean", 1],
    ["Maya|source_label", "string", "paint"]
  ]);
});

test("routes custom texture property animation to Texture objects", () => {
  const scene = normalizeFbxScene(customTextureScene({ animated: true }));
  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["painted_checker", "customTextureScalar:Maya|texture_gain"],
    ["painted_checker", "customTextureColor:Maya|texture_tint"],
    ["painted_checker", "customTextureVectorComponent:Maya|scroll_vector:1"]
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes.map((keyframe) => keyframe.value), [0.65, 1]);
  assert.deepEqual(scene.animations[0].tracks[1].keyframes[1].value, [1, 0.75, 0.5]);
  assert.deepEqual(scene.animations[0].tracks[2].keyframes.map((keyframe) => keyframe.value), [2, 4]);

  const nodes = createStaticMeshFbxDocument(customTextureScene({ animated: true }));
  const connections = documentNodes(nodes, "Connections")[0];
  const textureNode = documentNodes(nodes, "Texture")[0];
  const animatedPropertyNames = connections.children
    .filter((node) => node.properties[0] === "OP" && node.properties[2].value === textureNode.properties[0].value)
    .map((node) => node.properties[3]);

  assert.deepEqual(animatedPropertyNames.sort(), [
    "Maya|scroll_vector",
    "Maya|texture_gain",
    "Maya|texture_tint"
  ]);
});

test("adapts Three.js texture custom properties into normalized texture records", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomTextureScene()));
  const texture = scene.meshes[0].materials[0].textures[0];

  assert.deepEqual(texture.customProperties.map((property) => [property.name, property.kind, property.value]), [
    ["Maya|texture_gain", "scalar", 0.65],
    ["Maya|texture_tint", "color", [0.25, 0.5, 0.75]],
    ["Maya|scroll_vector", "vector", [1, 2, 3]]
  ]);
});

test("adapts Three.js direct texture custom properties into normalized texture records", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomTextureScene({ directCustomProperties: true })));
  const texture = scene.meshes[0].materials[0].textures[0];

  assert.deepEqual(texture.customProperties.map((property) => [property.name, property.kind, property.value]), [
    ["Maya|texture_gain", "scalar", 0.65],
    ["Maya|texture_tint", "color", [0.25, 0.5, 0.75]],
    ["Maya|scroll_vector", "vector", [1, 2, 3]]
  ]);
});

test("adapts Three.js source-owned texture custom properties into normalized texture records", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomTextureScene({ sourceCustomProperties: true })));
  const texture = scene.meshes[0].materials[0].textures[0];

  assert.deepEqual(texture.customProperties.map((property) => [property.name, property.kind, property.value]), [
    ["Maya|texture_gain", "scalar", 0.65],
    ["Maya|texture_tint", "color", [0.25, 0.5, 0.75]],
    ["Maya|scroll_vector", "vector", [1, 2, 3]]
  ]);
});

test("adapts Three.js material-path texture custom property animation", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomTextureScene({ materialAnimations: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["painted_checker", "customTextureScalar:Maya|texture_gain"],
    ["painted_checker", "customTextureColor:Maya|texture_tint"],
    ["painted_checker", "customTextureVectorComponent:Maya|texture_tint:0"],
    ["painted_checker", "customTextureVectorComponent:Maya|scroll_vector:1"]
  ]);
  assert.equal(scene.animations[0].tracks[3].keyframes[1].value, 4);
});

test("adapts Three.js material-path direct texture custom property animation", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomTextureScene({
    directCustomProperties: true,
    materialAnimations: true
  }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["painted_checker", "customTextureScalar:Maya|texture_gain"],
    ["painted_checker", "customTextureColor:Maya|texture_tint"],
    ["painted_checker", "customTextureVectorComponent:Maya|texture_tint:0"],
    ["painted_checker", "customTextureVectorComponent:Maya|scroll_vector:1"]
  ]);
  assert.equal(scene.animations[0].tracks[3].keyframes[1].value, 4);
});

test("adapts Three.js material-path source-owned texture custom property animation", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomTextureScene({
    sourceCustomProperties: true,
    materialAnimations: true
  }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["painted_checker", "customTextureScalar:Maya|texture_gain"],
    ["painted_checker", "customTextureColor:Maya|texture_tint"],
    ["painted_checker", "customTextureVectorComponent:Maya|texture_tint:0"],
    ["painted_checker", "customTextureVectorComponent:Maya|scroll_vector:1"]
  ]);
  assert.equal(scene.animations[0].tracks[3].keyframes[1].value, 4);
});

test("adapts Three.js texture-owned custom property animation clips", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomTextureScene({ textureAnimations: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["painted_checker", "customTextureScalar:Maya|texture_gain"],
    ["painted_checker", "customTextureVectorComponent:Maya|texture_tint:0"]
  ]);
});

test("adapts Three.js source-owned texture custom property animation clips", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomTextureScene({
    sourceCustomProperties: true,
    sourceTextureAnimations: true
  }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["painted_checker", "customTextureScalar:Maya|texture_gain"],
    ["painted_checker", "customTextureVectorComponent:Maya|texture_tint:0"]
  ]);
});

test("adapts Three.js texture-owned direct custom property animation clips", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeCustomTextureScene({
    directCustomProperties: true,
    textureAnimations: true
  }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["painted_checker", "customTextureScalar:Maya|texture_gain"],
    ["painted_checker", "customTextureVectorComponent:Maya|texture_tint:0"]
  ]);
});
