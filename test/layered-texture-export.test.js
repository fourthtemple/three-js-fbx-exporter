import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AnimationClip,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshPhysicalMaterial,
  NumberKeyframeTrack,
  Texture,
  VectorKeyframeTrack
} from "three";
import {
  createStaticMeshFbxDocument,
  exportFbx,
  fromThreeObject,
  normalizeFbxScene,
  textureLayerAlphaAnimationProperty,
  textureLayerBlendModeAnimationProperty
} from "../src/index.js";
import { textureLayerScalarKeyframeValue } from "../src/texture-layer-animation-normalizer.js";
import { arrayBufferFrom, decode, withMockDocument } from "./fbx-test-helpers.js";

function layeredTextureScene({ animatedLayerControls = false, sourceLayerControls = false } = {}) {
  const detailTexture = {
    name: "paint_detail",
    fileName: "detail.tga",
    relativeFileName: "detail.tga",
    ...(sourceLayerControls ? {
      source: {
        data: {
          layerBlendMode: "additive",
          layerAlpha: 0.35
        }
      }
    } : {
      blendMode: "additive",
      alpha: 0.35
    })
  };
  const scene = {
    name: "LayeredTextureScene",
    meshes: [
      {
        name: "LayeredQuad",
        materials: [
          {
            name: "LayeredMaterial",
            textures: [
              {
                property: "DiffuseColor",
                texture: {
                  name: "base_color",
                  fileName: "base.tga",
                  relativeFileName: "base.tga",
                  blendMode: "normal",
                  alpha: 1
                }
              },
              {
                property: "DiffuseColor",
                texture: detailTexture
              },
              {
                property: "NormalMap",
                texture: {
                  name: "normal",
                  fileName: "normal.tga",
                  relativeFileName: "normal.tga"
                }
              }
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
  if (animatedLayerControls) {
    scene.animations = [{
      name: "LayerControls",
      frameRate: 30,
      tracks: [
        {
          target: "LayeredMaterialDiffuseColorLayer",
          property: textureLayerAlphaAnimationProperty(1),
          keyframes: [
            { frame: 0, opacity: 0.35 },
            { frame: 30, value: { layerOpacity: 0.8 } }
          ]
        },
        {
          target: "LayeredMaterialDiffuseColorLayer",
          property: textureLayerBlendModeAnimationProperty(1),
          keyframes: [
            { frame: 0, blendMode: "additive" },
            { frame: 30, value: { layerBlendMode: "multiply" } }
          ]
        }
      ]
    }];
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
  geometry.setAttribute("uv2", new Float32BufferAttribute([
    0, 0,
    1, 0,
    1, 1,
    0, 1
  ], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
}

function namedTexture(name) {
  const texture = new Texture();
  texture.name = name;
  texture.userData.src = `${name}.tga`;
  return texture;
}

function propValue(property) {
  return property?.value ?? property;
}

function documentNodes(nodes, name) {
  return nodes.flatMap((node) => [
    ...(node.name === name ? [node] : []),
    ...documentNodes(node.children || [], name)
  ]);
}

function childNode(node, name) {
  return (node.children || []).find((child) => child.name === name);
}

function propertyNames(propertiesNode) {
  return (propertiesNode.children || []).map((node) => propValue(node.properties[0]));
}

function threeLayeredTextureScene({ sourceLayerControls = false } = {}) {
  const material = new MeshPhysicalMaterial({ name: "LayeredThreeMaterial" });
  material.normalMap = namedTexture("surface_normal");
  material.clearcoatNormalMap = namedTexture("clearcoat_normal");
  if (sourceLayerControls) {
    material.clearcoatNormalMap.source.layerAlpha = 0.42;
    material.clearcoatNormalMap.source.layerBlendMode = "additive";
  } else {
    material.clearcoatNormalMap.userData.layerAlpha = 0.42;
    material.clearcoatNormalMap.userData.blendMode = "additive";
  }
  material.roughnessMap = namedTexture("base_roughness");
  material.sheenRoughnessMap = namedTexture("sheen_roughness");
  material.ambientMap = namedTexture("ambient_occlusion");
  material.lightMap = namedTexture("baked_light");

  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "LayeredThreeQuad";
  return mesh;
}

function threeLayeredTextureControlAnimationScene({ sourceLayerTracks = false } = {}) {
  const mesh = threeLayeredTextureScene({ sourceLayerControls: sourceLayerTracks });
  const layerPath = sourceLayerTracks ? "source" : "userData";
  mesh.animations = [
    new AnimationClip("LayeredTextureControls", 1, [
      new NumberKeyframeTrack(`LayeredThreeQuad.material.clearcoatNormalMap.${layerPath}.layerAlpha`, [0, 1], [0.42, 0.75]),
      new NumberKeyframeTrack(`LayeredThreeQuad.material.clearcoatNormalMap.${layerPath}.layerBlendMode`, [0, 1], [1, 2])
    ])
  ];
  return mesh;
}

function threeTextureOwnedLayerControlAnimationScene({ sourceOwned = false } = {}) {
  const mesh = threeLayeredTextureScene({ sourceLayerControls: sourceOwned });
  const owner = sourceOwned ? mesh.material.clearcoatNormalMap.source : mesh.material.clearcoatNormalMap;
  const trackName = sourceOwned ? "layerAlpha" : "userData.layerAlpha";
  owner.animations = [
    new AnimationClip("OwnedLayerControls", 1, [
      new NumberKeyframeTrack(trackName, [0, 1], [0.42, 0.9])
    ])
  ];
  return mesh;
}

function threeLayeredTextureAnimationScene() {
  const mesh = threeLayeredTextureScene();
  mesh.animations = [
    new AnimationClip("LayeredTextureDrift", 1, [
      new VectorKeyframeTrack("LayeredThreeQuad.material.clearcoatNormalMap.offset", [0, 1], [
        0, 0,
        0.1, 0.2
      ]),
      new VectorKeyframeTrack("LayeredThreeQuad.material.sheenRoughnessMap.offset", [0, 1], [
        0, 0,
        0.3, 0.4
      ]),
      new VectorKeyframeTrack("LayeredThreeQuad.material.lightMap.offset", [0, 1], [
        0, 0,
        0.5, 0.6
      ])
    ])
  ];
  return mesh;
}

test("groups repeated material texture properties into FBX layered textures", () => {
  const scene = normalizeFbxScene(layeredTextureScene());
  const material = scene.meshes[0].materials[0];

  assert.deepEqual(material.textures.map((texture) => [texture.name, texture.property, texture.blendMode, texture.alpha]), [
    ["base_color", "DiffuseColor", 0, 1],
    ["paint_detail", "DiffuseColor", 1, 0.35],
    ["normal", "NormalMap", 0, 1]
  ]);

  const text = decode(exportFbx(scene));
  assert.match(text, /LayeredTexture/);
  assert.match(text, /LayeredMaterialDiffuseColorLayer/);
  assert.match(text, /BlendModes/);
  assert.match(text, /Alphas/);
  assert.match(text, /Maya\|layer_alpha_1/);
  assert.match(text, /Maya\|layer_blend_mode_1/);
  assert.match(text, /base\.tga/);
  assert.match(text, /detail\.tga/);
});

test("normalizes source-owned internal layer controls into layered texture state", () => {
  const scene = normalizeFbxScene(layeredTextureScene({ sourceLayerControls: true }));
  const material = scene.meshes[0].materials[0];

  assert.deepEqual(material.textures.map((texture) => [texture.name, texture.property, texture.blendMode, texture.alpha]), [
    ["base_color", "DiffuseColor", 0, 1],
    ["paint_detail", "DiffuseColor", 1, 0.35],
    ["normal", "NormalMap", 0, 1]
  ]);
});

test("normalizes object-valued texture layer keyframe aliases", () => {
  assert.equal(
    textureLayerScalarKeyframeValue({ value: { layerOpacity: 0.8 } }, textureLayerAlphaAnimationProperty(1)),
    0.8
  );
  assert.equal(
    textureLayerScalarKeyframeValue({ value: { value: { textureLayerAlpha: { value: 0.6 } } } }, textureLayerAlphaAnimationProperty(1)),
    0.6
  );
  assert.equal(
    textureLayerScalarKeyframeValue({ value: { textureLayerBlendMode: "multiply" } }, textureLayerBlendModeAnimationProperty(1)),
    2
  );
  assert.equal(
    textureLayerScalarKeyframeValue({ defaultValue: { value: { layerBlendMode: { defaultValue: "additive" } } } }, textureLayerBlendModeAnimationProperty(1)),
    1
  );
});

test("routes layered texture alpha and blend-mode animation to LayeredTexture nodes", () => {
  const scene = normalizeFbxScene(layeredTextureScene({ animatedLayerControls: true }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["LayeredMaterialDiffuseColorLayer", "textureLayerAlpha:1"],
    ["LayeredMaterialDiffuseColorLayer", "textureLayerBlendMode:1"]
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes.map((keyframe) => keyframe.value), [0.35, 0.8]);
  assert.deepEqual(scene.animations[0].tracks[1].keyframes.map((keyframe) => keyframe.value), [1, 2]);

  const document = createStaticMeshFbxDocument(layeredTextureScene({ animatedLayerControls: true }));
  const layerNode = documentNodes(document, "LayeredTexture")
    .find((node) => String(node.properties[1]).includes("LayeredMaterialDiffuseColorLayer"));
  const layerId = propValue(layerNode.properties[0]);
  const properties = propertyNames(childNode(layerNode, "Properties70"));
  assert.ok(properties.includes("Maya|layer_alpha_1"));
  assert.ok(properties.includes("Maya|layer_blend_mode_1"));

  const connections = documentNodes(document, "Connections")[0]?.children || [];
  const connectionProperties = connections.map((connection) => connection.properties.map(propValue));
  assert.ok(connectionProperties.some((properties) => {
    return properties[0] === "OP" && properties[2] === layerId && properties[3] === "Maya|layer_alpha_1";
  }));
  assert.ok(connectionProperties.some((properties) => {
    return properties[0] === "OP" && properties[2] === layerId && properties[3] === "Maya|layer_blend_mode_1";
  }));
});

test("Three.js FBXLoader parses the first layer and direct texture slots", async () => {
  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(layeredTextureScene())), "");
    const material = group.getObjectByName("LayeredQuad").material;

    assert.ok(material.map);
    assert.equal(material.map.name, "base_color");
    assert.ok(material.normalMap);
    assert.equal(material.normalMap.name, "normal");
  });
});

test("adapts repeated Three.js texture aliases into layered FBX texture slots", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeLayeredTextureScene()));
  const textures = scene.meshes[0].materials[0].textures;
  const namesByProperty = new Map();
  for (const texture of textures) {
    namesByProperty.set(texture.property, [
      ...(namesByProperty.get(texture.property) || []),
      texture.name
    ]);
  }

  assert.deepEqual(namesByProperty.get("NormalMap"), ["surface_normal", "clearcoat_normal"]);
  assert.deepEqual(namesByProperty.get("ShininessExponent"), ["base_roughness", "sheen_roughness"]);
  assert.deepEqual(namesByProperty.get("AmbientColor"), ["ambient_occlusion", "baked_light"]);
  const clearcoat = textures.find((texture) => texture.name === "clearcoat_normal");
  assert.equal(clearcoat.alpha, 0.42);
  assert.equal(clearcoat.blendMode, 1);
  assert.equal(textures.find((texture) => texture.name === "baked_light").uvSet, "UVMap_1");

  const text = decode(exportFbx(fromThreeObject(threeLayeredTextureScene())));
  assert.match(text, /LayeredThreeMaterialNormalMapLayer/);
  assert.match(text, /LayeredThreeMaterialShininessExponentLayer/);
  assert.match(text, /LayeredThreeMaterialAmbientColorLayer/);
  assert.match(text, /clearcoat_normal\.tga/);
  assert.match(text, /sheen_roughness\.tga/);
  assert.match(text, /baked_light\.tga/);
});

test("adapts source-owned Three.js layer controls into layered FBX texture slots", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeLayeredTextureScene({ sourceLayerControls: true })));
  const textures = scene.meshes[0].materials[0].textures;
  const clearcoat = textures.find((texture) => texture.name === "clearcoat_normal");

  assert.equal(clearcoat.alpha, 0.42);
  assert.equal(clearcoat.blendMode, 1);
});

