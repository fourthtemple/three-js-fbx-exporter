import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  AnimationClip,
  AdditiveBlending,
  AlwaysDepth,
  BackSide,
  BufferGeometry,
  ConstantColorFactor,
  ColorKeyframeTrack,
  CustomBlending,
  DecrementStencilOp,
  DoubleSide,
  Float32BufferAttribute,
  IncrementStencilOp,
  LessEqualStencilFunc,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshPhongMaterial,
  NumberKeyframeTrack,
  Object3D,
  OneFactor,
  OneMinusDstColorFactor,
  Plane,
  ReverseSubtractEquation,
  ReplaceStencilOp,
  SrcAlphaFactor,
  SubtractEquation,
  Vector3,
  VectorKeyframeTrack
} from "three";
import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { roughnessToFbxShininess } from "../src/material/material-normalizer.js";
import { linearColorComponentToFbx } from "../src/three/three-color-adapter.js";
import { blenderPath, blenderTestArgs, decode, hasBlender } from "./fbx-test-helpers.js";

function materialAnimationScene() {
  return {
    name: "MaterialAnimationScene",
    meshes: [
      {
        name: "TintedQuad",
        materials: [
          {
            name: "AnimatedMat",
            diffuseColor: [1, 0, 0]
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
        name: "Tint",
        frameRate: 30,
        tracks: [
          {
            target: "AnimatedMat",
            property: "diffuseColor",
            keyframes: [
              { frame: 0, value: [1, 0, 0] },
              { frame: 30, value: [0, 0, 1] }
            ]
          }
        ]
      }
    ]
  };
}

function materialOpacityAnimationScene() {
  return {
    name: "MaterialOpacityAnimationScene",
    meshes: [
      {
        name: "FadeQuad",
        materials: [
          {
            name: "FadeMat",
            diffuseColor: [0.2, 0.6, 1],
            opacity: 1
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
        name: "Fade",
        frameRate: 30,
        tracks: [
          {
            target: "FadeMat",
            property: "opacity",
            keyframes: [
              { frame: 0, value: 1 },
              { frame: 30, value: 0.25 }
            ]
          }
        ]
      }
    ]
  };
}

function materialColorChannelAnimationScene() {
  return {
    name: "MaterialColorChannelAnimationScene",
    meshes: [
      {
        name: "ColorQuad",
        materials: [
          {
            name: "ColorMat",
            diffuseColor: [0.5, 0.5, 0.5],
            emissiveColor: [0, 0, 0.2],
            ambientColor: [0.1, 0.1, 0.1],
            specularColor: [0.2, 0.2, 0.2],
            transparentColor: [0, 0, 0]
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
        name: "ColorSweep",
        frameRate: 30,
        tracks: [
          {
            target: "ColorMat",
            property: "emissiveColor",
            keyframes: [
              { frame: 0, value: [0, 0, 0.2] },
              { frame: 30, value: [0.4, 0.5, 1] }
            ]
          },
          {
            target: "ColorMat",
            property: "ambientColor",
            keyframes: [
              { frame: 0, value: [0.1, 0.1, 0.1] },
              { frame: 30, value: [0.2, 0.3, 0.4] }
            ]
          },
          {
            target: "ColorMat",
            property: "specularColor",
            keyframes: [
              { frame: 0, value: [0.2, 0.2, 0.2] },
              { frame: 30, value: [1, 0.8, 0.3] }
            ]
          },
          {
            target: "ColorMat",
            property: "transparentColor",
            keyframes: [
              { frame: 0, value: [0, 0, 0] },
              { frame: 30, value: [0.1, 0.2, 0.3] }
            ]
          }
        ]
      }
    ]
  };
}

function materialColorComponentAnimationScene() {
  return {
    name: "MaterialColorComponentAnimationScene",
    meshes: [
      {
        name: "ColorComponentQuad",
        materials: [
          {
            name: "ColorComponentMat",
            diffuseColor: [0.25, 0.5, 0.75],
            emissiveColor: [0, 0, 0.1],
            specularColor: [0.2, 0.2, 0.2]
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
        name: "ColorComponents",
        frameRate: 30,
        tracks: [
          {
            target: "ColorComponentMat",
            property: "colorR",
            keyframes: [
              { frame: 0, value: 0.25 },
              { frame: 30, value: 1 }
            ]
          },
          {
            target: "ColorComponentMat",
            property: "materialEmissiveColorB",
            keyframes: [
              { frame: 0, value: 0.1 },
              { frame: 30, value: 0.8 }
            ]
          },
          {
            target: "ColorComponentMat",
            property: "specularColorG",
            keyframes: [
              { frame: 0, value: 0.2 },
              { frame: 30, value: 0.6 }
            ]
          }
        ]
      }
    ]
  };
}

function materialScalarAnimationScene() {
  return {
    name: "MaterialScalarAnimationScene",
    meshes: [
      {
        name: "ScalarQuad",
        materials: [
          {
            name: "ScalarMat",
            diffuseColor: [0.4, 0.4, 0.4],
            diffuseFactor: 0.8,
            transparencyFactor: 0.2,
            emissiveFactor: 0.2,
            ambientFactor: 0.3,
            specularFactor: 0.4,
            shininess: 30,
            bumpFactor: 0.5,
            displacementFactor: 0.6,
            vectorDisplacementFactor: 0.7,
            reflectionFactor: 0.1
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
        name: "ScalarSweep",
        frameRate: 30,
        tracks: [
          { target: "ScalarMat", property: "diffuseFactor", keyframes: [{ frame: 0, value: 0.8 }, { frame: 30, value: 0.3 }] },
          { target: "ScalarMat", property: "transparencyFactor", keyframes: [{ frame: 0, value: 0.2 }, { frame: 30, value: 0.75 }] },
          { target: "ScalarMat", property: "emissiveFactor", keyframes: [{ frame: 0, value: 0.2 }, { frame: 30, value: 0.9 }] },
          { target: "ScalarMat", property: "ambientFactor", keyframes: [{ frame: 0, value: 0.3 }, { frame: 30, value: 0.7 }] },
          { target: "ScalarMat", property: "specularFactor", keyframes: [{ frame: 0, value: 0.4 }, { frame: 30, value: 0.8 }] },
          { target: "ScalarMat", property: "shininess", keyframes: [{ frame: 0, value: 30 }, { frame: 30, value: 90 }] },
          { target: "ScalarMat", property: "bumpFactor", keyframes: [{ frame: 0, value: 0.5 }, { frame: 30, value: 0.25 }] },
          { target: "ScalarMat", property: "displacementFactor", keyframes: [{ frame: 0, value: 0.6 }, { frame: 30, value: 1.2 }] },
          { target: "ScalarMat", property: "vectorDisplacementFactor", keyframes: [{ frame: 0, value: 0.7 }, { frame: 30, value: 1.4 }] },
          { target: "ScalarMat", property: "reflectionFactor", keyframes: [{ frame: 0, value: 0.1 }, { frame: 30, value: 0.6 }] }
        ]
      }
    ]
  };
}

function threeMaterialAnimationScene() {
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

  const material = new MeshBasicMaterial({ name: "AnimatedMat", color: 0xff0000 });
  const mesh = new Mesh(geometry, material);
  mesh.name = "TintedQuad";

  const root = new Object3D();
  root.name = "ThreeMaterialAnimationScene";
  root.add(mesh);
  root.animations = [
    new AnimationClip("Tint", 1, [
      new ColorKeyframeTrack("TintedQuad.material.color", [0, 1], [
        1, 0, 0,
        0, 0, 1
      ])
    ])
  ];
  return root;
}

function threeMaterialOwnedAnimationScene() {
  const root = threeMaterialAnimationScene();
  const material = root.getObjectByName("TintedQuad").material;
  root.animations = [];
  material.transparent = true;
  material.opacity = 1;
  material.animations = [
    new AnimationClip("MaterialLocal", 1, [
      new ColorKeyframeTrack("color", [0, 1], [
        1, 0, 0,
        0, 1, 0
      ]),
      new NumberKeyframeTrack("opacity", [0, 1], [1, 0.4])
    ])
  ];
  return root;
}

function threeMaterialUserDataOwnedAnimationScene() {
  const root = threeMaterialAnimationScene();
  const material = root.getObjectByName("TintedQuad").material;
  root.animations = [];
  material.transparent = true;
  material.opacity = 1;
  material.userData.animations = [
    new AnimationClip("MaterialUserDataLocal", 1, [
      new ColorKeyframeTrack("color", [0, 1], [
        1, 0, 0,
        0, 0.5, 1
      ]),
      new NumberKeyframeTrack("opacity", [0, 1], [1, 0.35])
    ])
  ];
  return root;
}

function threeMaterialColorChannelAnimationScene() {
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

  const material = new MeshPhongMaterial({
    name: "ColorMat",
    color: 0x808080,
    emissive: 0x000033,
    specular: 0x333333
  });
  material.transparentColor = { r: 0, g: 0, b: 0 };
  const mesh = new Mesh(geometry, material);
  mesh.name = "ColorQuad";

  const root = new Object3D();
  root.name = "ThreeMaterialColorChannelAnimationScene";
  root.add(mesh);
  root.animations = [
    new AnimationClip("ColorSweep", 1, [
      new ColorKeyframeTrack("ColorQuad.material.emissive", [0, 1], [
        0, 0, 0.2,
        0.4, 0.5, 1
      ]),
      new ColorKeyframeTrack("ColorQuad.material.specular", [0, 1], [
        0.2, 0.2, 0.2,
        1, 0.8, 0.3
      ]),
      new ColorKeyframeTrack("ColorQuad.material.transparentColor", [0, 1], [
        0, 0, 0,
        0.1, 0.2, 0.3
      ])
    ])
  ];
  return root;
}

function threeMaterialColorComponentAnimationScene() {
  const scene = threeMaterialColorChannelAnimationScene();
  scene.name = "ThreeMaterialColorComponentAnimationScene";
  const mesh = scene.children[0];
  mesh.name = "ColorComponentQuad";
  mesh.material.name = "ColorComponentMat";
  scene.animations = [
    new AnimationClip("ColorComponents", 1, [
      new NumberKeyframeTrack("ColorComponentQuad.material.color[r]", [0, 1], [0.5, 1]),
      new NumberKeyframeTrack("ColorComponentQuad.material.emissive[2]", [0, 1], [0.2, 0.8]),
      new NumberKeyframeTrack("ColorComponentQuad.material.specular.g", [0, 1], [0.2, 0.6])
    ])
  ];
  return scene;
}

function threeMaterialScalarAnimationScene() {
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

  const material = new MeshPhongMaterial({
    name: "ScalarMat",
    color: 0x666666,
    emissive: 0x000000,
    emissiveIntensity: 0.2,
    shininess: 30,
    reflectivity: 0.1
  });
  material.transparencyFactor = 0.2;
  material.lightMapIntensity = 0.3;
  material.specularIntensity = 0.4;
  material.sheen = 0.2;
  material.sheenRoughness = 0.6;
  material.transmission = 0.15;
  material.clearcoatRoughness = 0.4;
  material.bumpScale = 0.5;
  material.displacementScale = 0.6;
  material.vectorDisplacementScale = 0.7;
  const mesh = new Mesh(geometry, material);
  mesh.name = "ScalarQuad";

  const root = new Object3D();
  root.name = "ThreeMaterialScalarAnimationScene";
  root.add(mesh);
  root.animations = [
    new AnimationClip("ScalarSweep", 1, [
      new NumberKeyframeTrack("ScalarQuad.material.emissiveIntensity", [0, 1], [0.2, 0.9]),
      new NumberKeyframeTrack("ScalarQuad.material.transparencyFactor", [0, 1], [0.2, 0.75]),
      new NumberKeyframeTrack("ScalarQuad.material.transmission", [0, 1], [0.15, 0.5]),
      new NumberKeyframeTrack("ScalarQuad.material.lightMapIntensity", [0, 1], [0.3, 0.7]),
      new NumberKeyframeTrack("ScalarQuad.material.specularIntensity", [0, 1], [0.4, 0.85]),
      new NumberKeyframeTrack("ScalarQuad.material.sheen", [0, 1], [0.2, 0.65]),
      new NumberKeyframeTrack("ScalarQuad.material.shininess", [0, 1], [30, 90]),
      new NumberKeyframeTrack("ScalarQuad.material.roughness", [0, 1], [0.7, 0.2]),
      new NumberKeyframeTrack("ScalarQuad.material.sheenRoughness", [0, 1], [0.6, 0.25]),
      new NumberKeyframeTrack("ScalarQuad.material.clearcoatRoughness", [0, 1], [0.4, 0.18]),
      new NumberKeyframeTrack("ScalarQuad.material.bumpScale", [0, 1], [0.5, 0.25]),
      new VectorKeyframeTrack("ScalarQuad.material.normalScale", [0, 1], [
        0.5, 0.75,
        0.2, 0.4
      ]),
      new NumberKeyframeTrack("ScalarQuad.material.normalScale.y", [0, 1], [0.75, 0.35]),
      new VectorKeyframeTrack("ScalarQuad.material.clearcoatNormalScale", [0, 1], [
        0.6, 0.7,
        0.32, 0.42
      ]),
      new NumberKeyframeTrack("ScalarQuad.material.displacementScale", [0, 1], [0.6, 1.2]),
      new NumberKeyframeTrack("ScalarQuad.material.vectorDisplacementScale", [0, 1], [0.7, 1.4]),
      new NumberKeyframeTrack("ScalarQuad.material.reflectivity", [0, 1], [0.1, 0.6]),
      new NumberKeyframeTrack("ScalarQuad.material.envMapIntensity", [0, 1], [0.2, 0.45]),
      new NumberKeyframeTrack("ScalarQuad.material.clearcoat", [0, 1], [0.1, 0.55]),
      new NumberKeyframeTrack("ScalarQuad.material.metalness", [0, 1], [0.1, 0.8])
    ])
  ];
  return root;
}

function threeMaterialPhysicalExtensionAnimationScene() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0,
    -1, 1, 0
  ], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);

  const material = new MeshPhysicalMaterial({
    name: "PhysicalExtensionMat",
    color: 0x666666
  });
  material.anisotropy = 0.1;
  material.anisotropyRotation = 0.2;
  material.iridescence = 0.3;
  material.iridescenceIOR = 1.35;
  material.iridescenceThicknessRange = [120, 340];
  material.thickness = 0.4;
  material.attenuationColor.setRGB(0.1, 0.2, 0.3);
  material.attenuationDistance = 5;
  material.ior = 1.45;
  material.dispersion = 0.01;

  const mesh = new Mesh(geometry, material);
  mesh.name = "ExtensionQuad";
  const root = new Object3D();
  root.name = "ThreeMaterialPhysicalExtensionAnimationScene";
  root.add(mesh);
  root.animations = [
    new AnimationClip("PhysicalExtensionSweep", 1, [
      new NumberKeyframeTrack("ExtensionQuad.material.anisotropy", [0, 1], [0.1, 0.7]),
      new NumberKeyframeTrack("ExtensionQuad.material.anisotropyRotation", [0, 1], [0.2, 0.6]),
      new NumberKeyframeTrack("ExtensionQuad.material.iridescence", [0, 1], [0.3, 0.8]),
      new NumberKeyframeTrack("ExtensionQuad.material.iridescenceIOR", [0, 1], [1.35, 1.5]),
      new NumberKeyframeTrack("ExtensionQuad.material.iridescenceThicknessRange[0]", [0, 1], [120, 160]),
      new NumberKeyframeTrack("ExtensionQuad.material.iridescenceThicknessRange[1]", [0, 1], [340, 420]),
      new NumberKeyframeTrack("ExtensionQuad.material.thickness", [0, 1], [0.4, 0.9]),
      new ColorKeyframeTrack("ExtensionQuad.material.attenuationColor", [0, 1], [
        0.1, 0.2, 0.3,
        0.4, 0.5, 0.6
      ]),
      new NumberKeyframeTrack("ExtensionQuad.material.attenuationDistance", [0, 1], [5, 9]),
      new NumberKeyframeTrack("ExtensionQuad.material.ior", [0, 1], [1.45, 1.7]),
      new NumberKeyframeTrack("ExtensionQuad.material.dispersion", [0, 1], [0.01, 0.05])
    ])
  ];
  return root;
}

function threeMaterialTextureControlAnimationScene() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0,
    -1, 1, 0
  ], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);

  const material = new MeshPhysicalMaterial({
    name: "TextureControlMat",
    color: 0x666666,
    alphaTest: 0.2
  });
  material.aoMapIntensity = 0.3;
  material.displacementBias = -0.1;
  material.normalMapType = 0;

  const mesh = new Mesh(geometry, material);
  mesh.name = "TextureControlQuad";
  const root = new Object3D();
  root.name = "ThreeMaterialTextureControlAnimationScene";
  root.add(mesh);
  root.animations = [
    new AnimationClip("TextureControlSweep", 1, [
      new NumberKeyframeTrack("TextureControlQuad.material.aoMapIntensity", [0, 1], [0.3, 0.8]),
      new NumberKeyframeTrack("TextureControlQuad.material.displacementBias", [0, 1], [-0.1, -0.35]),
      new NumberKeyframeTrack("TextureControlQuad.material.alphaTest", [0, 1], [0.2, 0.55]),
      new NumberKeyframeTrack("TextureControlQuad.material.normalMapType", [0, 1], [0, 1])
    ])
  ];
  return root;
}

function threeMaterialRenderStateAnimationScene() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0,
    -1, 1, 0
  ], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);

  const material = new MeshBasicMaterial({
    name: "RenderStateMat",
    color: 0x666666,
    side: DoubleSide,
    blending: CustomBlending,
    blendSrc: SrcAlphaFactor,
    blendDst: OneMinusDstColorFactor,
    blendEquation: ReverseSubtractEquation,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: ConstantColorFactor,
    blendEquationAlpha: SubtractEquation,
    blendAlpha: 0.2,
    depthFunc: AlwaysDepth,
    depthTest: true,
    depthWrite: true,
    colorWrite: true,
    vertexColors: false,
    fog: true,
    visible: true,
    allowOverride: true,
    shadowSide: null,
    polygonOffset: false,
    polygonOffsetFactor: 0,
    polygonOffsetUnits: 0,
    stencilWrite: false,
    stencilWriteMask: 0xff,
    stencilFunc: 519,
    stencilRef: 0,
    stencilFuncMask: 0xff,
    stencilFail: 7680,
    stencilZFail: 7680,
    stencilZPass: 7680,
    clipIntersection: false,
    clipShadows: false,
    alphaHash: false,
    alphaToCoverage: false,
    premultipliedAlpha: false,
    forceSinglePass: false,
    toneMapped: true,
    wireframe: false,
    wireframeLinewidth: 1
  });
  material.blendColor.setRGB(0.1, 0.2, 0.3);
  material.clippingPlanes = [new Plane(new Vector3(0, 1, 0), -0.5)];
  material.dithering = false;

  const mesh = new Mesh(geometry, material);
  mesh.name = "RenderStateQuad";
  const root = new Object3D();
  root.name = "ThreeMaterialRenderStateAnimationScene";
  root.add(mesh);
  root.animations = [
    new AnimationClip("RenderStateSweep", 1, [
      new NumberKeyframeTrack("RenderStateQuad.material.side", [0, 1], [DoubleSide, BackSide]),
      new NumberKeyframeTrack("RenderStateQuad.material.blending", [0, 1], [CustomBlending, AdditiveBlending]),
      new NumberKeyframeTrack("RenderStateQuad.material.blendSrc", [0, 1], [SrcAlphaFactor, OneFactor]),
      new NumberKeyframeTrack("RenderStateQuad.material.blendDst", [0, 1], [OneMinusDstColorFactor, ConstantColorFactor]),
      new NumberKeyframeTrack("RenderStateQuad.material.blendEquation", [0, 1], [ReverseSubtractEquation, SubtractEquation]),
      new NumberKeyframeTrack("RenderStateQuad.material.blendSrcAlpha", [0, 1], [OneFactor, SrcAlphaFactor]),
      new NumberKeyframeTrack("RenderStateQuad.material.blendDstAlpha", [0, 1], [ConstantColorFactor, OneMinusDstColorFactor]),
      new NumberKeyframeTrack("RenderStateQuad.material.blendEquationAlpha", [0, 1], [SubtractEquation, ReverseSubtractEquation]),
      new NumberKeyframeTrack("RenderStateQuad.material.blendAlpha", [0, 1], [0.2, 0.75]),
      new ColorKeyframeTrack("RenderStateQuad.material.blendColor", [0, 1], [
        0.1, 0.2, 0.3,
        0.6, 0.4, 0.2
      ]),
      new NumberKeyframeTrack("RenderStateQuad.material.depthFunc", [0, 1], [AlwaysDepth, 3]),
      new NumberKeyframeTrack("RenderStateQuad.material.depthTest", [0, 1], [1, 0]),
      new NumberKeyframeTrack("RenderStateQuad.material.depthWrite", [0, 1], [1, 0]),
      new NumberKeyframeTrack("RenderStateQuad.material.colorWrite", [0, 1], [1, 0]),
      new NumberKeyframeTrack("RenderStateQuad.material.vertexColors", [0, 1], [0, 1]),
      new NumberKeyframeTrack("RenderStateQuad.material.fog", [0, 1], [1, 0]),
      new NumberKeyframeTrack("RenderStateQuad.material.visible", [0, 1], [1, 0]),
      new NumberKeyframeTrack("RenderStateQuad.material.allowOverride", [0, 1], [1, 0]),
      new NumberKeyframeTrack("RenderStateQuad.material.shadowSide", [0, 1], [-1, BackSide]),
      new NumberKeyframeTrack("RenderStateQuad.material.polygonOffset", [0, 1], [0, 1]),
      new NumberKeyframeTrack("RenderStateQuad.material.polygonOffsetFactor", [0, 1], [0, 2]),
      new NumberKeyframeTrack("RenderStateQuad.material.polygonOffsetUnits", [0, 1], [0, -1]),
      new NumberKeyframeTrack("RenderStateQuad.material.stencilWrite", [0, 1], [0, 1]),
      new NumberKeyframeTrack("RenderStateQuad.material.stencilWriteMask", [0, 1], [0xff, 0xaa]),
      new NumberKeyframeTrack("RenderStateQuad.material.stencilFunc", [0, 1], [519, LessEqualStencilFunc]),
      new NumberKeyframeTrack("RenderStateQuad.material.stencilRef", [0, 1], [0, 3]),
      new NumberKeyframeTrack("RenderStateQuad.material.stencilFuncMask", [0, 1], [0xff, 0x0f]),
      new NumberKeyframeTrack("RenderStateQuad.material.stencilFail", [0, 1], [7680, ReplaceStencilOp]),
      new NumberKeyframeTrack("RenderStateQuad.material.stencilZFail", [0, 1], [7680, IncrementStencilOp]),
      new NumberKeyframeTrack("RenderStateQuad.material.stencilZPass", [0, 1], [7680, DecrementStencilOp]),
      new NumberKeyframeTrack("RenderStateQuad.material.clipIntersection", [0, 1], [0, 1]),
      new NumberKeyframeTrack("RenderStateQuad.material.clipShadows", [0, 1], [0, 1]),
      new NumberKeyframeTrack("RenderStateQuad.material.clippingPlanes[0].constant", [0, 1], [-0.5, 0.25]),
      new VectorKeyframeTrack("RenderStateQuad.material.clippingPlanes[0].normal", [0, 1], [
        0, 1, 0,
        1, 0, 0
      ]),
      new NumberKeyframeTrack("RenderStateQuad.material.alphaHash", [0, 1], [0, 1]),
      new NumberKeyframeTrack("RenderStateQuad.material.alphaToCoverage", [0, 1], [0, 1]),
      new NumberKeyframeTrack("RenderStateQuad.material.premultipliedAlpha", [0, 1], [0, 1]),
      new NumberKeyframeTrack("RenderStateQuad.material.forceSinglePass", [0, 1], [0, 1]),
      new NumberKeyframeTrack("RenderStateQuad.material.toneMapped", [0, 1], [1, 0]),
      new NumberKeyframeTrack("RenderStateQuad.material.dithering", [0, 1], [0, 1]),
      new NumberKeyframeTrack("RenderStateQuad.material.wireframe", [0, 1], [0, 1]),
      new NumberKeyframeTrack("RenderStateQuad.material.wireframeLinewidth", [0, 1], [1, 3])
    ])
  ];
  return root;
}

function threeMaterialOpacityAnimationScene() {
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

  const material = new MeshBasicMaterial({
    name: "FadeMat",
    color: 0x3399ff,
    opacity: 1,
    transparent: true
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "FadeQuad";

  const root = new Object3D();
  root.name = "ThreeMaterialOpacityAnimationScene";
  root.add(mesh);
  root.animations = [
    new AnimationClip("Fade", 1, [
      new NumberKeyframeTrack("FadeQuad.material.opacity", [0, 1], [1, 0.25])
    ])
  ];
  return root;
}

function rounded(values) {
  return values.map((value) => Number(value.toFixed(4)));
}

function srgbRounded(values) {
  return rounded(values.map((value) => linearColorComponentToFbx(value)));
}

test("normalizes material diffuse color animation targets", () => {
  const scene = normalizeFbxScene(materialAnimationScene());
  const track = scene.animations[0].tracks[0];

  assert.equal(track.target, "AnimatedMat");
  assert.equal(track.property, "diffuseColor");
  assert.deepEqual(track.keyframes.map((keyframe) => keyframe.value), [
    [1, 0, 0],
    [0, 0, 1]
  ]);
});

test("adapts Three.js material color tracks into material diffuse color animation", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeMaterialAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const track = scene.animations[0].tracks[0];

  assert.equal(track.target, "AnimatedMat");
  assert.equal(track.property, "diffuseColor");
  assert.deepEqual(track.keyframes.map((keyframe) => keyframe.value), [
    [1, 0, 0],
    [0, 0, 1]
  ]);
});

test("collects Three.js clips attached directly to materials", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeMaterialOwnedAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations.map((clip) => clip.name), ["MaterialLocal"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["AnimatedMat", "diffuseColor"],
    ["AnimatedMat", "opacity"]
  ]);
  assert.deepEqual(rounded(scene.animations[0].tracks[0].keyframes[1].value), srgbRounded([0, 1, 0]));
  assert.deepEqual(rounded(scene.animations[0].tracks[1].keyframes.map((keyframe) => keyframe.value)), [1, 0.4]);
});

