import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  BufferGeometry,
  AlwaysDepth,
  BackSide,
  ConstantColorFactor,
  CustomBlending,
  DecrementStencilOp,
  DoubleSide,
  Float32BufferAttribute,
  IncrementStencilOp,
  LessEqualStencilFunc,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshMatcapMaterial,
  MeshPhysicalMaterial,
  MeshPhongMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  ObjectSpaceNormalMap,
  OneFactor,
  OneMinusDstColorFactor,
  Plane,
  ReverseSubtractEquation,
  ReplaceStencilOp,
  Scene,
  SrcAlphaFactor,
  SubtractEquation,
  Texture,
  Vector3
} from "three";
import { createMaterialScene, exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { roughnessToFbxShininess } from "../src/material/material-normalizer.js";
import { linearColorComponentToFbx } from "../src/three/three-color-adapter.js";
import { arrayBufferFrom, blenderPath, blenderTestArgs, decode, hasBlender, withMockDocument } from "./fbx-test-helpers.js";

function assertClose(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} not close to ${expected}`);
}

function materialScene() {
  return createMaterialScene({ name: "MaterialScene" });
}

function threeMaterialScene() {
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
    name: "ThreeRichMaterial",
    color: 0xff0000,
    emissive: 0x0000ff,
    emissiveIntensity: 0.6,
    specular: 0x00ff00,
    shininess: 77,
    opacity: 0.42,
    transparent: true
  });

  const mesh = new Mesh(geometry, material);
  mesh.name = "MaterialQuad";
  const scene = new Scene();
  scene.name = "ThreeMaterialScene";
  scene.add(mesh);
  return scene;
}

function scalarTextureScene() {
  return {
    name: "ScalarTextureScene",
    meshes: [
      {
        name: "MaterialQuad",
        materials: [
          {
            name: "ScalarMaterial",
            diffuseColor: [0.5, 0.5, 0.5],
            bumpFactor: 0.25,
            displacementFactor: 0.75,
            vectorDisplacementFactor: 0.65,
            reflectionFactor: 0.5,
            diffuseFactorTexture: "diffuse-factor.tga",
            bumpTexture: "bump.tga",
            emissiveFactorTexture: "emissive-factor.tga",
            ambientTexture: "ambient.tga",
            ambientFactorTexture: "ambient-factor.tga",
            specularFactorTexture: "specular-factor.tga",
            transparentTexture: "transparent.tga",
            displacementTexture: "height.tga",
            vectorDisplacementTexture: "vector-height.tga",
            reflectionTexture: "env.tga"
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

function threeScalarTextureScene() {
  const scene = threeMaterialScene();
  scene.name = "ThreeScalarTextureScene";
  const material = scene.getObjectByName("MaterialQuad").material;
  material.name = "ThreeScalarMaterial";
  material.diffuseFactorMap = new Texture({ src: "diffuse-factor.tga" });
  material.diffuseFactorMap.name = "diffuse-factor";
  material.bumpMap = new Texture({ src: "bump.tga" });
  material.bumpMap.name = "bump";
  material.emissiveFactorMap = new Texture({ src: "emissive-factor.tga" });
  material.emissiveFactorMap.name = "emissive-factor";
  material.ambientMap = new Texture({ src: "ambient.tga" });
  material.ambientMap.name = "ambient";
  material.ambientFactorMap = new Texture({ src: "ambient-factor.tga" });
  material.ambientFactorMap.name = "ambient-factor";
  material.specularFactorMap = new Texture({ src: "specular-factor.tga" });
  material.specularFactorMap.name = "specular-factor";
  material.transparentMap = new Texture({ src: "transparent.tga" });
  material.transparentMap.name = "transparent";
  material.displacementMap = new Texture({ src: "height.tga" });
  material.displacementMap.name = "height";
  material.vectorDisplacementMap = new Texture({ src: "vector-height.tga" });
  material.vectorDisplacementMap.name = "vector-height";
  material.envMap = new Texture({ src: "env.tga" });
  material.envMap.name = "env";
  material.bumpScale = 0.35;
  material.displacementScale = 0.85;
  material.vectorDisplacementScale = 0.55;
  material.reflectivity = 0.45;
  return scene;
}

function threeLightMapMaterialScene() {
  const scene = threeMaterialScene();
  scene.name = "ThreeLightMapMaterialScene";
  const material = scene.getObjectByName("MaterialQuad").material;
  material.name = "ThreeLightMappedMaterial";
  material.lightMap = new Texture({ src: "lightmap.tga" });
  material.lightMap.name = "baked_light";
  material.lightMapIntensity = 0.35;
  return scene;
}

function threeEnvMapIntensityMaterialScene() {
  const scene = threeMaterialScene();
  scene.name = "ThreeEnvMapIntensityMaterialScene";
  const mesh = scene.getObjectByName("MaterialQuad");
  const material = new MeshStandardMaterial({
    name: "ThreeEnvMappedMaterial",
    color: 0x6699cc
  });
  material.envMap = new Texture({ src: "studio-env.tga" });
  material.envMap.name = "studio_env";
  material.envMapIntensity = 0.37;
  material.envMapRotation.set(0.1, 0.2, 0.3);
  mesh.material = material;
  return scene;
}

function threePbrMaterialScene() {
  const scene = threeMaterialScene();
  scene.name = "ThreePbrMaterialScene";
  const mesh = scene.getObjectByName("MaterialQuad");
  const material = new MeshStandardMaterial({
    name: "ThreePbrMaterial",
    color: 0x6699cc,
    roughness: 0.25,
    metalness: 0.7
  });
  material.roughnessMap = new Texture({ src: "roughness.tga" });
  material.roughnessMap.name = "roughness";
  material.metalnessMap = new Texture({ src: "metalness.tga" });
  material.metalnessMap.name = "metalness";
  mesh.material = material;
  return scene;
}

function threeUserDataTextureAliasMaterialScene() {
  const scene = threeMaterialScene();
  scene.name = "ThreeUserDataTextureAliasMaterialScene";
  const mesh = scene.getObjectByName("MaterialQuad");
  const material = new MeshStandardMaterial({
    name: "ThreeUserDataTextureAliasMaterial",
    color: 0x6699cc
  });
  material.userData.roughnessTexture = new Texture({ src: "roughness-alias.tga" });
  material.userData.roughnessTexture.name = "roughness_alias";
  material.userData.metalnessMap = new Texture({ src: "metalness-alias.tga" });
  material.userData.metalnessMap.name = "metalness_alias";
  material.userData.alphaTexture = new Texture({ src: "alpha-alias.tga" });
  material.userData.alphaTexture.name = "alpha_alias";
  mesh.material = material;
  return scene;
}

function threePhysicalSpecularMaterialScene() {
  const scene = threeMaterialScene();
  scene.name = "ThreePhysicalSpecularMaterialScene";
  const mesh = scene.getObjectByName("MaterialQuad");
  const material = new MeshPhysicalMaterial({
    name: "ThreePhysicalSpecularMaterial",
    color: 0x6699cc,
    specularColor: 0x224466,
    specularIntensity: 0.65
  });
  material.specularColorMap = new Texture({ src: "specular-color.tga" });
  material.specularColorMap.name = "specular-color";
  material.specularIntensityMap = new Texture({ src: "specular-intensity.tga" });
  material.specularIntensityMap.name = "specular-intensity";
  mesh.material = material;
  return scene;
}

function threePhysicalClearcoatMaterialScene() {
  const scene = threeMaterialScene();
  scene.name = "ThreePhysicalClearcoatMaterialScene";
  const mesh = scene.getObjectByName("MaterialQuad");
  const material = new MeshPhysicalMaterial({
    name: "ThreePhysicalClearcoatMaterial",
    color: 0x6699cc,
    clearcoat: 0.62
  });
  material.clearcoatMap = new Texture({ src: "clearcoat.tga" });
  material.clearcoatMap.name = "clearcoat";
  mesh.material = material;
  return scene;
}

function threePhysicalClearcoatDetailMaterialScene() {
  const scene = threeMaterialScene();
  scene.name = "ThreePhysicalClearcoatDetailMaterialScene";
  const mesh = scene.getObjectByName("MaterialQuad");
  const material = new MeshPhysicalMaterial({
    name: "ThreePhysicalClearcoatDetailMaterial",
    color: 0x6699cc,
    clearcoat: 0.7,
    clearcoatRoughness: 0.28
  });
  material.clearcoatRoughnessMap = new Texture({ src: "clearcoat-roughness.tga" });
  material.clearcoatRoughnessMap.name = "clearcoat-roughness";
  material.clearcoatNormalMap = new Texture({ src: "clearcoat-normal.tga" });
  material.clearcoatNormalMap.name = "clearcoat-normal";
  material.clearcoatNormalScale.set(0.38, 0.5);
  mesh.material = material;
  return scene;
}

function threePhysicalTransmissionMaterialScene() {
  const scene = threeMaterialScene();
  scene.name = "ThreePhysicalTransmissionMaterialScene";
  const mesh = scene.getObjectByName("MaterialQuad");
  const material = new MeshPhysicalMaterial({
    name: "ThreePhysicalTransmissionMaterial",
    color: 0x99ccee,
    transmission: 0.48
  });
  material.transmissionMap = new Texture({ src: "transmission.tga" });
  material.transmissionMap.name = "transmission";
  mesh.material = material;
  return scene;
}

function threePhysicalSheenMaterialScene() {
  const scene = threeMaterialScene();
  scene.name = "ThreePhysicalSheenMaterialScene";
  const mesh = scene.getObjectByName("MaterialQuad");
  const material = new MeshPhysicalMaterial({
    name: "ThreePhysicalSheenMaterial",
    color: 0x6699cc
  });
  material.sheen = 0.44;
  material.sheenColor.set(0x8844aa);
  material.sheenRoughness = 0.35;
  material.sheenColorMap = new Texture({ src: "sheen-color.tga" });
  material.sheenColorMap.name = "sheen-color";
  material.sheenRoughnessMap = new Texture({ src: "sheen-roughness.tga" });
  material.sheenRoughnessMap.name = "sheen-roughness";
  mesh.material = material;
  return scene;
}

function threePhysicalExtensionTextureScene() {
  const scene = threeMaterialScene();
  scene.name = "ThreePhysicalExtensionTextureScene";
  const mesh = scene.getObjectByName("MaterialQuad");
  const material = new MeshPhysicalMaterial({
    name: "ThreePhysicalExtensionMaterial",
    color: 0x6699cc
  });
  material.anisotropyMap = new Texture({ src: "anisotropy.tga" });
  material.anisotropyMap.name = "anisotropy";
  material.iridescenceMap = new Texture({ src: "iridescence.tga" });
  material.iridescenceMap.name = "iridescence";
  material.iridescenceThicknessMap = new Texture({ src: "iridescence-thickness.tga" });
  material.iridescenceThicknessMap.name = "iridescence-thickness";
  material.thicknessMap = new Texture({ src: "thickness.tga" });
  material.thicknessMap.name = "thickness";
  mesh.material = material;
  return scene;
}

function threePhysicalExtensionValueScene() {
  const scene = threeMaterialScene();
  scene.name = "ThreePhysicalExtensionValueScene";
  const mesh = scene.getObjectByName("MaterialQuad");
  const material = new MeshPhysicalMaterial({
    name: "ThreePhysicalExtensionValueMaterial",
    color: 0x6699cc
  });
  material.anisotropy = 0.72;
  material.anisotropyRotation = 0.35;
  material.iridescence = 0.42;
  material.iridescenceIOR = 1.44;
  material.iridescenceThicknessRange = [120, 340];
  material.thickness = 0.18;
  material.attenuationColor.set(0x224466);
  material.attenuationDistance = 7.5;
  material.ior = 1.62;
  material.dispersion = 0.04;
  mesh.material = material;
  return scene;
}

function threeTextureControlMaterialScene() {
  const scene = threeMaterialScene();
  scene.name = "ThreeTextureControlMaterialScene";
  const mesh = scene.getObjectByName("MaterialQuad");
  const material = new MeshStandardMaterial({
    name: "ThreeTextureControlMaterial",
    color: 0x6699cc,
    alphaTest: 0.42
  });
  material.aoMap = new Texture({ src: "ao.tga" });
  material.aoMap.name = "ao";
  material.aoMapIntensity = 0.64;
  material.normalMap = new Texture({ src: "object-normal.tga" });
  material.normalMap.name = "object-normal";
  material.normalMapType = ObjectSpaceNormalMap;
  material.displacementMap = new Texture({ src: "displacement.tga" });
  material.displacementMap.name = "displacement";
  material.displacementBias = -0.12;
  mesh.material = material;
  return scene;
}

function threeRenderStateMaterialScene() {
  const scene = threeMaterialScene();
  scene.name = "ThreeRenderStateMaterialScene";
  const mesh = scene.getObjectByName("MaterialQuad");
  const material = new MeshBasicMaterial({
    name: "ThreeRenderStateMaterial",
    color: 0x6699cc,
    side: DoubleSide,
    blending: CustomBlending,
    blendSrc: SrcAlphaFactor,
    blendDst: OneMinusDstColorFactor,
    blendEquation: ReverseSubtractEquation,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: ConstantColorFactor,
    blendEquationAlpha: SubtractEquation,
    blendAlpha: 0.33,
    depthFunc: AlwaysDepth,
    depthTest: false,
    depthWrite: false,
    colorWrite: false,
    vertexColors: true,
    fog: false,
    visible: false,
    allowOverride: false,
    shadowSide: BackSide,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: -1,
    stencilWrite: true,
    stencilWriteMask: 0xaa,
    stencilFunc: LessEqualStencilFunc,
    stencilRef: 3,
    stencilFuncMask: 0x0f,
    stencilFail: ReplaceStencilOp,
    stencilZFail: IncrementStencilOp,
    stencilZPass: DecrementStencilOp,
    clipIntersection: true,
    clipShadows: true,
    alphaHash: true,
    alphaToCoverage: true,
    premultipliedAlpha: true,
    forceSinglePass: true,
    toneMapped: false,
    wireframe: true,
    wireframeLinewidth: 2
  });
  material.blendColor.setRGB(0.1, 0.2, 0.3);
  material.clippingPlanes = [new Plane(new Vector3(0, 1, 0), -0.5)];
  material.dithering = true;
  mesh.material = material;
  return scene;
}

function lambertMaterialScene() {
  const scene = materialScene();
  scene.name = "LambertMaterialScene";
  scene.meshes[0].materials[0].name = "MatteMaterial";
  scene.meshes[0].materials[0].shadingModel = "Lambert";
  return scene;
}

function threeLambertMaterialScene() {
  const scene = threeMaterialScene();
  scene.name = "ThreeLambertMaterialScene";
  scene.getObjectByName("MaterialQuad").material = new MeshLambertMaterial({
    name: "ThreeMatteMaterial",
    color: 0xff0000,
    emissive: 0x000011
  });
  return scene;
}

function threeBasicMaterialScene() {
  const scene = threeMaterialScene();
  scene.name = "ThreeBasicMaterialScene";
  scene.getObjectByName("MaterialQuad").material = new MeshBasicMaterial({
    name: "ThreeUnlitMaterial",
    color: 0x3366ff
  });
  return scene;
}

function threeMatcapMaterialScene() {
  const scene = threeMaterialScene();
  scene.name = "ThreeMatcapMaterialScene";
  const matcap = new Texture({ src: "matcap.tga" });
  matcap.name = "studio_matcap";
  scene.getObjectByName("MaterialQuad").material = new MeshMatcapMaterial({
    name: "ThreeMatcapMaterial",
    color: 0xffffff,
    matcap
  });
  return scene;
}

function threeToonGradientMaterialScene() {
  const scene = threeMaterialScene();
  scene.name = "ThreeToonGradientMaterialScene";
  const gradientMap = new Texture({ src: "toon-gradient.tga" });
  gradientMap.name = "toon_gradient";
  scene.getObjectByName("MaterialQuad").material = new MeshToonMaterial({
    name: "ThreeToonMaterial",
    color: 0x55aaee,
    gradientMap
  });
  return scene;
}

function threeMidToneMaterialScene() {
  const scene = threeMaterialScene();
  scene.name = "ThreeMidToneMaterialScene";
  scene.getObjectByName("MaterialQuad").material = new MeshPhongMaterial({
    name: "ThreeMidToneMaterial",
    color: 0x6699cc,
    emissive: 0x223344,
    specular: 0x8899aa
  });
  return scene;
}

function srgb(values) {
  return values.map((value) => linearColorComponentToFbx(value));
}

test("exports richer Phong material properties", () => {
  const scene = normalizeFbxScene(materialScene());
  const material = scene.meshes[0].materials[0];

  assert.deepEqual(material.emissiveColor, [0, 0, 1]);
  assert.deepEqual(material.ambientColor, [0.1, 0.2, 0.3]);
  assert.deepEqual(material.transparentColor, [0.05, 0.1, 0.15]);
  assert.equal(material.transparencyFactor, 0.58);
  assert.equal(material.emissiveFactor, 0.6);
  assert.equal(material.shininess, 77);

  const text = decode(exportFbx(scene));
  assert.match(text, /EmissiveColor/);
  assert.match(text, /EmissiveFactor/);
  assert.match(text, /AmbientColor/);
  assert.match(text, /TransparentColor/);
  assert.match(text, /TransparencyFactor/);
  assert.match(text, /SpecularFactor/);
  assert.match(text, /Shininess/);
});

test("exports Lambert material shading model", async () => {
  const scene = normalizeFbxScene(lambertMaterialScene());
  const material = scene.meshes[0].materials[0];

  assert.equal(material.shadingModel, "Lambert");

  const text = decode(exportFbx(scene));
  assert.match(text, /Lambert/);

  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(scene)), "");
  const exportedMaterial = group.getObjectByName("MaterialQuad").material;
  assert.equal(exportedMaterial.isMeshLambertMaterial, true);
});

test("exports material scalar factors and reflection textures", async () => {
  const scene = normalizeFbxScene(scalarTextureScene());
  const material = scene.meshes[0].materials[0];

  assert.equal(material.bumpFactor, 0.25);
  assert.equal(material.displacementFactor, 0.75);
  assert.equal(material.vectorDisplacementFactor, 0.65);
  assert.equal(material.reflectionFactor, 0.5);
  assert.deepEqual(material.textures.map((texture) => texture.property), [
    "DiffuseFactor",
    "Bump",
    "EmissiveFactor",
    "AmbientColor",
    "AmbientFactor",
    "SpecularFactor",
    "TransparentColor",
    "DisplacementColor",
    "VectorDisplacementColor",
    "ReflectionColor"
  ]);

  const text = decode(exportFbx(scene));
  assert.match(text, /DiffuseFactor/);
  assert.match(text, /BumpFactor/);
  assert.match(text, /EmissiveFactor/);
  assert.match(text, /AmbientColor/);
  assert.match(text, /AmbientFactor/);
  assert.match(text, /SpecularFactor/);
  assert.match(text, /TransparentColor/);
  assert.match(text, /DisplacementFactor/);
  assert.match(text, /VectorDisplacementColor/);
  assert.match(text, /VectorDisplacementFactor/);
  assert.match(text, /ReflectionFactor/);
  assert.match(text, /ReflectionColor/);

  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(scalarTextureScene())), "");
    const exportedMaterial = group.getObjectByName("MaterialQuad").material;

    assertClose(exportedMaterial.bumpScale, 0.25);
    assertClose(exportedMaterial.displacementScale, 0.75);
    assertClose(exportedMaterial.reflectivity, 0.5);
    assert.ok(exportedMaterial.bumpMap);
    assert.ok(exportedMaterial.alphaMap);
    assert.ok(exportedMaterial.displacementMap);
    assert.ok(exportedMaterial.envMap);
  });
});

test("Three.js FBXLoader parses material color, opacity, emissive, specular, and shininess", async () => {
  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(materialScene())), "");
  const material = group.getObjectByName("MaterialQuad").material;

  assert.equal(material.name, "RichMaterial");
  assert.equal(material.color.r, 1);
  assert.equal(material.color.g, 0);
  assert.equal(material.color.b, 0);
  assert.equal(material.emissive.b, 1);
  assert.equal(material.specular.g, 1);
  assert.equal(material.transparent, true);
  assertClose(material.opacity, 0.42);
  assert.equal(material.emissiveIntensity, 0.6);
  assert.equal(material.shininess, 77);
});

test("adapts Three.js MeshPhongMaterial material fields", async () => {
  const scene = fromThreeObject(threeMaterialScene());
  const material = scene.meshes[0].materials[0];

  assert.deepEqual(material.diffuseColor, [1, 0, 0]);
  assert.deepEqual(material.emissiveColor, [0, 0, 1]);
  assert.deepEqual(material.specularColor, [0, 1, 0]);
  assert.deepEqual(material.transparentColor, [0, 0, 0]);
  assertClose(material.transparencyFactor, 0.58);
  assert.equal(material.emissiveFactor, 0.6);
  assert.equal(material.shininess, 77);
  assert.equal(material.opacity, 0.42);

  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(threeMaterialScene())), "");
  const exportedMaterial = group.getObjectByName("MaterialQuad").material;
  assert.equal(exportedMaterial.emissive.b, 1);
  assert.equal(exportedMaterial.shininess, 77);
  assertClose(exportedMaterial.opacity, 0.42);
});

test("adapts Three.js working-space material colors into FBX color values", async () => {
  const source = threeMidToneMaterialScene();
  const sourceMaterial = source.getObjectByName("MaterialQuad").material;
  const scene = fromThreeObject(source);
  const material = scene.meshes[0].materials[0];

  assertVectorClose(material.diffuseColor, srgb(sourceMaterial.color.toArray()), 1e-5);
  assertVectorClose(material.emissiveColor, srgb(sourceMaterial.emissive.toArray()), 1e-5);
  assertVectorClose(material.specularColor, srgb(sourceMaterial.specular.toArray()), 1e-5);

  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(source)), "");
  const exportedMaterial = group.getObjectByName("MaterialQuad").material;
  assertClose(exportedMaterial.color.r, sourceMaterial.color.r, 1e-4);
  assertClose(exportedMaterial.color.g, sourceMaterial.color.g, 1e-4);
  assertClose(exportedMaterial.color.b, sourceMaterial.color.b, 1e-4);
});

function assertVectorClose(actual, expected, epsilon = 1e-6) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assertClose(value, expected[index], epsilon));
}

test("adapts Three.js MeshLambertMaterial shading model", async () => {
  const scene = fromThreeObject(threeLambertMaterialScene());
  const material = scene.meshes[0].materials[0];

  assert.equal(material.shadingModel, "Lambert");
  assert.deepEqual(material.diffuseColor, [1, 0, 0]);

  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(threeLambertMaterialScene())), "");
  assert.equal(group.getObjectByName("MaterialQuad").material.isMeshLambertMaterial, true);
});

test("adapts Three.js MeshBasicMaterial to the closest FBX shading model", async () => {
  const scene = fromThreeObject(threeBasicMaterialScene());
  const material = scene.meshes[0].materials[0];

  assert.equal(material.shadingModel, "Lambert");

  const text = decode(exportFbx(threeBasicMaterialScene()));
  assert.match(text, /Lambert/);
  assert.doesNotMatch(text, /Shininess/);
  assert.doesNotMatch(text, /SpecularColor/);

  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(threeBasicMaterialScene())), "");
  assert.equal(group.getObjectByName("MaterialQuad").material.isMeshLambertMaterial, true);
});

test("adapts Three.js MeshMatcapMaterial texture as FBX diffuse texture", async () => {
  const scene = fromThreeObject(threeMatcapMaterialScene());
  const material = scene.meshes[0].materials[0];
  const normalizedMaterial = normalizeFbxScene(scene).meshes[0].materials[0];

  assert.equal(material.shadingModel, "Lambert");
  assert.equal(material.diffuseTexture.name, "studio_matcap");
  assert.deepEqual(normalizedMaterial.textures.map((texture) => [texture.name, texture.property]), [
    ["studio_matcap", "DiffuseColor"]
  ]);

  const text = decode(exportFbx(threeMatcapMaterialScene()));
  assert.match(text, /Lambert/);
  assert.match(text, /DiffuseColor/);
  assert.match(text, /matcap\.tga/);

  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(threeMatcapMaterialScene())), "");
    const exportedMaterial = group.getObjectByName("MaterialQuad").material;
    assert.equal(exportedMaterial.isMeshLambertMaterial, true);
    assert.ok(exportedMaterial.map);
    assert.equal(exportedMaterial.map.name, "studio_matcap");
  });
});

test("preserves Three.js MeshToonMaterial gradient map as a custom texture lane", () => {
  const scene = fromThreeObject(threeToonGradientMaterialScene());
  const material = scene.meshes[0].materials[0];
  const normalizedMaterial = normalizeFbxScene(scene).meshes[0].materials[0];

  assert.equal(material.shadingModel, "Lambert");
  assert.equal(material.gradientTexture.name, "toon_gradient");
  assert.deepEqual(normalizedMaterial.textures.map((texture) => [texture.name, texture.property]), [
    ["toon_gradient", "Maya|TEX_gradient_map"]
  ]);

  const text = decode(exportFbx(scene));
  assert.match(text, /Lambert/);
  assert.match(text, /Maya\|TEX_gradient_map/);
  assert.match(text, /toon-gradient\.tga/);
});

test("adapts Three.js material scalar factors and reflection texture", async () => {
  const scene = fromThreeObject(threeScalarTextureScene());
  const material = scene.meshes[0].materials[0];
  const normalizedMaterial = normalizeFbxScene(scene).meshes[0].materials[0];

  assert.equal(material.bumpFactor, 0.35);
  assert.equal(material.displacementFactor, 0.85);
  assert.equal(material.vectorDisplacementFactor, 0.55);
  assert.equal(material.reflectionFactor, 0.45);
  assert.deepEqual(normalizedMaterial.textures.map((texture) => texture.property).filter((property) => [
    "DiffuseFactor",
    "Bump",
    "EmissiveFactor",
    "AmbientColor",
    "AmbientFactor",
    "SpecularFactor",
    "TransparentColor",
    "DisplacementColor",
    "VectorDisplacementColor",
    "ReflectionColor"
  ].includes(property)), [
    "DiffuseFactor",
    "Bump",
    "EmissiveFactor",
    "AmbientColor",
    "AmbientFactor",
    "SpecularFactor",
    "TransparentColor",
    "DisplacementColor",
    "VectorDisplacementColor",
    "ReflectionColor"
  ]);

  await withMockDocument(async () => {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(threeScalarTextureScene())), "");
    const exportedMaterial = group.getObjectByName("MaterialQuad").material;

    assertClose(exportedMaterial.bumpScale, 0.35);
    assertClose(exportedMaterial.displacementScale, 0.85);
    assertClose(exportedMaterial.reflectivity, 0.45);
    assert.ok(exportedMaterial.alphaMap);
    assert.ok(exportedMaterial.envMap);
  });
});

test("adapts Three.js lightMap texture and intensity to FBX ambient slots", () => {
  const scene = fromThreeObject(threeLightMapMaterialScene());
  const material = scene.meshes[0].materials[0];
  const normalizedMaterial = normalizeFbxScene(scene).meshes[0].materials[0];

  assert.equal(material.ambientFactor, 0.35);
  assert.equal(material.ambientTexture.name, "baked_light");
  assert.equal(material.ambientTexture.uvSet, "UVMap_1");
  assert.deepEqual(normalizedMaterial.textures.map((texture) => [texture.name, texture.property, texture.uvSet]).filter(([, property]) => {
    return property === "AmbientColor";
  }), [
    ["baked_light", "AmbientColor", "UVMap_1"]
  ]);

  const text = decode(exportFbx(threeLightMapMaterialScene()));
  assert.match(text, /AmbientColor/);
  assert.match(text, /AmbientFactor/);
  assert.match(text, /lightmap\.tga/);
});

test("adapts Three.js envMap intensity and rotation to FBX reflection fields", () => {
  const scene = fromThreeObject(threeEnvMapIntensityMaterialScene());
  const material = scene.meshes[0].materials[0];
  const normalizedMaterial = normalizeFbxScene(scene).meshes[0].materials[0];
  const reflectionTexture = normalizedMaterial.textures.find((texture) => texture.property === "ReflectionColor");

  assert.equal(material.reflectionFactor, 0.37);
  assert.equal(material.reflectionTexture.name, "studio_env");
  assert.deepEqual(material.reflectionTexture.rotation, [0.1, 0.2, 0.3]);
  assert.equal(reflectionTexture.name, "studio_env");
  assert.deepEqual(reflectionTexture.rotation, [0.1, 0.2, 0.3]);

  const text = decode(exportFbx(threeEnvMapIntensityMaterialScene()));
  assert.match(text, /ReflectionFactor/);
  assert.match(text, /ReflectionColor/);
  assert.match(text, /Rotation/);
  assert.match(text, /studio-env\.tga/);
});

test("adapts Three.js MeshStandardMaterial roughness and metalness fields", () => {
  const scene = fromThreeObject(threePbrMaterialScene());
  const material = scene.meshes[0].materials[0];
  const normalizedMaterial = normalizeFbxScene(scene).meshes[0].materials[0];

  assert.equal(material.shininess, roughnessToFbxShininess(0.25));
  assert.equal(material.reflectionFactor, 0.7);
  assert.deepEqual(normalizedMaterial.textures.map((texture) => [texture.name, texture.property]).filter(([, property]) => [
    "ShininessExponent",
    "ReflectionFactor"
  ].includes(property)), [
    ["roughness", "ShininessExponent"],
    ["metalness", "ReflectionFactor"]
  ]);

  const text = decode(exportFbx(scene));
  assert.match(text, /ThreePbrMaterial/);
  assert.match(text, /ShininessExponent/);
  assert.match(text, /ReflectionFactor/);
  assert.match(text, /roughness\.tga/);
  assert.match(text, /metalness\.tga/);
});

test("adapts Three.js userData texture aliases to FBX material lanes", () => {
  const scene = fromThreeObject(threeUserDataTextureAliasMaterialScene());
  const material = scene.meshes[0].materials[0];
  const normalizedMaterial = normalizeFbxScene(scene).meshes[0].materials[0];

  assert.equal(material.roughnessTexture.name, "roughness_alias");
  assert.equal(material.metalnessTexture.name, "metalness_alias");
  assert.equal(material.alphaTexture.name, "alpha_alias");
  assert.deepEqual(normalizedMaterial.textures.map((texture) => [texture.name, texture.property]).filter(([, property]) => [
    "ShininessExponent",
    "ReflectionFactor",
    "TransparencyFactor"
  ].includes(property)), [
    ["alpha_alias", "TransparencyFactor"],
    ["roughness_alias", "ShininessExponent"],
    ["metalness_alias", "ReflectionFactor"]
  ]);

  const text = decode(exportFbx(scene));
  assert.match(text, /ShininessExponent/);
  assert.match(text, /ReflectionFactor/);
  assert.match(text, /TransparencyFactor/);
  assert.match(text, /roughness-alias\.tga/);
  assert.match(text, /metalness-alias\.tga/);
  assert.match(text, /alpha-alias\.tga/);
});

test("adapts Three.js MeshPhysicalMaterial specular intensity and maps", () => {
  const source = threePhysicalSpecularMaterialScene();
  const sourceMaterial = source.getObjectByName("MaterialQuad").material;
  const scene = fromThreeObject(source);
  const material = scene.meshes[0].materials[0];
  const normalizedMaterial = normalizeFbxScene(scene).meshes[0].materials[0];

  assert.equal(material.specularFactor, 0.65);
  assertVectorClose(material.specularColor, srgb(sourceMaterial.specularColor.toArray()), 1e-5);
  assert.deepEqual(normalizedMaterial.textures.map((texture) => [texture.name, texture.property]).filter(([, property]) => [
    "SpecularColor",
    "SpecularFactor"
  ].includes(property)), [
    ["specular-color", "SpecularColor"],
    ["specular-intensity", "SpecularFactor"]
  ]);

  const text = decode(exportFbx(scene));
  assert.match(text, /SpecularColor/);
  assert.match(text, /SpecularFactor/);
  assert.match(text, /specular-color\.tga/);
  assert.match(text, /specular-intensity\.tga/);
});

test("adapts Three.js MeshPhysicalMaterial clearcoat and map to FBX reflection factor", () => {
  const scene = fromThreeObject(threePhysicalClearcoatMaterialScene());
  const material = scene.meshes[0].materials[0];
  const normalizedMaterial = normalizeFbxScene(scene).meshes[0].materials[0];

  assert.equal(material.reflectionFactor, 0.62);
  assert.deepEqual(normalizedMaterial.textures.map((texture) => [texture.name, texture.property]).filter(([, property]) => {
    return property === "ReflectionFactor";
  }), [
    ["clearcoat", "ReflectionFactor"]
  ]);

  const text = decode(exportFbx(scene));
  assert.match(text, /ReflectionFactor/);
  assert.match(text, /clearcoat\.tga/);
});

test("adapts Three.js MeshPhysicalMaterial clearcoat roughness and normal detail", () => {
  const scene = fromThreeObject(threePhysicalClearcoatDetailMaterialScene());
  const material = scene.meshes[0].materials[0];
  const normalizedMaterial = normalizeFbxScene(scene).meshes[0].materials[0];

  assert.equal(material.shininess, roughnessToFbxShininess(0.28));
  assert.equal(material.bumpFactor, 0.38);
  assert.deepEqual(normalizedMaterial.textures.map((texture) => [texture.name, texture.property]).filter(([, property]) => [
    "ShininessExponent",
    "NormalMap"
  ].includes(property)), [
    ["clearcoat-normal", "NormalMap"],
    ["clearcoat-roughness", "ShininessExponent"]
  ]);

  const text = decode(exportFbx(scene));
  assert.match(text, /ShininessExponent/);
  assert.match(text, /BumpFactor/);
  assert.match(text, /NormalMap/);
  assert.match(text, /clearcoat-normal\.tga/);
  assert.match(text, /clearcoat-roughness\.tga/);
});

test("adapts Three.js MeshPhysicalMaterial transmission and map to FBX transparency factor", () => {
  const scene = fromThreeObject(threePhysicalTransmissionMaterialScene());
  const material = scene.meshes[0].materials[0];
  const normalizedMaterial = normalizeFbxScene(scene).meshes[0].materials[0];

  assert.equal(material.transparencyFactor, 0.48);
  assert.deepEqual(normalizedMaterial.textures.map((texture) => [texture.name, texture.property]).filter(([, property]) => {
    return property === "TransparencyFactor";
  }), [
    ["transmission", "TransparencyFactor"]
  ]);

  const text = decode(exportFbx(scene));
  assert.match(text, /TransparencyFactor/);
  assert.match(text, /transmission\.tga/);
});

test("adapts Three.js MeshPhysicalMaterial sheen fields to FBX specular fields", () => {
  const source = threePhysicalSheenMaterialScene();
  const sourceMaterial = source.getObjectByName("MaterialQuad").material;
  const scene = fromThreeObject(source);
  const material = scene.meshes[0].materials[0];
  const normalizedMaterial = normalizeFbxScene(scene).meshes[0].materials[0];

  assert.equal(material.specularFactor, 0.44);
  assert.equal(material.shininess, roughnessToFbxShininess(0.35));
  assertVectorClose(material.specularColor, srgb(sourceMaterial.sheenColor.toArray()), 1e-5);
  assert.deepEqual(normalizedMaterial.textures.map((texture) => [texture.name, texture.property]).filter(([, property]) => [
    "SpecularColor",
    "ShininessExponent"
  ].includes(property)), [
    ["sheen-color", "SpecularColor"],
    ["sheen-roughness", "ShininessExponent"]
  ]);

  const text = decode(exportFbx(scene));
  assert.match(text, /SpecularColor/);
  assert.match(text, /SpecularFactor/);
  assert.match(text, /ShininessExponent/);
  assert.match(text, /sheen-color\.tga/);
  assert.match(text, /sheen-roughness\.tga/);
});

test("preserves Three.js physical extension maps as FBX custom texture lanes", () => {
  const scene = fromThreeObject(threePhysicalExtensionTextureScene());
  const normalizedMaterial = normalizeFbxScene(scene).meshes[0].materials[0];
  const extensionProperties = [
    "Maya|TEX_anisotropy_map",
    "Maya|TEX_iridescence_map",
    "Maya|TEX_iridescence_thickness_map",
    "Maya|TEX_thickness_map"
  ];

  assert.deepEqual(normalizedMaterial.textures.map((texture) => [texture.name, texture.property]).filter(([, property]) => {
    return extensionProperties.includes(property);
  }), [
    ["anisotropy", "Maya|TEX_anisotropy_map"],
    ["iridescence", "Maya|TEX_iridescence_map"],
    ["iridescence-thickness", "Maya|TEX_iridescence_thickness_map"],
    ["thickness", "Maya|TEX_thickness_map"]
  ]);

  const text = decode(exportFbx(scene));
  assert.match(text, /Maya\|TEX_anisotropy_map/);
  assert.match(text, /Maya\|TEX_iridescence_map/);
  assert.match(text, /Maya\|TEX_iridescence_thickness_map/);
  assert.match(text, /Maya\|TEX_thickness_map/);
  assert.match(text, /anisotropy\.tga/);
  assert.match(text, /iridescence\.tga/);
  assert.match(text, /iridescence-thickness\.tga/);
  assert.match(text, /thickness\.tga/);
});

test("preserves Three.js physical extension scalar and color values", () => {
  const source = threePhysicalExtensionValueScene();
  const sourceMaterial = source.getObjectByName("MaterialQuad").material;
  const scene = fromThreeObject(source);
  const material = normalizeFbxScene(scene).meshes[0].materials[0];

  assert.equal(material.anisotropy, 0.72);
  assert.equal(material.anisotropyRotation, 0.35);
  assert.equal(material.iridescence, 0.42);
  assert.equal(material.iridescenceIOR, 1.44);
  assert.equal(material.iridescenceThicknessMinimum, 120);
  assert.equal(material.iridescenceThicknessMaximum, 340);
  assert.equal(material.thickness, 0.18);
  assertVectorClose(material.attenuationColor, srgb(sourceMaterial.attenuationColor.toArray()), 1e-5);
  assert.equal(material.attenuationDistance, 7.5);
  assert.equal(material.ior, 1.62);
  assert.equal(material.dispersion, 0.04);

  const text = decode(exportFbx(scene));
  assert.match(text, /Maya\|anisotropy/);
  assert.match(text, /Maya\|anisotropy_rotation/);
  assert.match(text, /Maya\|iridescence/);
  assert.match(text, /Maya\|iridescence_ior/);
  assert.match(text, /Maya\|iridescence_thickness_minimum/);
  assert.match(text, /Maya\|iridescence_thickness_maximum/);
  assert.match(text, /Maya\|thickness/);
  assert.match(text, /Maya\|attenuation_color/);
  assert.match(text, /Maya\|attenuation_distance/);
  assert.match(text, /Maya\|ior/);
  assert.match(text, /Maya\|dispersion/);
});

test("preserves Three.js texture control material values", () => {
  const scene = fromThreeObject(threeTextureControlMaterialScene());
  const material = normalizeFbxScene(scene).meshes[0].materials[0];

  assert.equal(material.aoMapIntensity, 0.64);
  assert.equal(material.displacementBias, -0.12);
  assert.equal(material.alphaTest, 0.42);
  assert.equal(material.normalMapType, ObjectSpaceNormalMap);

  const text = decode(exportFbx(scene));
  assert.match(text, /Maya\|ao_map_intensity/);
  assert.match(text, /Maya\|displacement_bias/);
  assert.match(text, /Maya\|alpha_test/);
  assert.match(text, /Maya\|normal_map_type/);
  assert.match(text, /ao\.tga/);
  assert.match(text, /object-normal\.tga/);
  assert.match(text, /displacement\.tga/);
});

test("preserves Three.js material render-state values as custom properties", () => {
  const scene = fromThreeObject(threeRenderStateMaterialScene());
  const material = normalizeFbxScene(scene).meshes[0].materials[0];

  assert.equal(material.side, DoubleSide);
  assert.equal(material.blending, CustomBlending);
  assert.equal(material.blendSrc, SrcAlphaFactor);
  assert.equal(material.blendDst, OneMinusDstColorFactor);
  assert.equal(material.blendEquation, ReverseSubtractEquation);
  assert.equal(material.blendSrcAlpha, OneFactor);
  assert.equal(material.blendDstAlpha, ConstantColorFactor);
  assert.equal(material.blendEquationAlpha, SubtractEquation);
  assert.equal(material.blendAlpha, 0.33);
  assertVectorClose(material.blendColor, srgb([0.1, 0.2, 0.3]), 1e-5);
  assert.equal(material.depthFunc, AlwaysDepth);
  assert.equal(material.depthTest, 0);
  assert.equal(material.depthWrite, 0);
  assert.equal(material.colorWrite, 0);
  assert.equal(material.vertexColors, 1);
  assert.equal(material.fog, 0);
  assert.equal(material.materialVisible, 0);
  assert.equal(material.allowOverride, 0);
  assert.equal(material.shadowSide, BackSide);
  assert.equal(material.polygonOffset, 1);
  assert.equal(material.polygonOffsetFactor, 2);
  assert.equal(material.polygonOffsetUnits, -1);
  assert.equal(material.stencilWrite, 1);
  assert.equal(material.stencilWriteMask, 0xaa);
  assert.equal(material.stencilFunc, LessEqualStencilFunc);
  assert.equal(material.stencilRef, 3);
  assert.equal(material.stencilFuncMask, 0x0f);
  assert.equal(material.stencilFail, ReplaceStencilOp);
  assert.equal(material.stencilZFail, IncrementStencilOp);
  assert.equal(material.stencilZPass, DecrementStencilOp);
  assert.equal(material.clipIntersection, 1);
  assert.equal(material.clipShadows, 1);
  assert.equal(material.clippingPlaneCount, 1);
  assert.deepEqual(material.clippingPlanes, [{ normal: [0, 1, 0], constant: -0.5 }]);
  assert.equal(material.alphaHash, 1);
  assert.equal(material.alphaToCoverage, 1);
  assert.equal(material.premultipliedAlpha, 1);
  assert.equal(material.forceSinglePass, 1);
  assert.equal(material.toneMapped, 0);
  assert.equal(material.dithering, 1);
  assert.equal(material.wireframe, 1);
  assert.equal(material.wireframeLinewidth, 2);

  const text = decode(exportFbx(scene));
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
  assert.match(text, /Maya\|clipping_plane_count/);
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
});

test("Blender imports richer material diffuse color", { skip: !hasBlender, timeout: 60000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-"));
  const fbxPath = join(tempDir, "material.fbx");
  await writeFile(fbxPath, exportFbx(materialScene()));

  const script = `
import bpy
import json
import sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[-1])
mat = bpy.data.materials.get("RichMaterial")
print("FBX_VALIDATE:" + json.dumps({
    "name": mat.name if mat else None,
    "diffuseColor": list(mat.diffuse_color) if mat else [],
    "useNodes": mat.use_nodes if mat else None,
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
  assert.equal(info.name, "RichMaterial");
  assert.deepEqual(info.diffuseColor.slice(0, 3).map((value) => Number(value.toFixed(2))), [1, 0, 0]);
});