test("routes Three.js layered texture control tracks to the layered texture node", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeLayeredTextureControlAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["LayeredThreeMaterialNormalMapLayer", "textureLayerAlpha:1"],
    ["LayeredThreeMaterialNormalMapLayer", "textureLayerBlendMode:1"]
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes.map((keyframe) => Number(keyframe.value.toFixed(4))), [0.42, 0.75]);
  assert.deepEqual(scene.animations[0].tracks[1].keyframes.map((keyframe) => keyframe.value), [1, 2]);

  const text = decode(exportFbx(fromThreeObject(threeLayeredTextureControlAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  })));
  assert.match(text, /LayeredTextureControls/);
  assert.match(text, /Maya\|layer_alpha_1/);
  assert.match(text, /Maya\|layer_blend_mode_1/);
});

test("routes Three.js source-owned layered texture control tracks to the layered texture node", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeLayeredTextureControlAnimationScene({ sourceLayerTracks: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["LayeredThreeMaterialNormalMapLayer", "textureLayerAlpha:1"],
    ["LayeredThreeMaterialNormalMapLayer", "textureLayerBlendMode:1"]
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes.map((keyframe) => Number(keyframe.value.toFixed(4))), [0.42, 0.75]);
  assert.deepEqual(scene.animations[0].tracks[1].keyframes.map((keyframe) => keyframe.value), [1, 2]);
});