test("collects Three.js clips attached to material userData", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeMaterialUserDataOwnedAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations.map((clip) => clip.name), ["MaterialUserDataLocal"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["AnimatedMat", "diffuseColor"],
    ["AnimatedMat", "opacity"]
  ]);
  assert.deepEqual(rounded(scene.animations[0].tracks[0].keyframes[1].value), srgbRounded([0, 0.5, 1]));
  assert.deepEqual(rounded(scene.animations[0].tracks[1].keyframes.map((keyframe) => keyframe.value)), [1, 0.35]);
});

test("normalizes material opacity animation targets", () => {
  const scene = normalizeFbxScene(materialOpacityAnimationScene());
  const track = scene.animations[0].tracks[0];

  assert.equal(track.target, "FadeMat");
  assert.equal(track.property, "opacity");
  assert.deepEqual(track.keyframes.map((keyframe) => keyframe.value), [1, 0.25]);
});

test("normalizes material color channel animation targets", () => {
  const scene = normalizeFbxScene(materialColorChannelAnimationScene());

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "emissiveColor",
    "ambientColor",
    "specularColor",
    "transparentColor"
  ]);
  assert.deepEqual(scene.animations[0].tracks[0].keyframes[1].value, [0.4, 0.5, 1]);
  assert.deepEqual(scene.animations[0].tracks[1].keyframes[1].value, [0.2, 0.3, 0.4]);
  assert.deepEqual(scene.animations[0].tracks[2].keyframes[1].value, [1, 0.8, 0.3]);
  assert.deepEqual(scene.animations[0].tracks[3].keyframes[1].value, [0.1, 0.2, 0.3]);
});

