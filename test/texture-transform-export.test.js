import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  AnimationClip,
  BufferGeometry,
  ClampToEdgeWrapping,
  CubeReflectionMapping,
  Float32BufferAttribute,
  Matrix3,
  Mesh,
  MeshBasicMaterial,
  MeshMatcapMaterial,
  MeshPhysicalMaterial,
  MeshToonMaterial,
  MirroredRepeatWrapping,
  NumberKeyframeTrack,
  Object3D,
  RepeatWrapping,
  Scene,
  Texture,
  VectorKeyframeTrack
} from "three";
import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { arrayBufferFrom, blenderPath, blenderTestArgs, checkerTga, decode, hasBlender, withMockDocument } from "./fbx-test-helpers.js";

function assertClose(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} not close to ${expected}`);
}

function assertVectorClose(actual, expected, epsilon = 1e-6) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assertClose(value, expected[index], epsilon));
}

function checkerDataUrl() {
  return `data:image/x-tga;base64,${Buffer.from(checkerTga()).toString("base64")}`;
}

function quadGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0,
    -1, 1, 0
  ], 3));
  geometry.setAttribute("normal", new Float32BufferAttribute([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1
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

function textureTransformScene() {
  return {
    name: "TextureTransformScene",
    meshes: [
      {
        name: "Quad",
        materials: [
          {
            name: "SamplerMaterial",
            diffuseTexture: {
              name: "sampler_checker",
              src: checkerDataUrl(),
              wrapS: RepeatWrapping,
              wrapT: ClampToEdgeWrapping,
              offset: { x: 0.25, y: 0.5 },
              repeat: { x: 2, y: 3 },
              rotation: 0.75,
              center: { x: 0.5, y: 0.25 }
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
    ]
  };
}

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

function textureMatrixScene() {
  const scene = textureTransformScene();
  const texture = scene.meshes[0].materials[0].diffuseTexture;
  delete texture.offset;
  delete texture.repeat;
  delete texture.rotation;
  texture.center = { x: 0.75, y: 0.25 };
  texture.matrix = uvMatrixElements({
    translation: [0.125, -0.25],
    rotation: 0.5,
    scale: [2, 3]
  });
  return scene;
}

function textureUserDataMatrixScene() {
  const scene = textureTransformScene();
  const texture = scene.meshes[0].materials[0].diffuseTexture;
  delete texture.offset;
  delete texture.repeat;
  delete texture.rotation;
  texture.userData = {
    matrixAutoUpdate: false,
    uvMatrix: uvMatrixElements({
      translation: [0.375, -0.125],
      rotation: 0.25,
      scale: [3, 4]
    })
  };
  return scene;
}

function textureUserDataTransformScene() {
  const scene = textureTransformScene();
  const texture = scene.meshes[0].materials[0].diffuseTexture;
  delete texture.offset;
  delete texture.repeat;
  delete texture.rotation;
  delete texture.center;
  texture.userData = {
    offset: { x: 0.125, y: 0.625 },
    repeat: [3, 4],
    rotation: 0.35,
    center: { x: 0.25, y: 0.75 }
  };
  return scene;
}

function textureNestedSourceTransformScene() {
  const scene = textureTransformScene();
  const texture = scene.meshes[0].materials[0].diffuseTexture;
  delete texture.offset;
  delete texture.repeat;
  delete texture.rotation;
  delete texture.center;
  texture.userData = {
    source: {
      data: {
        offset: [0.2, 0.4],
        repeat: [5, 6],
        rotation: 0.45,
        center: [0.3, 0.7]
      }
    }
  };
  return scene;
}

function textureNestedImageMatrixScene() {
  const scene = textureTransformScene();
  const texture = scene.meshes[0].materials[0].diffuseTexture;
  delete texture.offset;
  delete texture.repeat;
  delete texture.rotation;
  texture.userData = {
    image: {
      uvMatrix: uvMatrixElements({
        translation: [0.625, 0.125],
        rotation: 0.6,
        scale: [7, 8]
      })
    }
  };
  return scene;
}

function textureMappingMetadataScene() {
  const scene = textureTransformScene();
  scene.name = "TextureMappingMetadataScene";
  scene.meshes[0].materials[0].diffuseTexture.mappingType = "spherical";
  scene.meshes[0].materials[0].diffuseTexture.uvSwap = true;
  return scene;
}

function animatedTextureTransformScene() {
  const scene = textureTransformScene();
  scene.name = "AnimatedTextureTransformScene";
  scene.animations = [
    {
      name: "SamplerDrift",
      frameRate: 30,
      tracks: [
        {
          target: "sampler_checker",
          property: "textureTranslation",
          keyframes: [
            { frame: 0, value: [0.25, 0.5, 0] },
            { frame: 30, value: [0.5, 0.75, 0] }
          ]
        },
        {
          target: "sampler_checker",
          property: "textureScale",
          keyframes: [
            { frame: 0, value: [2, 3, 1] },
            { frame: 30, value: [4, 5, 1] }
          ]
        },
        {
          target: "sampler_checker",
          property: "textureRotation",
          keyframes: [
            { frame: 0, value: 0.75 },
            { frame: 30, value: 1.25 }
          ]
        }
      ]
    }
  ];
  return scene;
}

function animatedTextureComponentScene() {
  const scene = textureTransformScene();
  scene.name = "AnimatedTextureComponentScene";
  scene.animations = [
    {
      name: "SamplerComponents",
      frameRate: 30,
      tracks: [
        {
          target: "sampler_checker",
          property: "textureTranslationX",
          keyframes: [
            { frame: 0, value: [0.25, 0.5, 0] },
            { frame: 30, value: [0.5, 0.75, 0] }
          ]
        },
        {
          target: "sampler_checker",
          property: "textureScaleY",
          keyframes: [
            { frame: 0, value: [2, 3, 1] },
            { frame: 30, value: [4, 5, 1] }
          ]
        },
        {
          target: "sampler_checker",
          property: "textureRotationZ",
          keyframes: [
            { frame: 0, value: [0, 0, 0.75] },
            { frame: 30, value: [0, 0, 1.25] }
          ]
        },
        {
          target: "sampler_checker",
          property: "textureRotationPivotX",
          keyframes: [
            { frame: 0, value: { x: 0.5, y: 0.25, z: 0 } },
            { frame: 30, value: { x: 0.75, y: 0.5, z: 0 } }
          ]
        }
      ]
    }
  ];
  return scene;
}

function animatedTextureMatrixScene() {
  const scene = textureTransformScene();
  scene.name = "AnimatedTextureMatrixScene";
  scene.animations = [
    {
      name: "SamplerMatrix",
      frameRate: 30,
      tracks: [
        {
          target: "sampler_checker",
          property: "textureMatrix",
          keyframes: [
            {
              frame: 0,
              value: uvMatrixElements({
                translation: [0.125, -0.25],
                rotation: 0.5,
                scale: [2, 3]
              })
            },
            {
              frame: 30,
              value: uvMatrixElements({
                translation: [0.25, 0.5],
                rotation: 0.75,
                scale: [4, 5]
              })
            }
          ]
        }
      ]
    }
  ];
  return scene;
}

function animatedTexturePivotScene() {
  const scene = textureTransformScene();
  scene.name = "AnimatedTexturePivotScene";
  scene.animations = [
    {
      name: "SamplerCenter",
      frameRate: 30,
      tracks: [
        {
          target: "sampler_checker",
          property: "textureRotationPivot",
          keyframes: [
            { frame: 0, value: [0.5, 0.25, 0] },
            { frame: 30, value: [0.75, 0.5, 0] }
          ]
        },
        {
          target: "sampler_checker",
          property: "textureScalingPivot",
          keyframes: [
            { frame: 0, value: [0.5, 0.25, 0] },
            { frame: 30, value: [0.75, 0.5, 0] }
          ]
        }
      ]
    }
  ];
  return scene;
}

function animatedTextureCropScene() {
  const scene = textureTransformScene();
  scene.name = "AnimatedTextureCropScene";
  scene.meshes[0].materials[0].diffuseTexture.cropping = {
    left: 1,
    top: 2,
    right: 3,
    bottom: 4
  };
  scene.animations = [
    {
      name: "SamplerCrop",
      frameRate: 30,
      tracks: [
        {
          target: "sampler_checker",
          property: "cropLeft",
          keyframes: [
            { frame: 0, value: 1.2 },
            { frame: 30, value: 4.6 }
          ]
        },
        {
          target: "sampler_checker",
          property: "CroppingTop",
          keyframes: [
            { frame: 0, value: 2 },
            { frame: 30, value: 0 }
          ]
        },
        {
          target: "sampler_checker",
          property: "textureCropRight",
          keyframes: [
            { frame: 0, value: 3 },
            { frame: 30, value: 7.2 }
          ]
        },
        {
          target: "sampler_checker",
          property: "croppingBottom",
          keyframes: [
            { frame: 0, value: 4 },
            { frame: 30, value: -1 }
          ]
        }
      ]
    }
  ];
  return scene;
}

function threeTextureTransformScene({ wrapS = RepeatWrapping } = {}) {
  const texture = new Texture({ src: checkerDataUrl(), name: "checker_image" });
  texture.name = "sampler_checker";
  texture.wrapS = wrapS;
  texture.wrapT = ClampToEdgeWrapping;
  texture.offset.set(0.25, 0.5);
  texture.repeat.set(2, 3);
  texture.rotation = 0.75;
  texture.center.set(0.5, 0.25);

  const material = new MeshBasicMaterial({ name: "SamplerMaterial", map: texture });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "Quad";

  const scene = new Scene();
  scene.name = "ThreeTextureTransformScene";
  scene.add(mesh);
  return scene;
}

function threeTextureMatrixScene() {
  const scene = threeTextureTransformScene();
  const texture = scene.getObjectByName("Quad").material.map;
  texture.center.set(0.75, 0.25);
  texture.matrixAutoUpdate = false;
  texture.matrix = new Matrix3().fromArray(uvMatrixElements({
    translation: [0.125, -0.25],
    rotation: 0.5,
    scale: [2, 3]
  }));
  return scene;
}

function threeTextureUserDataMatrixScene() {
  const scene = threeTextureTransformScene();
  const texture = scene.getObjectByName("Quad").material.map;
  texture.userData.matrixAutoUpdate = false;
  texture.userData.uvMatrix = uvMatrixElements({
    translation: [0.375, -0.125],
    rotation: 0.25,
    scale: [3, 4]
  });
  return scene;
}

function threeTextureUserDataTransformScene() {
  const scene = threeTextureTransformScene();
  const texture = scene.getObjectByName("Quad").material.map;
  texture.offset.set(0.01, 0.02);
  texture.repeat.set(6, 7);
  texture.rotation = 0.1;
  texture.center.set(0.9, 0.8);
  texture.userData.offset = [0.125, 0.625];
  texture.userData.repeat = { x: 3, y: 4 };
  texture.userData.rotation = 0.35;
  texture.userData.center = [0.25, 0.75];
  return scene;
}

function threeTextureNestedTransformScene() {
  const scene = threeTextureTransformScene();
  const texture = scene.getObjectByName("Quad").material.map;
  texture.offset.set(0.01, 0.02);
  texture.repeat.set(6, 7);
  texture.rotation = 0.1;
  texture.center.set(0.9, 0.8);
  texture.userData.source = {
    data: {
      offset: [0.2, 0.4],
      repeat: { x: 5, y: 6 },
      rotation: 0.45,
      center: [0.3, 0.7]
    }
  };
  return scene;
}

function threeTextureDirectSourceTransformScene() {
  const scene = threeTextureTransformScene();
  const texture = scene.getObjectByName("Quad").material.map;
  texture.offset.set(0.01, 0.02);
  texture.repeat.set(6, 7);
  texture.rotation = 0.1;
  texture.center.set(0.9, 0.8);
  texture.source.offset = [0.22, 0.42];
  texture.source.repeat = { x: 5.5, y: 6.5 };
  texture.source.rotation = 0.55;
  texture.source.center = [0.35, 0.75];
  return scene;
}

function threeTextureUserDataSourceTransformScene() {
  const scene = threeTextureTransformScene();
  const texture = scene.getObjectByName("Quad").material.map;
  texture.offset.set(0.01, 0.02);
  texture.repeat.set(6, 7);
  texture.rotation = 0.1;
  texture.center.set(0.9, 0.8);
  texture.userData.source = {
    offset: [0.24, 0.44],
    repeat: { x: 5.25, y: 6.25 },
    rotation: 0.65,
    center: [0.32, 0.72]
  };
  return scene;
}

function threeTextureMediaTransformScene() {
  const scene = threeTextureTransformScene();
  const texture = scene.getObjectByName("Quad").material.map;
  texture.offset.set(0.01, 0.02);
  texture.repeat.set(6, 7);
  texture.rotation = 0.1;
  texture.center.set(0.9, 0.8);
  texture.media = {
    offset: [0.28, 0.48],
    repeat: { x: 5.75, y: 6.75 },
    rotation: 0.85,
    center: [0.38, 0.78]
  };
  return scene;
}

function threeTextureUserDataVideoTransformScene() {
  const scene = threeTextureTransformScene();
  const texture = scene.getObjectByName("Quad").material.map;
  texture.offset.set(0.01, 0.02);
  texture.repeat.set(6, 7);
  texture.rotation = 0.1;
  texture.center.set(0.9, 0.8);
  texture.userData.video = {
    offset: [0.26, 0.46],
    repeat: { x: 5.35, y: 6.35 },
    rotation: 0.75,
    center: [0.34, 0.74]
  };
  return scene;
}

function threeTextureUserDataMediaElementTransformScene() {
  const scene = threeTextureTransformScene();
  const texture = scene.getObjectByName("Quad").material.map;
  texture.offset.set(0.01, 0.02);
  texture.repeat.set(6, 7);
  texture.rotation = 0.1;
  texture.center.set(0.9, 0.8);
  texture.userData.mediaElement = {
    offset: [0.29, 0.49],
    repeat: { x: 5.85, y: 6.85 },
    rotation: 0.95,
    center: [0.39, 0.79]
  };
  return scene;
}

function threeTextureNestedMatrixScene() {
  const scene = threeTextureTransformScene();
  const texture = scene.getObjectByName("Quad").material.map;
  texture.userData.image = {
    uvMatrix: uvMatrixElements({
      translation: [0.625, 0.125],
      rotation: 0.6,
      scale: [7, 8]
    })
  };
  return scene;
}

function threeAnimatedTextureTransformScene() {
  const scene = threeTextureTransformScene();
  scene.name = "ThreeAnimatedTextureTransformScene";
  scene.animations = [
    new AnimationClip("SamplerDrift", 1, [
      new VectorKeyframeTrack("Quad.material.map.offset", [0, 1], [
        0.25, 0.5,
        0.5, 0.75
      ]),
      new VectorKeyframeTrack("Quad.material.map.repeat", [0, 1], [
        2, 3, 1,
        4, 5, 1
      ]),
      new NumberKeyframeTrack("Quad.material.map.rotation", [0, 1], [0.75, 1.25])
    ])
  ];
  return scene;
}

function threeTextureOwnedAnimationScene() {
  const scene = threeTextureTransformScene();
  const texture = scene.getObjectByName("Quad").material.map;
  scene.animations = [];
  texture.userData.cropLeft = 1;
  texture.animations = [
    new AnimationClip("TextureLocal", 1, [
      new VectorKeyframeTrack("offset", [0, 1], [
        0.25, 0.5,
        0.5, 0.75
      ]),
      new NumberKeyframeTrack("rotation[2]", [0, 1], [0.75, 1.25]),
      new NumberKeyframeTrack("repeat[0]", [0, 1], [2, 4]),
      new NumberKeyframeTrack("userData.cropLeft", [0, 1], [1, 5])
    ])
  ];
  return scene;
}

function threeAnimatedMapObjectTextureTransformScene() {
  const scene = threeTextureTransformScene();
  scene.name = "ThreeAnimatedMapObjectTextureTransformScene";
  scene.animations = [
    new AnimationClip("DirectMapDrift", 1, [
      new VectorKeyframeTrack("Quad.map.offset", [0, 1], [
        0.25, 0.5,
        0.35, 0.65
      ])
    ])
  ];
  return scene;
}

function threeAnimatedLightMapTextureTransformScene() {
  const scene = threeTextureTransformScene();
  scene.name = "ThreeAnimatedLightMapTextureTransformScene";
  const material = scene.getObjectByName("Quad").material;
  material.lightMap = new Texture({ src: checkerDataUrl(), name: "lightmap_image" });
  material.lightMap.name = "lightmap_checker";
  scene.animations = [
    new AnimationClip("LightMapDrift", 1, [
      new VectorKeyframeTrack("Quad.material.lightMap.offset", [0, 1], [
        0.125, 0.25,
        0.5, 0.75
      ])
    ])
  ];
  return scene;
}

function threeAnimatedSpecularIntensityMapTextureTransformScene() {
  const scene = threeTextureTransformScene();
  scene.name = "ThreeAnimatedSpecularIntensityMapTextureTransformScene";
  const material = scene.getObjectByName("Quad").material;
  material.specularIntensityMap = new Texture({ src: checkerDataUrl(), name: "specular_intensity_image" });
  material.specularIntensityMap.name = "specular_intensity";
  scene.animations = [
    new AnimationClip("SpecularIntensityMapDrift", 1, [
      new VectorKeyframeTrack("Quad.material.specularIntensityMap.offset", [0, 1], [
        0.2, 0.3,
        0.4, 0.5
      ])
    ])
  ];
  return scene;
}

function threeAnimatedEnvMapRotationTextureTransformScene() {
  const scene = threeTextureTransformScene();
  scene.name = "ThreeAnimatedEnvMapRotationTextureTransformScene";
  const material = scene.getObjectByName("Quad").material;
  const envMap = new Texture({ src: checkerDataUrl(), name: "envmap_image" });
  envMap.name = "studio_env";
  const physicalMaterial = new MeshPhysicalMaterial({
    name: material.name,
    color: material.color,
    envMap
  });
  physicalMaterial.envMapRotation.set(0.1, 0.2, 0.3);
  scene.getObjectByName("Quad").material = physicalMaterial;
  scene.animations = [
    new AnimationClip("EnvMapSpin", 1, [
      new VectorKeyframeTrack("Quad.material.envMapRotation", [0, 1], [
        0.1, 0.2, 0.3,
        0.4, 0.5, 0.6
      ]),
      new NumberKeyframeTrack("Quad.material.envMapRotation.z", [0, 1], [0.3, 0.9])
    ])
  ];
  return scene;
}

function threeAnimatedMatcapTextureTransformScene() {
  const texture = new Texture({ src: checkerDataUrl(), name: "matcap_image" });
  texture.name = "matcap_checker";
  const material = new MeshMatcapMaterial({ name: "MatcapMaterial", matcap: texture });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "MatcapQuad";

  const scene = new Scene();
  scene.name = "ThreeAnimatedMatcapTextureTransformScene";
  scene.add(mesh);
  scene.animations = [
    new AnimationClip("MatcapDrift", 1, [
      new VectorKeyframeTrack("MatcapQuad.material.matcap.offset", [0, 1], [
        0.1, 0.2,
        0.3, 0.4
      ])
    ])
  ];
  return scene;
}

function threeAnimatedGradientMapTextureTransformScene() {
  const texture = new Texture({ src: checkerDataUrl(), name: "gradient_image" });
  texture.name = "toon_gradient";
  const material = new MeshToonMaterial({ name: "ToonMaterial", gradientMap: texture });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "ToonQuad";

  const scene = new Scene();
  scene.name = "ThreeAnimatedGradientMapTextureTransformScene";
  scene.add(mesh);
  scene.animations = [
    new AnimationClip("GradientDrift", 1, [
      new VectorKeyframeTrack("ToonQuad.material.gradientMap.offset", [0, 1], [
        0.12, 0.22,
        0.32, 0.42
      ])
    ])
  ];
  return scene;
}

function threeAnimatedClearcoatTextureTransformScene() {
  const scene = threeTextureTransformScene();
  scene.name = "ThreeAnimatedClearcoatTextureTransformScene";
  const material = scene.getObjectByName("Quad").material;
  const clearcoatMap = new Texture({ src: checkerDataUrl(), name: "clearcoat_image" });
  clearcoatMap.name = "clearcoat_checker";
  scene.getObjectByName("Quad").material = new MeshPhysicalMaterial({
    name: material.name,
    color: material.color,
    clearcoat: 0.5,
    clearcoatMap
  });
  scene.animations = [
    new AnimationClip("ClearcoatDrift", 1, [
      new VectorKeyframeTrack("Quad.material.clearcoatMap.offset", [0, 1], [
        0.15, 0.25,
        0.45, 0.55
      ])
    ])
  ];
  return scene;
}

function threeAnimatedClearcoatDetailTextureTransformScene() {
  const scene = threeTextureTransformScene();
  scene.name = "ThreeAnimatedClearcoatDetailTextureTransformScene";
  const material = scene.getObjectByName("Quad").material;
  const clearcoatNormalMap = new Texture({ src: checkerDataUrl(), name: "clearcoat_normal_image" });
  clearcoatNormalMap.name = "clearcoat_normal";
  const clearcoatRoughnessMap = new Texture({ src: checkerDataUrl(), name: "clearcoat_roughness_image" });
  clearcoatRoughnessMap.name = "clearcoat_roughness";
  scene.getObjectByName("Quad").material = new MeshPhysicalMaterial({
    name: material.name,
    color: material.color,
    clearcoat: 0.5,
    clearcoatNormalMap,
    clearcoatRoughnessMap
  });
  scene.animations = [
    new AnimationClip("ClearcoatDetailDrift", 1, [
      new VectorKeyframeTrack("Quad.material.clearcoatNormalMap.offset", [0, 1], [
        0.1, 0.2,
        0.3, 0.4
      ]),
      new VectorKeyframeTrack("Quad.material.clearcoatRoughnessMap.offset", [0, 1], [
        0.15, 0.25,
        0.45, 0.55
      ])
    ])
  ];
  return scene;
}

function threeAnimatedTransmissionTextureTransformScene() {
  const scene = threeTextureTransformScene();
  scene.name = "ThreeAnimatedTransmissionTextureTransformScene";
  const material = scene.getObjectByName("Quad").material;
  const transmissionMap = new Texture({ src: checkerDataUrl(), name: "transmission_image" });
  transmissionMap.name = "transmission_checker";
  scene.getObjectByName("Quad").material = new MeshPhysicalMaterial({
    name: material.name,
    color: material.color,
    transmission: 0.5,
    transmissionMap
  });
  scene.animations = [
    new AnimationClip("TransmissionDrift", 1, [
      new VectorKeyframeTrack("Quad.material.transmissionMap.offset", [0, 1], [
        0.05, 0.15,
        0.35, 0.45
      ])
    ])
  ];
  return scene;
}

function threeAnimatedSheenTextureTransformScene() {
  const scene = threeTextureTransformScene();
  scene.name = "ThreeAnimatedSheenTextureTransformScene";
  const material = scene.getObjectByName("Quad").material;
  const sheenColorMap = new Texture({ src: checkerDataUrl(), name: "sheen_color_image" });
  sheenColorMap.name = "sheen_color";
  const sheenRoughnessMap = new Texture({ src: checkerDataUrl(), name: "sheen_roughness_image" });
  sheenRoughnessMap.name = "sheen_roughness";
  scene.getObjectByName("Quad").material = new MeshPhysicalMaterial({
    name: material.name,
    color: material.color,
    sheen: 0.5,
    sheenColorMap,
    sheenRoughnessMap
  });
  scene.animations = [
    new AnimationClip("SheenDrift", 1, [
      new VectorKeyframeTrack("Quad.material.sheenColorMap.offset", [0, 1], [
        0.1, 0.2,
        0.4, 0.5
      ]),
      new VectorKeyframeTrack("Quad.material.sheenRoughnessMap.offset", [0, 1], [
        0.15, 0.25,
        0.45, 0.55
      ])
    ])
  ];
  return scene;
}

function threeAnimatedPhysicalExtensionTextureTransformScene() {
  const scene = threeTextureTransformScene();
  scene.name = "ThreeAnimatedPhysicalExtensionTextureTransformScene";
  const material = scene.getObjectByName("Quad").material;
  const anisotropyMap = new Texture({ src: checkerDataUrl(), name: "anisotropy_image" });
  anisotropyMap.name = "anisotropy_map";
  const iridescenceMap = new Texture({ src: checkerDataUrl(), name: "iridescence_image" });
  iridescenceMap.name = "iridescence_map";
  const iridescenceThicknessMap = new Texture({ src: checkerDataUrl(), name: "iridescence_thickness_image" });
  iridescenceThicknessMap.name = "iridescence_thickness_map";
  const thicknessMap = new Texture({ src: checkerDataUrl(), name: "thickness_image" });
  thicknessMap.name = "thickness_map";
  scene.getObjectByName("Quad").material = new MeshPhysicalMaterial({
    name: material.name,
    color: material.color,
    anisotropyMap,
    iridescenceMap,
    iridescenceThicknessMap,
    thicknessMap
  });
  scene.animations = [
    new AnimationClip("PhysicalExtensionDrift", 1, [
      new VectorKeyframeTrack("Quad.material.anisotropyMap.offset", [0, 1], [
        0.1, 0.2,
        0.3, 0.4
      ]),
      new VectorKeyframeTrack("Quad.material.iridescenceMap.offset", [0, 1], [
        0.15, 0.25,
        0.35, 0.45
      ]),
      new VectorKeyframeTrack("Quad.material.iridescenceThicknessMap.offset", [0, 1], [
        0.2, 0.3,
        0.4, 0.5
      ]),
      new VectorKeyframeTrack("Quad.material.thicknessMap.offset", [0, 1], [
        0.25, 0.35,
        0.45, 0.55
      ])
    ])
  ];
  return scene;
}

function threeAnimatedUserDataTextureAliasTransformScene() {
  const scene = threeTextureTransformScene();
  scene.name = "ThreeAnimatedUserDataTextureAliasTransformScene";
  const material = scene.getObjectByName("Quad").material;
  const roughnessTexture = new Texture({ src: checkerDataUrl(), name: "roughness_alias_image" });
  roughnessTexture.name = "roughness_alias";
  const alphaMap = new Texture({ src: checkerDataUrl(), name: "alpha_alias_image" });
  alphaMap.name = "alpha_alias";
  material.userData.roughnessTexture = roughnessTexture;
  material.userData.alphaMap = alphaMap;
  scene.animations = [
    new AnimationClip("UserDataTextureAliasDrift", 1, [
      new VectorKeyframeTrack("Quad.material.userData.roughnessTexture.offset", [0, 1], [
        0.1, 0.2,
        0.3, 0.4
      ]),
      new VectorKeyframeTrack("Quad.material.userData.alphaMap.offset", [0, 1], [
        0.15, 0.25,
        0.45, 0.55
      ])
    ])
  ];
  return scene;
}

function threePathAnimatedTextureTransformScene() {
  const scene = threeAnimatedTextureTransformScene();
  const mesh = scene.getObjectByName("Quad");
  const rig = new Object3D();
  rig.name = "Rig";
  scene.remove(mesh);
  rig.add(mesh);
  scene.add(rig);
  scene.animations = [
    new AnimationClip("PathSamplerDrift", 1, [
      new VectorKeyframeTrack("Rig/Quad.material.map.offset", [0, 1], [
        0.25, 0.5,
        0.5, 0.75
      ])
    ])
  ];
  return scene;
}

function threeAnimatedTextureComponentScene() {
  const scene = threeTextureTransformScene();
  scene.name = "ThreeAnimatedTextureComponentScene";
  scene.animations = [
    new AnimationClip("SamplerComponents", 1, [
      new NumberKeyframeTrack("Quad.material.map.offset[0]", [0, 1], [0.25, 0.5]),
      new NumberKeyframeTrack("Quad.material.map.repeat.y", [0, 1], [3, 5]),
      new NumberKeyframeTrack("Quad.material.map.rotation[2]", [0, 1], [0.75, 1.25]),
      new NumberKeyframeTrack("Quad.material.map.center[x]", [0, 1], [0.5, 0.75])
    ])
  ];
  return scene;
}

function threeAnimatedTextureMatrixScene() {
  const scene = threeTextureTransformScene();
  scene.name = "ThreeAnimatedTextureMatrixScene";
  scene.animations = [
    new AnimationClip("SamplerMatrix", 1, [
      new VectorKeyframeTrack("Quad.material.map.matrix.elements", [0, 1], [
        ...uvMatrixElements({
          translation: [0.125, -0.25],
          rotation: 0.5,
          scale: [2, 3]
        }),
        ...uvMatrixElements({
          translation: [0.25, 0.5],
          rotation: 0.75,
          scale: [4, 5]
        })
      ])
    ])
  ];
  return scene;
}

function threeNestedAnimatedTextureTransformScene() {
  const scene = threeTextureTransformScene();
  scene.name = "ThreeNestedAnimatedTextureTransformScene";
  scene.animations = [
    new AnimationClip("NestedSamplerDrift", 1, [
      new VectorKeyframeTrack("Quad.material.map.userData.source.data.offset", [0, 1], [
        0.2, 0.4,
        0.5, 0.7
      ]),
      new NumberKeyframeTrack("Quad.material.map.userData.image.rotation", [0, 1], [0.45, 0.75]),
      new VectorKeyframeTrack("Quad.material.map.source.data.repeat", [0, 1], [
        5, 6,
        7, 8
      ]),
      new VectorKeyframeTrack("Quad.material.map.image.center", [0, 1], [
        0.3, 0.7,
        0.4, 0.8
      ])
    ])
  ];
  return scene;
}

function threeSourceAnimatedTextureTransformScene() {
  const scene = threeTextureTransformScene();
  scene.name = "ThreeSourceAnimatedTextureTransformScene";
  scene.animations = [
    new AnimationClip("SourceSamplerDrift", 1, [
      new VectorKeyframeTrack("Quad.material.map.source.offset", [0, 1], [
        0.15, 0.25,
        0.35, 0.45
      ]),
      new VectorKeyframeTrack("Quad.material.map.userData.source.repeat", [0, 1], [
        2, 3,
        4, 5
      ]),
      new NumberKeyframeTrack("Quad.material.map.source.rotation", [0, 1], [0.2, 0.6]),
      new VectorKeyframeTrack("Quad.material.map.userData.source.center", [0, 1], [
        0.1, 0.2,
        0.3, 0.4
      ])
    ])
  ];
  return scene;
}

function threeTextureOwnedMatrixAnimationScene() {
  const scene = threeTextureTransformScene();
  const texture = scene.getObjectByName("Quad").material.map;
  scene.animations = [];
  texture.animations = [
    new AnimationClip("TextureLocalMatrix", 1, [
      new VectorKeyframeTrack("userData.uvMatrix.elements", [0, 1], [
        ...uvMatrixElements({
          translation: [0.125, -0.25],
          rotation: 0.5,
          scale: [2, 3]
        }),
        ...uvMatrixElements({
          translation: [0.25, 0.5],
          rotation: 0.75,
          scale: [4, 5]
        })
      ])
    ])
  ];
  return scene;
}

function threeTextureOwnedNestedMatrixAnimationScene() {
  const scene = threeTextureTransformScene();
  const texture = scene.getObjectByName("Quad").material.map;
  scene.animations = [];
  texture.animations = [
    new AnimationClip("NestedTextureLocalMatrix", 1, [
      new VectorKeyframeTrack("userData.source.data.uvMatrix.elements", [0, 1], [
        ...uvMatrixElements({
          translation: [0.625, 0.125],
          rotation: 0.6,
          scale: [7, 8]
        }),
        ...uvMatrixElements({
          translation: [0.75, 0.25],
          rotation: 0.9,
          scale: [9, 10]
        })
      ])
    ])
  ];
  return scene;
}

function threeTextureMediaOwnedAnimationScene() {
  const scene = threeTextureTransformScene();
  const texture = scene.getObjectByName("Quad").material.map;
  scene.animations = [];
  texture.media = {
    animations: [
      new AnimationClip("TextureMediaLocal", 1, [
        new VectorKeyframeTrack("offset", [0, 1], [
          0.2, 0.3,
          0.4, 0.5
        ]),
        new NumberKeyframeTrack("rotation", [0, 1], [0.25, 0.65]),
        new VectorKeyframeTrack("center", [0, 1], [
          0.1, 0.2,
          0.3, 0.4
        ])
      ])
    ]
  };
  return scene;
}

function threeTextureUserDataMediaElementOwnedAnimationScene() {
  const scene = threeTextureTransformScene();
  const texture = scene.getObjectByName("Quad").material.map;
  scene.animations = [];
  texture.userData.mediaElement = {
    animations: [
      new AnimationClip("TextureMediaElementLocal", 1, [
        new VectorKeyframeTrack("offset", [0, 1], [
          0.12, 0.22,
          0.42, 0.52
        ]),
        new VectorKeyframeTrack("repeat", [0, 1], [
          2, 3,
          4, 5
        ])
      ])
    ]
  };
  return scene;
}

function threeAnimatedTexturePivotScene() {
  const scene = threeTextureTransformScene();
  scene.name = "ThreeAnimatedTexturePivotScene";
  scene.animations = [
    new AnimationClip("SamplerCenter", 1, [
      new VectorKeyframeTrack("Quad.material.map.center", [0, 1], [
        0.5, 0.25,
        0.75, 0.5
      ])
    ])
  ];
  return scene;
}

function threeAnimatedTextureCropScene() {
  const scene = threeTextureTransformScene();
  scene.name = "ThreeAnimatedTextureCropScene";
  const texture = scene.getObjectByName("Quad").material.map;
  texture.userData.cropLeft = 1;
  texture.userData.cropTop = 2;
  texture.userData.cropRight = 3;
  texture.userData.cropBottom = 4;
  scene.animations = [
    new AnimationClip("SamplerCrop", 1, [
      new NumberKeyframeTrack("Quad.material.map.userData.cropLeft", [0, 1], [1, 5]),
      new NumberKeyframeTrack("Quad.material.map.userData.cropTop", [0, 1], [2, 0]),
      new NumberKeyframeTrack("Quad.material.map.userData.cropRight", [0, 1], [3, 7]),
      new NumberKeyframeTrack("Quad.material.map.userData.cropBottom", [0, 1], [4, 0])
    ])
  ];
  return scene;
}

async function parseWithFbxLoader(source) {
  return withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    return new FBXLoader().parse(arrayBufferFrom(exportFbx(source)), "");
  });
}

function mappingNodePayloadScript() {
  return `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