test("routes Three.js texture-owned layer control clips to layered texture nodes", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeTextureOwnedLayerControlAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["LayeredThreeMaterialNormalMapLayer", "textureLayerAlpha:1"]
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes.map((keyframe) => Number(keyframe.value.toFixed(4))), [0.42, 0.9]);
});

test("routes Three.js source-owned texture layer control clips to layered texture nodes", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeTextureOwnedLayerControlAnimationScene({ sourceOwned: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["LayeredThreeMaterialNormalMapLayer", "textureLayerAlpha:1"]
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes.map((keyframe) => Number(keyframe.value.toFixed(4))), [0.42, 0.9]);
});

test("routes Three.js layered texture alias animation to the addressed texture", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeLayeredTextureAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["clearcoat_normal", "textureTranslation"],
    ["sheen_roughness", "textureTranslation"],
    ["baked_light", "textureTranslation"]
  ]);
  const roundedValues = scene.animations[0].tracks.map((track) => {
    return track.keyframes[1].value.map((value) => Number(value.toFixed(4)));
  });
  assert.deepEqual(roundedValues, [
    [0.1, 0.2, 0],
    [0.3, 0.4, 0],
    [0.5, 0.6, 0]
  ]);

  const text = decode(exportFbx(fromThreeObject(threeLayeredTextureAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  })));
  assert.match(text, /clearcoat_normal/);
  assert.match(text, /sheen_roughness/);
  assert.match(text, /baked_light/);
  assert.match(text, /LayeredTextureDrift/);
});