test("normalizes material color component animation targets", () => {
  const scene = normalizeFbxScene(materialColorComponentAnimationScene());

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "diffuseColorR",
    "emissiveColorB",
    "specularColorG"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.keyframes[1].value), [
    1,
    0.8,
    0.6
  ]);
});

test("normalizes material scalar animation targets", () => {
  const scene = normalizeFbxScene(materialScalarAnimationScene());

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "diffuseFactor",
    "transparencyFactor",
    "emissiveFactor",
    "ambientFactor",
    "specularFactor",
    "shininess",
    "bumpFactor",
    "displacementFactor",
    "vectorDisplacementFactor",
    "reflectionFactor"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.keyframes[1].value), [
    0.3,
    0.75,
    0.9,
    0.7,
    0.8,
    90,
    0.25,
    1.2,
    1.4,
    0.6
  ]);
});

test("adapts Three.js material opacity tracks into material opacity animation", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeMaterialOpacityAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const track = scene.animations[0].tracks[0];

  assert.equal(track.target, "FadeMat");
  assert.equal(track.property, "opacity");
  assert.deepEqual(track.keyframes.map((keyframe) => keyframe.value), [1, 0.25]);
});

test("adapts Three.js material emissive and specular tracks into material color animation", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeMaterialColorChannelAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "emissiveColor",
    "specularColor",
    "transparentColor"
  ]);
  assert.deepEqual(rounded(scene.animations[0].tracks[0].keyframes[1].value), srgbRounded([0.4, 0.5, 1]));
  assert.deepEqual(rounded(scene.animations[0].tracks[1].keyframes[1].value), srgbRounded([1, 0.8, 0.3]));
  assert.deepEqual(rounded(scene.animations[0].tracks[2].keyframes[1].value), srgbRounded([0.1, 0.2, 0.3]));
});