material = bpy.data.materials["SamplerMaterial"]
mapping = next(node for node in material.node_tree.nodes if node.bl_idname == "ShaderNodeMapping")
payload = {}
for name in ("Location", "Rotation", "Scale"):
    value = mapping.inputs[name].default_value
    payload[name] = [0 if abs(component) < 0.0000005 else round(component, 6) for component in value]
print("FBX_VALIDATE:" + json.dumps(payload))
`;
}

test("normalizes texture sampler transforms from object-shaped values", () => {
  const scene = normalizeFbxScene(textureTransformScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.wrapU, "repeat");
  assert.equal(texture.wrapV, "clamp");
  assert.deepEqual(texture.translation, [0.25, 0.5, 0]);
  assert.deepEqual(texture.rotation, [0, 0, 0.75]);
  assert.deepEqual(texture.scale, [2, 3, 1]);
  assert.deepEqual(texture.rotationPivot, [0.5, 0.25, 0]);
  assert.deepEqual(texture.scalingPivot, [0.5, 0.25, 0]);

  const text = decode(exportFbx(scene));
  assert.match(text, /WrapModeU/);
  assert.match(text, /WrapModeV/);
  assert.match(text, /Translation/);
  assert.match(text, /Rotation/);
  assert.match(text, /Scaling/);
  assert.match(text, /TextureRotationPivot/);
  assert.match(text, /TextureScalingPivot/);
});

test("normalizes and writes texture mapping metadata", () => {
  const scene = normalizeFbxScene(textureMappingMetadataScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.mappingType, 2);
  assert.equal(texture.uvSwap, true);

  const text = decode(exportFbx(scene));
  assert.match(text, /CurrentMappingType/);
  assert.match(text, /UVSwap/);
});

test("can normalize texture transforms for Blender-compatible mapping", () => {
  const scene = normalizeFbxScene(textureTransformScene(), { textureTransformMode: "blender" });
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.deepEqual(texture.translation, [0.25, 0.5, 0]);
  assert.deepEqual(texture.rotation, [0, 0, -0.75]);
  assert.deepEqual(texture.scale, [0.5, 1 / 3, 1]);
});

test("normalizes baked texture matrix transforms", () => {
  const scene = normalizeFbxScene(textureMatrixScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assertVectorClose(texture.translation, [0.125, -0.25, 0]);
  assertVectorClose(texture.rotation, [0, 0, 0.5]);
  assertVectorClose(texture.scale, [2, 3, 1]);
  assert.deepEqual(texture.rotationPivot, [0, 0, 0]);
  assert.deepEqual(texture.scalingPivot, [0, 0, 0]);
});

test("normalizes userData texture matrix transforms", () => {
  const scene = normalizeFbxScene(textureUserDataMatrixScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assertVectorClose(texture.translation, [0.375, -0.125, 0]);
  assertVectorClose(texture.rotation, [0, 0, 0.25]);
  assertVectorClose(texture.scale, [3, 4, 1]);
  assert.equal(texture.matrixAutoUpdate, false);
  assert.deepEqual(texture.rotationPivot, [0, 0, 0]);
  assert.deepEqual(texture.scalingPivot, [0, 0, 0]);
});

test("normalizes userData texture transform aliases", () => {
  const scene = normalizeFbxScene(textureUserDataTransformScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assertVectorClose(texture.translation, [0.125, 0.625, 0]);
  assertVectorClose(texture.rotation, [0, 0, 0.35]);
  assertVectorClose(texture.scale, [3, 4, 1]);
  assert.deepEqual(texture.rotationPivot, [0.25, 0.75, 0]);
  assert.deepEqual(texture.scalingPivot, [0.25, 0.75, 0]);
});

test("normalizes nested source texture transform aliases", () => {
  const scene = normalizeFbxScene(textureNestedSourceTransformScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assertVectorClose(texture.translation, [0.2, 0.4, 0]);
  assertVectorClose(texture.rotation, [0, 0, 0.45]);
  assertVectorClose(texture.scale, [5, 6, 1]);
  assert.deepEqual(texture.rotationPivot, [0.3, 0.7, 0]);
  assert.deepEqual(texture.scalingPivot, [0.3, 0.7, 0]);
});

test("normalizes nested image texture matrix transforms", () => {
  const scene = normalizeFbxScene(textureNestedImageMatrixScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assertVectorClose(texture.translation, [0.625, 0.125, 0]);
  assertVectorClose(texture.rotation, [0, 0, 0.6]);
  assertVectorClose(texture.scale, [7, 8, 1]);
  assert.deepEqual(texture.rotationPivot, [0, 0, 0]);
  assert.deepEqual(texture.scalingPivot, [0, 0, 0]);
});

test("normalizes baked texture matrix transforms for Blender-compatible mapping", () => {
  const scene = normalizeFbxScene(textureMatrixScene(), { textureTransformMode: "blender" });
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assertVectorClose(texture.translation, [0.125, -0.25, 0]);
  assertVectorClose(texture.rotation, [0, 0, -0.5]);
  assertVectorClose(texture.scale, [0.5, 1 / 3, 1]);
});

test("normalizes texture transform animation targets", () => {
  const scene = normalizeFbxScene(animatedTextureTransformScene());

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureTranslation",
    "textureScale",
    "textureRotation"
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes[1].value, [0.5, 0.75, 0]);
  assert.deepEqual(scene.animations[0].tracks[1].keyframes[1].value, [4, 5, 1]);
  assert.deepEqual(scene.animations[0].tracks[2].keyframes.map((keyframe) => keyframe.value), [
    [0, 0, 0.75],
    [0, 0, 1.25]
  ]);
});

test("normalizes texture transform animation for Blender-compatible mapping", () => {
  const scene = normalizeFbxScene(animatedTextureTransformScene(), { textureTransformMode: "blender" });

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureTranslation",
    "textureScale",
    "textureRotation"
  ]);
  assertVectorClose(scene.animations[0].tracks[0].keyframes[1].value, [0.5, 0.75, 0]);
  assertVectorClose(scene.animations[0].tracks[1].keyframes[0].value, [0.5, 1 / 3, 1]);
  assertVectorClose(scene.animations[0].tracks[1].keyframes[1].value, [0.25, 0.2, 1]);
  assert.deepEqual(scene.animations[0].tracks[2].keyframes.map((keyframe) => keyframe.value), [
    [0, 0, -0.75],
    [0, 0, -1.25]
  ]);
});

test("normalizes vector-valued texture component animation keys", () => {
  const scene = normalizeFbxScene(animatedTextureComponentScene());

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureTranslationX",
    "textureScaleY",
    "textureRotationZ",
    "textureRotationPivotX"
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes.map((keyframe) => keyframe.value), [0.25, 0.5]);
  assert.deepEqual(scene.animations[0].tracks[1].keyframes.map((keyframe) => keyframe.value), [3, 5]);
  assert.deepEqual(scene.animations[0].tracks[2].keyframes.map((keyframe) => keyframe.value), [0.75, 1.25]);
  assert.deepEqual(scene.animations[0].tracks[3].keyframes.map((keyframe) => keyframe.value), [0.5, 0.75]);
});

test("normalizes vector-valued texture component animation keys for Blender-compatible mapping", () => {
  const scene = normalizeFbxScene(animatedTextureComponentScene(), { textureTransformMode: "blender" });

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureTranslationX",
    "textureScaleY",
    "textureRotationZ",
    "textureRotationPivotX"
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes.map((keyframe) => keyframe.value), [0.25, 0.5]);
  assertVectorClose(scene.animations[0].tracks[1].keyframes.map((keyframe) => keyframe.value), [1 / 3, 0.2]);
  assert.deepEqual(scene.animations[0].tracks[2].keyframes.map((keyframe) => keyframe.value), [-0.75, -1.25]);
  assert.deepEqual(scene.animations[0].tracks[3].keyframes.map((keyframe) => keyframe.value), [0.5, 0.75]);
});

test("normalizes texture matrix animation into transform curves", () => {
  const scene = normalizeFbxScene(animatedTextureMatrixScene());

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

  const text = decode(exportFbx(animatedTextureMatrixScene()));
  assert.match(text, /Translation/);
  assert.match(text, /Rotation/);
  assert.match(text, /Scaling/);
  assert.match(text, /AnimationCurveNode/);
});

test("normalizes texture matrix animation for Blender-compatible mapping", () => {
  const scene = normalizeFbxScene(animatedTextureMatrixScene(), { textureTransformMode: "blender" });

  assertVectorClose(scene.animations[0].tracks[0].keyframes[0].value, [0.125, -0.25, 0]);
  assertVectorClose(scene.animations[0].tracks[1].keyframes[0].value, [0, 0, -0.5]);
  assertVectorClose(scene.animations[0].tracks[2].keyframes[0].value, [0.5, 1 / 3, 1]);
  assertVectorClose(scene.animations[0].tracks[1].keyframes[1].value, [0, 0, -0.75]);
  assertVectorClose(scene.animations[0].tracks[2].keyframes[1].value, [0.25, 0.2, 1]);
});

test("normalizes texture pivot animation targets", () => {
  const scene = normalizeFbxScene(animatedTexturePivotScene());

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureRotationPivot",
    "textureScalingPivot"
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes[1].value, [0.75, 0.5, 0]);
  assert.deepEqual(scene.animations[0].tracks[1].keyframes[1].value, [0.75, 0.5, 0]);
});

test("normalizes texture crop animation targets", () => {
  const scene = normalizeFbxScene(animatedTextureCropScene());

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureCropLeft",
    "textureCropTop",
    "textureCropRight",
    "textureCropBottom"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => {
    return track.keyframes.map((keyframe) => keyframe.value);
  }), [
    [1, 5],
    [2, 0],
    [3, 7],
    [4, 0]
  ]);
});

test("writes texture pivot animation curves", () => {
  const text = decode(exportFbx(animatedTexturePivotScene()));

  assert.match(text, /sampler_checker/);
  assert.match(text, /TextureRotationPivot/);
  assert.match(text, /TextureScalingPivot/);
  assert.match(text, /AnimationCurveNode/);
  assert.match(text, /AnimationCurve/);
});

test("writes texture crop animation curves", () => {
  const text = decode(exportFbx(animatedTextureCropScene()));

  assert.match(text, /sampler_checker/);
  assert.match(text, /CroppingLeft/);
  assert.match(text, /CroppingTop/);
  assert.match(text, /CroppingRight/);
  assert.match(text, /CroppingBottom/);
  assert.match(text, /AnimationCurveNode/);
  assert.match(text, /AnimationCurve/);
});

test("writes texture transform animation curves", () => {
  const text = decode(exportFbx(animatedTextureTransformScene()));

  assert.match(text, /sampler_checker/);
  assert.match(text, /Translation/);
  assert.match(text, /Scaling/);
  assert.match(text, /Rotation/);
  assert.match(text, /AnimationCurveNode/);
  assert.match(text, /AnimationCurve/);
});

test("Three.js FBXLoader parses texture wrap, offset, and repeat", async () => {
  const group = await parseWithFbxLoader(textureTransformScene());
  const texture = group.getObjectByName("Quad").material.map;

  assert.equal(texture.wrapS, RepeatWrapping);
  assert.equal(texture.wrapT, ClampToEdgeWrapping);
  assertClose(texture.offset.x, 0.25);
  assertClose(texture.offset.y, 0.5);
  assertClose(texture.repeat.x, 2);
  assertClose(texture.repeat.y, 3);
});

test("adapts Three.js texture transform tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAnimatedTextureTransformScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureTranslation",
    "textureScale",
    "textureRotation"
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].target, "sampler_checker");
  assert.deepEqual(scene.animations[0].tracks[0].keyframes.map((keyframe) => keyframe.value), [
    [0.25, 0.5, 0],
    [0.5, 0.75, 0]
  ]);
  assert.deepEqual(scene.animations[0].tracks[1].keyframes[1].value, [4, 5, 1]);
  assert.deepEqual(scene.animations[0].tracks[2].keyframes.map((keyframe) => keyframe.value), [
    [0, 0, 0.75],
    [0, 0, 1.25]
  ]);
});

test("collects Three.js clips attached directly to textures", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeTextureOwnedAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations.map((clip) => clip.name), ["TextureLocal"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["sampler_checker", "textureTranslation"],
    ["sampler_checker", "textureRotationZ"],
    ["sampler_checker", "textureScaleX"],
    ["sampler_checker", "textureCropLeft"]
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes[1].value, [0.5, 0.75, 0]);
  assert.deepEqual(scene.animations[0].tracks[1].keyframes.map((keyframe) => keyframe.value), [0.75, 1.25]);
  assert.deepEqual(scene.animations[0].tracks[2].keyframes.map((keyframe) => keyframe.value), [2, 4]);
  assert.deepEqual(scene.animations[0].tracks[3].keyframes.map((keyframe) => keyframe.value), [1, 5]);
});

test("adapts Three.js direct map object texture tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAnimatedMapObjectTextureTransformScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), ["sampler_checker"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), ["textureTranslation"]);
  assertVectorClose(scene.animations[0].tracks[0].keyframes[1].value, [0.35, 0.65, 0]);
});

test("adapts Three.js lightMap texture transform tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAnimatedLightMapTextureTransformScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), ["lightmap_checker"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), ["textureTranslation"]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes[1].value, [0.5, 0.75, 0]);
});

test("adapts Three.js specularIntensityMap texture transform tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAnimatedSpecularIntensityMapTextureTransformScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), ["specular_intensity"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), ["textureTranslation"]);
  assertVectorClose(scene.animations[0].tracks[0].keyframes[1].value, [0.4, 0.5, 0]);
});

test("adapts Three.js envMapRotation tracks to reflection texture rotation", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAnimatedEnvMapRotationTextureTransformScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), [
    "studio_env",
    "studio_env"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureRotation",
    "textureRotationZ"
  ]);
  assertVectorClose(scene.animations[0].tracks[0].keyframes[1].value, [0.4, 0.5, 0.6]);
  assertClose(scene.animations[0].tracks[1].keyframes[1].value, 0.9);
});

test("adapts Three.js matcap texture transform tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAnimatedMatcapTextureTransformScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), ["matcap_checker"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), ["textureTranslation"]);
  assertVectorClose(scene.animations[0].tracks[0].keyframes[1].value, [0.3, 0.4, 0]);
});

test("adapts Three.js gradientMap texture transform tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAnimatedGradientMapTextureTransformScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), ["toon_gradient"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), ["textureTranslation"]);
  assertVectorClose(scene.animations[0].tracks[0].keyframes[1].value, [0.32, 0.42, 0]);
});

test("adapts Three.js clearcoatMap texture transform tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAnimatedClearcoatTextureTransformScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), ["clearcoat_checker"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), ["textureTranslation"]);
  assertVectorClose(scene.animations[0].tracks[0].keyframes[1].value, [0.45, 0.55, 0]);
});

test("adapts Three.js clearcoat detail texture transform tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAnimatedClearcoatDetailTextureTransformScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), [
    "clearcoat_normal",
    "clearcoat_roughness"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureTranslation",
    "textureTranslation"
  ]);
  assertVectorClose(scene.animations[0].tracks[0].keyframes[1].value, [0.3, 0.4, 0]);
  assertVectorClose(scene.animations[0].tracks[1].keyframes[1].value, [0.45, 0.55, 0]);
});

test("adapts Three.js transmissionMap texture transform tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAnimatedTransmissionTextureTransformScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), ["transmission_checker"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), ["textureTranslation"]);
  assertVectorClose(scene.animations[0].tracks[0].keyframes[1].value, [0.35, 0.45, 0]);
});

test("adapts Three.js sheen texture transform tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAnimatedSheenTextureTransformScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), [
    "sheen_color",
    "sheen_roughness"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureTranslation",
    "textureTranslation"
  ]);
  assertVectorClose(scene.animations[0].tracks[0].keyframes[1].value, [0.4, 0.5, 0]);
  assertVectorClose(scene.animations[0].tracks[1].keyframes[1].value, [0.45, 0.55, 0]);
});

test("adapts Three.js physical extension texture transform tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAnimatedPhysicalExtensionTextureTransformScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), [
    "anisotropy_map",
    "iridescence_map",
    "iridescence_thickness_map",
    "thickness_map"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureTranslation",
    "textureTranslation",
    "textureTranslation",
    "textureTranslation"
  ]);
  assertVectorClose(scene.animations[0].tracks[0].keyframes[1].value, [0.3, 0.4, 0]);
  assertVectorClose(scene.animations[0].tracks[1].keyframes[1].value, [0.35, 0.45, 0]);
  assertVectorClose(scene.animations[0].tracks[2].keyframes[1].value, [0.4, 0.5, 0]);
  assertVectorClose(scene.animations[0].tracks[3].keyframes[1].value, [0.45, 0.55, 0]);
});

test("adapts Three.js userData texture alias transform tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAnimatedUserDataTextureAliasTransformScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), [
    "roughness_alias",
    "alpha_alias"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureTranslation",
    "textureTranslation"
  ]);
  assertVectorClose(scene.animations[0].tracks[0].keyframes[1].value, [0.3, 0.4, 0]);
  assertVectorClose(scene.animations[0].tracks[1].keyframes[1].value, [0.45, 0.55, 0]);
});

test("adapts Three.js path-prefixed texture animation tracks", () => {
  const scene = normalizeFbxScene(fromThreeObject(threePathAnimatedTextureTransformScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.nodes.map((node) => node.name), ["Rig"]);
  assert.equal(scene.meshes[0].parent, "Rig");
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), ["sampler_checker"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), ["textureTranslation"]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes[1].value, [0.5, 0.75, 0]);
});

test("adapts Three.js texture transform tracks for Blender-compatible mapping", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAnimatedTextureTransformScene(), {
    bakeAnimations: false,
    frameRate: 30
  }), { textureTransformMode: "blender" });

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureTranslation",
    "textureScale",
    "textureRotation"
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].target, "sampler_checker");
  assertVectorClose(scene.animations[0].tracks[0].keyframes[1].value, [0.5, 0.75, 0]);
  assertVectorClose(scene.animations[0].tracks[1].keyframes[0].value, [0.5, 1 / 3, 1]);
  assertVectorClose(scene.animations[0].tracks[1].keyframes[1].value, [0.25, 0.2, 1]);
  assert.deepEqual(scene.animations[0].tracks[2].keyframes.map((keyframe) => keyframe.value), [
    [0, 0, -0.75],
    [0, 0, -1.25]
  ]);
});

test("adapts Three.js texture component tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAnimatedTextureComponentScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureTranslationX",
    "textureScaleY",
    "textureRotationZ",
    "textureRotationPivotX",
    "textureScalingPivotX"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), [
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker"
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes.map((keyframe) => keyframe.value), [0.25, 0.5]);
  assert.deepEqual(scene.animations[0].tracks[1].keyframes.map((keyframe) => keyframe.value), [3, 5]);
  assert.deepEqual(scene.animations[0].tracks[2].keyframes.map((keyframe) => keyframe.value), [0.75, 1.25]);
  assert.deepEqual(scene.animations[0].tracks[3].keyframes.map((keyframe) => keyframe.value), [0.5, 0.75]);
  assert.deepEqual(scene.animations[0].tracks[4].keyframes.map((keyframe) => keyframe.value), [0.5, 0.75]);
});

test("normalizes texture component tracks for Blender-compatible mapping", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAnimatedTextureComponentScene(), {
    bakeAnimations: false,
    frameRate: 30
  }), { textureTransformMode: "blender" });

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureTranslationX",
    "textureScaleY",
    "textureRotationZ",
    "textureRotationPivotX",
    "textureScalingPivotX"
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes.map((keyframe) => keyframe.value), [0.25, 0.5]);
  assertVectorClose(scene.animations[0].tracks[1].keyframes.map((keyframe) => keyframe.value), [1 / 3, 0.2]);
  assert.deepEqual(scene.animations[0].tracks[2].keyframes.map((keyframe) => keyframe.value), [-0.75, -1.25]);
});

test("adapts Three.js texture matrix tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAnimatedTextureMatrixScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureTranslation",
    "textureRotation",
    "textureScale"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), [
    "sampler_checker",
    "sampler_checker",
    "sampler_checker"
  ]);
  assertVectorClose(scene.animations[0].tracks[0].keyframes[0].value, [0.125, -0.25, 0]);
  assertVectorClose(scene.animations[0].tracks[1].keyframes[0].value, [0, 0, 0.5]);
  assertVectorClose(scene.animations[0].tracks[2].keyframes[1].value, [4, 5, 1]);
});

test("adapts Three.js nested texture transform tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeNestedAnimatedTextureTransformScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureTranslation",
    "textureRotation",
    "textureScale",
    "textureRotationPivot",
    "textureScalingPivot"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), [
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker"
  ]);
  assertVectorClose(scene.animations[0].tracks[0].keyframes[0].value, [0.2, 0.4, 0]);
  assertVectorClose(scene.animations[0].tracks[1].keyframes[1].value, [0, 0, 0.75]);
  assertVectorClose(scene.animations[0].tracks[2].keyframes[1].value, [7, 8, 1]);
  assertVectorClose(scene.animations[0].tracks[3].keyframes[0].value, [0.3, 0.7, 0]);
  assertVectorClose(scene.animations[0].tracks[4].keyframes[1].value, [0.4, 0.8, 0]);
});

test("adapts Three.js direct source texture transform tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeSourceAnimatedTextureTransformScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureTranslation",
    "textureScale",
    "textureRotation",
    "textureRotationPivot",
    "textureScalingPivot"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), [
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker"
  ]);
  assertVectorClose(scene.animations[0].tracks[0].keyframes[1].value, [0.35, 0.45, 0]);
  assertVectorClose(scene.animations[0].tracks[1].keyframes[1].value, [4, 5, 1]);
  assertVectorClose(scene.animations[0].tracks[2].keyframes[1].value, [0, 0, 0.6]);
  assertVectorClose(scene.animations[0].tracks[3].keyframes[1].value, [0.3, 0.4, 0]);
  assertVectorClose(scene.animations[0].tracks[4].keyframes[1].value, [0.3, 0.4, 0]);
});

test("adapts Three.js texture-owned userData matrix tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeTextureOwnedMatrixAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations.map((clip) => clip.name), ["TextureLocalMatrix"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureTranslation",
    "textureRotation",
    "textureScale"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), [
    "sampler_checker",
    "sampler_checker",
    "sampler_checker"
  ]);
  assertVectorClose(scene.animations[0].tracks[0].keyframes[0].value, [0.125, -0.25, 0]);
  assertVectorClose(scene.animations[0].tracks[1].keyframes[0].value, [0, 0, 0.5]);
  assertVectorClose(scene.animations[0].tracks[2].keyframes[1].value, [4, 5, 1]);
});

test("adapts Three.js texture-owned nested matrix tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeTextureOwnedNestedMatrixAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations.map((clip) => clip.name), ["NestedTextureLocalMatrix"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureTranslation",
    "textureRotation",
    "textureScale"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), [
    "sampler_checker",
    "sampler_checker",
    "sampler_checker"
  ]);
  assertVectorClose(scene.animations[0].tracks[0].keyframes[0].value, [0.625, 0.125, 0]);
  assertVectorClose(scene.animations[0].tracks[1].keyframes[0].value, [0, 0, 0.6]);
  assertVectorClose(scene.animations[0].tracks[2].keyframes[1].value, [9, 10, 1]);
});

test("collects Three.js clips attached to texture media owners", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeTextureMediaOwnedAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations.map((clip) => clip.name), ["TextureMediaLocal"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["sampler_checker", "textureTranslation"],
    ["sampler_checker", "textureRotation"],
    ["sampler_checker", "textureRotationPivot"],
    ["sampler_checker", "textureScalingPivot"]
  ]);
  assertVectorClose(scene.animations[0].tracks[0].keyframes[1].value, [0.4, 0.5, 0]);
  assertVectorClose(scene.animations[0].tracks[1].keyframes[1].value, [0, 0, 0.65]);
  assertVectorClose(scene.animations[0].tracks[2].keyframes[1].value, [0.3, 0.4, 0]);
  assertVectorClose(scene.animations[0].tracks[3].keyframes[1].value, [0.3, 0.4, 0]);
});

test("collects Three.js clips attached to texture userData media element owners", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeTextureUserDataMediaElementOwnedAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations.map((clip) => clip.name), ["TextureMediaElementLocal"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["sampler_checker", "textureTranslation"],
    ["sampler_checker", "textureScale"]
  ]);
  assertVectorClose(scene.animations[0].tracks[0].keyframes[1].value, [0.42, 0.52, 0]);
  assertVectorClose(scene.animations[0].tracks[1].keyframes[1].value, [4, 5, 1]);
});

test("adapts Three.js texture center tracks into rotation and scaling pivot curves", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAnimatedTexturePivotScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureRotationPivot",
    "textureScalingPivot"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), [
    "sampler_checker",
    "sampler_checker"
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes[1].value, [0.75, 0.5, 0]);
  assert.deepEqual(scene.animations[0].tracks[1].keyframes[1].value, [0.75, 0.5, 0]);
});

test("adapts Three.js texture crop tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeAnimatedTextureCropScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureCropLeft",
    "textureCropTop",
    "textureCropRight",
    "textureCropBottom"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), [
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.keyframes[1].value), [5, 0, 7, 0]);
});

test("adapts Three.js texture sampler values before export", async () => {
  const scene = fromThreeObject(threeTextureTransformScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.wrapU, "repeat");
  assert.equal(texture.wrapV, "clamp");
  assert.deepEqual(texture.translation, [0.25, 0.5, 0]);
  assert.deepEqual(texture.rotation, [0, 0, 0.75]);
  assert.deepEqual(texture.scale, [2, 3, 1]);
  assert.deepEqual(texture.rotationPivot, [0.5, 0.25, 0]);
  assert.deepEqual(texture.scalingPivot, [0.5, 0.25, 0]);

  const group = await parseWithFbxLoader(threeTextureTransformScene());
  const exportedTexture = group.getObjectByName("Quad").material.map;
  assert.equal(exportedTexture.wrapS, RepeatWrapping);
  assertClose(exportedTexture.repeat.x, 2);
});

test("adapts Three.js baked texture matrix values before export", () => {
  const scene = fromThreeObject(threeTextureMatrixScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assertVectorClose(texture.translation, [0.125, -0.25, 0]);
  assertVectorClose(texture.rotation, [0, 0, 0.5]);
  assertVectorClose(texture.scale, [2, 3, 1]);
  assert.deepEqual(texture.rotationPivot, [0, 0, 0]);
  assert.deepEqual(texture.scalingPivot, [0, 0, 0]);
});

test("adapts Three.js userData texture matrix values before export", () => {
  const scene = fromThreeObject(threeTextureUserDataMatrixScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assertVectorClose(texture.translation, [0.375, -0.125, 0]);
  assertVectorClose(texture.rotation, [0, 0, 0.25]);
  assertVectorClose(texture.scale, [3, 4, 1]);
  assert.deepEqual(texture.rotationPivot, [0, 0, 0]);
  assert.deepEqual(texture.scalingPivot, [0, 0, 0]);
});

test("adapts Three.js userData texture transform aliases before export", () => {
  const scene = fromThreeObject(threeTextureUserDataTransformScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assertVectorClose(texture.translation, [0.125, 0.625, 0]);
  assertVectorClose(texture.rotation, [0, 0, 0.35]);
  assertVectorClose(texture.scale, [3, 4, 1]);
  assert.deepEqual(texture.rotationPivot, [0.25, 0.75, 0]);
  assert.deepEqual(texture.scalingPivot, [0.25, 0.75, 0]);
});

test("adapts Three.js nested texture transform aliases before export", () => {
  const scene = fromThreeObject(threeTextureNestedTransformScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assertVectorClose(texture.translation, [0.2, 0.4, 0]);
  assertVectorClose(texture.rotation, [0, 0, 0.45]);
  assertVectorClose(texture.scale, [5, 6, 1]);
  assert.deepEqual(texture.rotationPivot, [0.3, 0.7, 0]);
  assert.deepEqual(texture.scalingPivot, [0.3, 0.7, 0]);
});

test("adapts Three.js direct source texture transform aliases before export", () => {
  const scene = fromThreeObject(threeTextureDirectSourceTransformScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assertVectorClose(texture.translation, [0.22, 0.42, 0]);
  assertVectorClose(texture.rotation, [0, 0, 0.55]);
  assertVectorClose(texture.scale, [5.5, 6.5, 1]);
  assert.deepEqual(texture.rotationPivot, [0.35, 0.75, 0]);
  assert.deepEqual(texture.scalingPivot, [0.35, 0.75, 0]);
});

test("adapts Three.js userData source texture transform aliases before export", () => {
  const scene = fromThreeObject(threeTextureUserDataSourceTransformScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assertVectorClose(texture.translation, [0.24, 0.44, 0]);
  assertVectorClose(texture.rotation, [0, 0, 0.65]);
  assertVectorClose(texture.scale, [5.25, 6.25, 1]);
  assert.deepEqual(texture.rotationPivot, [0.32, 0.72, 0]);
  assert.deepEqual(texture.scalingPivot, [0.32, 0.72, 0]);
});

test("adapts Three.js media texture transform aliases before export", () => {
  const scene = fromThreeObject(threeTextureMediaTransformScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assertVectorClose(texture.translation, [0.28, 0.48, 0]);
  assertVectorClose(texture.rotation, [0, 0, 0.85]);
  assertVectorClose(texture.scale, [5.75, 6.75, 1]);
  assert.deepEqual(texture.rotationPivot, [0.38, 0.78, 0]);
  assert.deepEqual(texture.scalingPivot, [0.38, 0.78, 0]);
});

test("adapts Three.js userData video texture transform aliases before export", () => {
  const scene = fromThreeObject(threeTextureUserDataVideoTransformScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assertVectorClose(texture.translation, [0.26, 0.46, 0]);
  assertVectorClose(texture.rotation, [0, 0, 0.75]);
  assertVectorClose(texture.scale, [5.35, 6.35, 1]);
  assert.deepEqual(texture.rotationPivot, [0.34, 0.74, 0]);
  assert.deepEqual(texture.scalingPivot, [0.34, 0.74, 0]);
});

test("adapts Three.js userData media element texture transform aliases before export", () => {
  const scene = fromThreeObject(threeTextureUserDataMediaElementTransformScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assertVectorClose(texture.translation, [0.29, 0.49, 0]);
  assertVectorClose(texture.rotation, [0, 0, 0.95]);
  assertVectorClose(texture.scale, [5.85, 6.85, 1]);
  assert.deepEqual(texture.rotationPivot, [0.39, 0.79, 0]);
  assert.deepEqual(texture.scalingPivot, [0.39, 0.79, 0]);
});

test("adapts Three.js nested texture matrix values before export", () => {
  const scene = fromThreeObject(threeTextureNestedMatrixScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assertVectorClose(texture.translation, [0.625, 0.125, 0]);
  assertVectorClose(texture.rotation, [0, 0, 0.6]);
  assertVectorClose(texture.scale, [7, 8, 1]);
  assert.deepEqual(texture.rotationPivot, [0, 0, 0]);
  assert.deepEqual(texture.scalingPivot, [0, 0, 0]);
});

test("adapts Three.js texture mapping metadata", () => {
  const source = threeTextureTransformScene();
  const texture = source.getObjectByName("Quad").material.map;
  texture.mapping = CubeReflectionMapping;
  texture.userData.uvSwap = true;

  const scene = fromThreeObject(source);
  const exportedTexture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(exportedTexture.mappingType, 4);
  assert.equal(exportedTexture.uvSwap, true);
});

test("adapts explicit Three.js texture pivot overrides", () => {
  const source = threeTextureTransformScene();
  const texture = source.getObjectByName("Quad").material.map;
  texture.userData.textureRotationPivot = [0.1, 0.2, 0];
  texture.userData.textureScalingPivot = { x: 0.3, y: 0.4 };

  const scene = fromThreeObject(source);
  const exportedTexture = scene.meshes[0].materials[0].diffuseTexture;

  assert.deepEqual(exportedTexture.rotationPivot, [0.1, 0.2, 0]);
  assert.deepEqual(exportedTexture.scalingPivot, [0.3, 0.4, 0]);
});

test("maps mirrored repeat to repeat because FBXLoader exposes only repeat or clamp", () => {
  const scene = fromThreeObject(threeTextureTransformScene({ wrapS: MirroredRepeatWrapping }));
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.wrapU, "repeat");
});

test("Blender imports Blender-compatible texture transforms", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "texture-transform.fbx");
  await writeFile(fbxPath, exportFbx(textureTransformScene(), { textureTransformMode: "blender" }));

  const result = spawnSync(blenderPath, blenderTestArgs(mappingNodePayloadScript(), fbxPath), {
    encoding: "utf8"
  });

  await rm(tempDir, { recursive: true, force: true });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const match = result.stdout.match(/FBX_VALIDATE:(.+)/);
  assert.ok(match, result.stdout);
  const info = JSON.parse(match[1]);
  assert.deepEqual(info.Location, [0.25, 0.5, 0]);
  assert.deepEqual(info.Rotation, [0, 0, 0.75]);
  assert.deepEqual(info.Scale, [2, 3, 1]);
});