test("adapts Three.js material color component tracks", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeMaterialColorComponentAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "diffuseColorR",
    "emissiveColorB",
    "specularColorG"
  ]);
  assert.deepEqual(rounded(scene.animations[0].tracks.map((track) => track.keyframes[1].value)), [
    ...srgbRounded([1, 0.8, 0.6])
  ]);
});

test("adapts Three.js material scalar tracks into material scalar animation", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeMaterialScalarAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "emissiveFactor",
    "transparencyFactor",
    "transparencyFactor",
    "ambientFactor",
    "specularFactor",
    "specularFactor",
    "shininess",
    "shininess",
    "shininess",
    "shininess",
    "bumpFactor",
    "bumpFactor",
    "bumpFactor",
    "bumpFactor",
    "displacementFactor",
    "vectorDisplacementFactor",
    "reflectionFactor",
    "reflectionFactor",
    "reflectionFactor",
    "reflectionFactor"
  ]);
  assert.deepEqual(rounded(scene.animations[0].tracks.map((track) => track.keyframes[1].value)), [
    0.9,
    0.75,
    0.5,
    0.7,
    0.85,
    0.65,
    90,
    roughnessToFbxShininess(0.2),
    roughnessToFbxShininess(0.25),
    Number(roughnessToFbxShininess(0.18).toFixed(4)),
    0.25,
    0.2,
    0.35,
    0.32,
    1.2,
    1.4,
    0.6,
    0.45,
    0.55,
    0.8
  ]);
});

test("adapts Three.js physical extension material tracks", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeMaterialPhysicalExtensionAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "anisotropy",
    "anisotropyRotation",
    "iridescence",
    "iridescenceIOR",
    "iridescenceThicknessMinimum",
    "iridescenceThicknessMaximum",
    "thickness",
    "attenuationColor",
    "attenuationDistance",
    "ior",
    "dispersion"
  ]);
  assert.deepEqual(rounded(scene.animations[0].tracks.map((track) => track.keyframes[1].value).flat()), [
    0.7,
    0.6,
    0.8,
    1.5,
    160,
    420,
    0.9,
    ...srgbRounded([0.4, 0.5, 0.6]),
    9,
    1.7,
    0.05
  ]);
});

test("adapts Three.js texture control material tracks", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeMaterialTextureControlAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "aoMapIntensity",
    "displacementBias",
    "alphaTest",
    "normalMapType"
  ]);
  assert.deepEqual(rounded(scene.animations[0].tracks.map((track) => track.keyframes[1].value)), [
    0.8,
    -0.35,
    0.55,
    1
  ]);
});

test("adapts Three.js material render-state tracks", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeMaterialRenderStateAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "side",
    "blending",
    "blendSrc",
    "blendDst",
    "blendEquation",
    "blendSrcAlpha",
    "blendDstAlpha",
    "blendEquationAlpha",
    "blendAlpha",
    "blendColor",
    "depthFunc",
    "depthTest",
    "depthWrite",
    "colorWrite",
    "vertexColors",
    "fog",
    "materialVisible",
    "allowOverride",
    "shadowSide",
    "polygonOffset",
    "polygonOffsetFactor",
    "polygonOffsetUnits",
    "stencilWrite",
    "stencilWriteMask",
    "stencilFunc",
    "stencilRef",
    "stencilFuncMask",
    "stencilFail",
    "stencilZFail",
    "stencilZPass",
    "clipIntersection",
    "clipShadows",
    "clippingPlane0Constant",
    "clippingPlane0Normal",
    "alphaHash",
    "alphaToCoverage",
    "premultipliedAlpha",
    "forceSinglePass",
    "toneMapped",
    "dithering",
    "wireframe",
    "wireframeLinewidth"
  ]);
  assert.deepEqual(rounded(scene.animations[0].tracks.map((track) => track.keyframes[1].value).flat()), [
    BackSide,
    AdditiveBlending,
    OneFactor,
    ConstantColorFactor,
    SubtractEquation,
    SrcAlphaFactor,
    OneMinusDstColorFactor,
    ReverseSubtractEquation,
    0.75,
    ...srgbRounded([0.6, 0.4, 0.2]),
    3,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    BackSide,
    1,
    2,
    -1,
    1,
    0xaa,
    LessEqualStencilFunc,
    3,
    0x0f,
    ReplaceStencilOp,
    IncrementStencilOp,
    DecrementStencilOp,
    1,
    1,
    0.25,
    1,
    0,
    0,
    1,
    1,
    1,
    1,
    0,
    1,
    1,
    3
  ]);
});

test("writes material render-state animation curves", () => {
  const text = decode(exportFbx(fromThreeObject(threeMaterialRenderStateAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  })));

  assert.match(text, /RenderStateMat/);
  assert.match(text, /Maya\|side/);
  assert.match(text, /Maya\|blending/);
  assert.match(text, /Maya\|blend_src/);
  assert.match(text, /Maya\|blend_dst/);
  assert.match(text, /Maya\|blend_equation/);
  assert.match(text, /Maya\|blend_src_alpha/);
  assert.match(text, /Maya\|blend_dst_alpha/);
  assert.match(text, /Maya\|blend_equation_alpha/);
  assert.match(text, /Maya\|blend_alpha/);
  assert.match(text, /Maya\|blend_color/);
  assert.match(text, /Maya\|depth_func/);
  assert.match(text, /Maya\|depth_test/);
  assert.match(text, /Maya\|depth_write/);
  assert.match(text, /Maya\|color_write/);
  assert.match(text, /Maya\|vertex_colors/);
  assert.match(text, /Maya\|fog/);
  assert.match(text, /Maya\|material_visible/);
  assert.match(text, /Maya\|allow_override/);
  assert.match(text, /Maya\|shadow_side/);
  assert.match(text, /Maya\|polygon_offset/);
  assert.match(text, /Maya\|polygon_offset_factor/);
  assert.match(text, /Maya\|polygon_offset_units/);
  assert.match(text, /Maya\|stencil_write/);
  assert.match(text, /Maya\|stencil_write_mask/);
  assert.match(text, /Maya\|stencil_func/);
  assert.match(text, /Maya\|stencil_ref/);
  assert.match(text, /Maya\|stencil_func_mask/);
  assert.match(text, /Maya\|stencil_fail/);
  assert.match(text, /Maya\|stencil_z_fail/);
  assert.match(text, /Maya\|stencil_z_pass/);
  assert.match(text, /Maya\|clip_intersection/);
  assert.match(text, /Maya\|clip_shadows/);
  assert.match(text, /Maya\|clipping_plane_0_normal/);
  assert.match(text, /Maya\|clipping_plane_0_constant/);
  assert.match(text, /Maya\|alpha_hash/);
  assert.match(text, /Maya\|alpha_to_coverage/);
  assert.match(text, /Maya\|premultiplied_alpha/);
  assert.match(text, /Maya\|force_single_pass/);
  assert.match(text, /Maya\|tone_mapped/);
  assert.match(text, /Maya\|dithering/);
  assert.match(text, /Maya\|wireframe/);
  assert.match(text, /Maya\|wireframe_linewidth/);
  assert.match(text, /AnimationCurveNode/);
  assert.match(text, /AnimationCurve/);
});

test("writes material diffuse color animation curves", () => {
  const text = decode(exportFbx(materialAnimationScene()));

  assert.match(text, /AnimatedMat/);
  assert.match(text, /DiffuseColor/);
  assert.match(text, /AnimationCurveNode/);
  assert.match(text, /AnimationCurve/);
});

test("writes material color channel animation curves", () => {
  const text = decode(exportFbx(materialColorChannelAnimationScene()));

  assert.match(text, /ColorMat/);
  assert.match(text, /EmissiveColor/);
  assert.match(text, /AmbientColor/);
  assert.match(text, /SpecularColor/);
  assert.match(text, /TransparentColor/);
  assert.match(text, /AnimationCurveNode/);
  assert.match(text, /AnimationCurve/);
});

test("writes material color component animation curves", () => {
  const text = decode(exportFbx(materialColorComponentAnimationScene()));

  assert.match(text, /ColorComponentMat/);
  assert.match(text, /DiffuseColor/);
  assert.match(text, /EmissiveColor/);
  assert.match(text, /SpecularColor/);
  assert.match(text, /AnimationCurveNode/);
  assert.match(text, /AnimationCurve/);
});

test("writes material scalar animation curves", () => {
  const text = decode(exportFbx(materialScalarAnimationScene()));

  assert.match(text, /ScalarMat/);
  assert.match(text, /DiffuseFactor/);
  assert.match(text, /TransparencyFactor/);
  assert.match(text, /EmissiveFactor/);
  assert.match(text, /AmbientFactor/);
  assert.match(text, /SpecularFactor/);
  assert.match(text, /Shininess/);
  assert.match(text, /BumpFactor/);
  assert.match(text, /DisplacementFactor/);
  assert.match(text, /VectorDisplacementFactor/);
  assert.match(text, /ReflectionFactor/);
  assert.match(text, /AnimationCurveNode/);
  assert.match(text, /AnimationCurve/);
});

test("writes material opacity animation curves", () => {
  const text = decode(exportFbx(materialOpacityAnimationScene()));

  assert.match(text, /FadeMat/);
  assert.match(text, /Opacity/);
  assert.match(text, /AnimationCurveNode/);
  assert.match(text, /AnimationCurve/);
});

test("Blender imports material diffuse color animation", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "material-animation.fbx");
  await writeFile(fbxPath, exportFbx(materialAnimationScene()));

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
actions = []
for action in bpy.data.actions:
    actions.append({
        "name": action.name,
        "curves": sorted((fc.data_path, fc.array_index, [round(kp.co.y, 4) for kp in fc.keyframe_points]) for fc in action.fcurves),
    })
print("FBX_VALIDATE:" + json.dumps({
    "materials": sorted(mat.name for mat in bpy.data.materials),
    "actions": sorted(actions, key=lambda action: action["name"]),
}))
`;
  const result = spawnSync(blenderPath, blenderTestArgs(script, fbxPath), {
    encoding: "utf8"
  });

  await rm(tempDir, { recursive: true, force: true });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const match = result.stdout.match(/FBX_VALIDATE:(.+)/);
  assert.ok(match, result.stdout);
  const info = JSON.parse(match[1]);
  assert.deepEqual(info.materials, ["AnimatedMat"]);
  assert.deepEqual(info.actions, [
    {
      name: "AnimatedMat|Tint",
      curves: [
        ["diffuse_color", 0, [1, 0]],
        ["diffuse_color", 1, [0, 0]],
        ["diffuse_color", 2, [0, 1]]
      ]
    }
  ]);
});
