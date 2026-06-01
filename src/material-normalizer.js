import { normalizeMaterialTextures } from "./texture-normalizer.js";
import { normalizeCustomMaterialProperties } from "./material-custom-properties.js";
import {
  MATERIAL_CLIPPING_PLANE_LIMIT,
  materialClippingPlaneConstantField,
  materialClippingPlaneNormalComponentField,
  materialClippingPlaneNormalField,
  normalizeMaterialClippingPlanes
} from "./material-clipping.js";
import { finiteNumber, vector } from "./value-normalizers.js";

const DEFAULT_MATERIAL = Object.freeze({
  name: "Default",
  shadingModel: "Phong",
  diffuseColor: [0.8, 0.8, 0.8],
  emissiveColor: [0, 0, 0],
  ambientColor: [0.2, 0.2, 0.2],
  specularColor: [0.2, 0.2, 0.2],
  transparentColor: [0, 0, 0],
  blendColor: [0, 0, 0],
  opacity: 1,
  transparencyFactor: 0,
  diffuseFactor: 1,
  emissiveFactor: 1,
  ambientFactor: 1,
  specularFactor: 0.25,
  shininess: 20,
  bumpFactor: 1,
  displacementFactor: 1,
  vectorDisplacementFactor: 1,
  reflectionFactor: 0,
  anisotropy: 0,
  anisotropyRotation: 0,
  iridescence: 0,
  iridescenceIOR: 1.3,
  iridescenceThicknessMinimum: 100,
  iridescenceThicknessMaximum: 400,
  thickness: 0,
  attenuationColor: [1, 1, 1],
  attenuationDistance: 0,
  ior: 1.5,
  dispersion: 0,
  aoMapIntensity: 1,
  displacementBias: 0,
  alphaTest: 0,
  normalMapType: 0,
  side: 0,
  blending: 1,
  blendSrc: 204,
  blendDst: 205,
  blendEquation: 100,
  blendSrcAlpha: -1,
  blendDstAlpha: -1,
  blendEquationAlpha: -1,
  blendAlpha: 0,
  depthFunc: 3,
  depthTest: 1,
  depthWrite: 1,
  colorWrite: 1,
  vertexColors: 0,
  fog: 1,
  materialVisible: 1,
  allowOverride: 1,
  shadowSide: -1,
  polygonOffset: 0,
  polygonOffsetFactor: 0,
  polygonOffsetUnits: 0,
  stencilWrite: 0,
  stencilWriteMask: 255,
  stencilFunc: 519,
  stencilRef: 0,
  stencilFuncMask: 255,
  stencilFail: 7680,
  stencilZFail: 7680,
  stencilZPass: 7680,
  clipIntersection: 0,
  clipShadows: 0,
  clippingPlaneCount: 0,
  alphaHash: 0,
  alphaToCoverage: 0,
  premultipliedAlpha: 0,
  forceSinglePass: 0,
  toneMapped: 1,
  dithering: 0,
  wireframe: 0,
  wireframeLinewidth: 1
});

const MATERIAL_CLIPPING_PLANE_CONSTANT_PROPERTIES = Array.from(
  { length: MATERIAL_CLIPPING_PLANE_LIMIT },
  (_, index) => materialClippingPlaneConstantField(index)
);
const MATERIAL_CLIPPING_PLANE_NORMAL_PROPERTIES = Array.from(
  { length: MATERIAL_CLIPPING_PLANE_LIMIT },
  (_, index) => materialClippingPlaneNormalField(index)
);
const MATERIAL_CLIPPING_PLANE_NORMAL_COMPONENT_PROPERTIES = MATERIAL_CLIPPING_PLANE_NORMAL_PROPERTIES.flatMap((_, index) => {
  return [0, 1, 2].map((componentIndex) => materialClippingPlaneNormalComponentField(index, componentIndex));
});

export const MATERIAL_SCALAR_ANIMATION_PROPERTIES = new Set([
  "opacity",
  "transparencyFactor",
  "diffuseFactor",
  "emissiveFactor",
  "ambientFactor",
  "specularFactor",
  "shininess",
  "bumpFactor",
  "displacementFactor",
  "vectorDisplacementFactor",
  "reflectionFactor",
  "anisotropy",
  "anisotropyRotation",
  "iridescence",
  "iridescenceIOR",
  "iridescenceThicknessMinimum",
  "iridescenceThicknessMaximum",
  "thickness",
  "attenuationDistance",
  "ior",
  "dispersion",
  "aoMapIntensity",
  "displacementBias",
  "alphaTest",
  "normalMapType",
  "side",
  "blending",
  "blendSrc",
  "blendDst",
  "blendEquation",
  "blendSrcAlpha",
  "blendDstAlpha",
  "blendEquationAlpha",
  "blendAlpha",
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
  "clippingPlaneCount",
  "alphaHash",
  "alphaToCoverage",
  "premultipliedAlpha",
  "forceSinglePass",
  "toneMapped",
  "dithering",
  "wireframe",
  "wireframeLinewidth",
  ...MATERIAL_CLIPPING_PLANE_CONSTANT_PROPERTIES
]);

export const MATERIAL_COLOR_ANIMATION_PROPERTIES = new Set([
  "diffuseColor",
  "emissiveColor",
  "ambientColor",
  "specularColor",
  "transparentColor",
  "attenuationColor",
  "blendColor"
]);

export const MATERIAL_VECTOR_ANIMATION_PROPERTIES = new Set([
  ...MATERIAL_CLIPPING_PLANE_NORMAL_PROPERTIES
]);

const MATERIAL_COLOR_COMPONENTS = Object.freeze({
  diffuseColorR: "diffuseColor",
  diffuseColorG: "diffuseColor",
  diffuseColorB: "diffuseColor",
  emissiveColorR: "emissiveColor",
  emissiveColorG: "emissiveColor",
  emissiveColorB: "emissiveColor",
  ambientColorR: "ambientColor",
  ambientColorG: "ambientColor",
  ambientColorB: "ambientColor",
  specularColorR: "specularColor",
  specularColorG: "specularColor",
  specularColorB: "specularColor",
  transparentColorR: "transparentColor",
  transparentColorG: "transparentColor",
  transparentColorB: "transparentColor",
  blendColorR: "blendColor",
  blendColorG: "blendColor",
  blendColorB: "blendColor",
  attenuationColorR: "attenuationColor",
  attenuationColorG: "attenuationColor",
  attenuationColorB: "attenuationColor"
});

export const MATERIAL_COLOR_COMPONENT_ANIMATION_PROPERTIES = new Set(Object.keys(MATERIAL_COLOR_COMPONENTS));
export const MATERIAL_VECTOR_COMPONENT_ANIMATION_PROPERTIES = new Set([
  ...MATERIAL_CLIPPING_PLANE_NORMAL_COMPONENT_PROPERTIES
]);

const MATERIAL_CLIPPING_PLANE_ALIASES = Object.freeze(Object.fromEntries(
  [
    ...MATERIAL_CLIPPING_PLANE_CONSTANT_PROPERTIES,
    ...MATERIAL_CLIPPING_PLANE_NORMAL_PROPERTIES,
    ...MATERIAL_CLIPPING_PLANE_NORMAL_COMPONENT_PROPERTIES
  ].flatMap((property, index) => [
    [property, property],
    [`material${property[0].toUpperCase()}${property.slice(1)}`, property]
  ])
));

const MATERIAL_ANIMATION_ALIASES = Object.freeze({
  color: "diffuseColor",
  colorR: "diffuseColorR",
  colorG: "diffuseColorG",
  colorB: "diffuseColorB",
  materialColor: "diffuseColor",
  materialColorR: "diffuseColorR",
  materialColorG: "diffuseColorG",
  materialColorB: "diffuseColorB",
  materialDiffuseColor: "diffuseColor",
  materialDiffuseColorR: "diffuseColorR",
  materialDiffuseColorG: "diffuseColorG",
  materialDiffuseColorB: "diffuseColorB",
  materialEmissiveColor: "emissiveColor",
  materialEmissiveColorR: "emissiveColorR",
  materialEmissiveColorG: "emissiveColorG",
  materialEmissiveColorB: "emissiveColorB",
  materialAmbientColor: "ambientColor",
  materialAmbientColorR: "ambientColorR",
  materialAmbientColorG: "ambientColorG",
  materialAmbientColorB: "ambientColorB",
  materialSpecularColor: "specularColor",
  materialSpecularColorR: "specularColorR",
  materialSpecularColorG: "specularColorG",
  materialSpecularColorB: "specularColorB",
  sheenColor: "specularColor",
  materialSheenColor: "specularColor",
  materialTransparentColor: "transparentColor",
  materialTransparentColorR: "transparentColorR",
  materialTransparentColorG: "transparentColorG",
  materialTransparentColorB: "transparentColorB",
  materialBlendColor: "blendColor",
  materialBlendColorR: "blendColorR",
  materialBlendColorG: "blendColorG",
  materialBlendColorB: "blendColorB",
  materialAttenuationColor: "attenuationColor",
  materialAttenuationColorR: "attenuationColorR",
  materialAttenuationColorG: "attenuationColorG",
  materialAttenuationColorB: "attenuationColorB",
  transparencyColor: "transparentColor",
  transparencyColorR: "transparentColorR",
  transparencyColorG: "transparentColorG",
  transparencyColorB: "transparentColorB",
  opacity: "opacity",
  alpha: "opacity",
  materialOpacity: "opacity",
  transparencyFactor: "transparencyFactor",
  transparentFactor: "transparencyFactor",
  transmission: "transparencyFactor",
  materialTransparencyFactor: "transparencyFactor",
  materialTransmission: "transparencyFactor",
  materialDiffuseFactor: "diffuseFactor",
  emissiveIntensity: "emissiveFactor",
  materialEmissiveFactor: "emissiveFactor",
  materialAmbientFactor: "ambientFactor",
  materialSpecularFactor: "specularFactor",
  specularIntensity: "specularFactor",
  materialSpecularIntensity: "specularFactor",
  sheen: "specularFactor",
  materialSheen: "specularFactor",
  materialShininess: "shininess",
  roughness: "shininess",
  materialRoughness: "shininess",
  clearcoatRoughness: "shininess",
  materialClearcoatRoughness: "shininess",
  sheenRoughness: "shininess",
  materialSheenRoughness: "shininess",
  bumpScale: "bumpFactor",
  normalScale: "bumpFactor",
  materialBumpFactor: "bumpFactor",
  displacementScale: "displacementFactor",
  materialDisplacementFactor: "displacementFactor",
  vectorDisplacementScale: "vectorDisplacementFactor",
  materialVectorDisplacementFactor: "vectorDisplacementFactor",
  reflectivity: "reflectionFactor",
  envMapIntensity: "reflectionFactor",
  clearcoat: "reflectionFactor",
  metalness: "reflectionFactor",
  materialReflectionFactor: "reflectionFactor",
  materialEnvMapIntensity: "reflectionFactor",
  materialClearcoat: "reflectionFactor",
  materialMetalness: "reflectionFactor",
  materialAnisotropy: "anisotropy",
  materialAnisotropyRotation: "anisotropyRotation",
  materialIridescence: "iridescence",
  materialIridescenceIOR: "iridescenceIOR",
  materialIridescenceThicknessMinimum: "iridescenceThicknessMinimum",
  materialIridescenceThicknessMaximum: "iridescenceThicknessMaximum",
  materialThickness: "thickness",
  materialAttenuationDistance: "attenuationDistance",
  materialIOR: "ior",
  materialDispersion: "dispersion",
  materialAoMapIntensity: "aoMapIntensity",
  materialAOMapIntensity: "aoMapIntensity",
  materialDisplacementBias: "displacementBias",
  materialAlphaTest: "alphaTest",
  materialNormalMapType: "normalMapType",
  materialSide: "side",
  materialBlending: "blending",
  materialBlendSrc: "blendSrc",
  materialBlendDst: "blendDst",
  materialBlendEquation: "blendEquation",
  materialBlendSrcAlpha: "blendSrcAlpha",
  materialBlendDstAlpha: "blendDstAlpha",
  materialBlendEquationAlpha: "blendEquationAlpha",
  materialBlendAlpha: "blendAlpha",
  materialDepthFunc: "depthFunc",
  materialDepthTest: "depthTest",
  materialDepthWrite: "depthWrite",
  materialColorWrite: "colorWrite",
  materialVertexColors: "vertexColors",
  materialFog: "fog",
  materialVisible: "materialVisible",
  materialVisibility: "materialVisible",
  materialAllowOverride: "allowOverride",
  materialShadowSide: "shadowSide",
  materialPolygonOffset: "polygonOffset",
  materialPolygonOffsetFactor: "polygonOffsetFactor",
  materialPolygonOffsetUnits: "polygonOffsetUnits",
  materialStencilWrite: "stencilWrite",
  materialStencilWriteMask: "stencilWriteMask",
  materialStencilFunc: "stencilFunc",
  materialStencilRef: "stencilRef",
  materialStencilFuncMask: "stencilFuncMask",
  materialStencilFail: "stencilFail",
  materialStencilZFail: "stencilZFail",
  materialStencilZPass: "stencilZPass",
  materialClipIntersection: "clipIntersection",
  materialClipShadows: "clipShadows",
  materialClippingPlaneCount: "clippingPlaneCount",
  materialAlphaHash: "alphaHash",
  materialAlphaToCoverage: "alphaToCoverage",
  materialPremultipliedAlpha: "premultipliedAlpha",
  materialForceSinglePass: "forceSinglePass",
  materialToneMapped: "toneMapped",
  materialDithering: "dithering",
  materialWireframe: "wireframe",
  materialWireframeLinewidth: "wireframeLinewidth",
  ...MATERIAL_CLIPPING_PLANE_ALIASES
});

export function roughnessToFbxShininess(value) {
  const roughness = Math.max(0, Math.min(1, finiteNumber(value, 0.5)));
  const gloss = (1 - roughness) * 10;
  return gloss * gloss;
}

function normalizeShininess(material) {
  if (material.shininess != null) {
    return finiteNumber(material.shininess, DEFAULT_MATERIAL.shininess);
  }
  if (material.sheen != null && material.sheen !== 0 && material.sheenRoughness != null) {
    return roughnessToFbxShininess(material.sheenRoughness);
  }
  if (material.clearcoat != null && material.clearcoat !== 0 && material.clearcoatRoughness != null) {
    return roughnessToFbxShininess(material.clearcoatRoughness);
  }
  if (material.roughness != null) {
    return roughnessToFbxShininess(material.roughness);
  }
  return DEFAULT_MATERIAL.shininess;
}

function normalizeOpacity(value) {
  return Math.max(0, Math.min(1, finiteNumber(value, 1)));
}

function normalizeTransparencyFactor(material, opacity) {
  const value = material.transparencyFactor ??
    material.transparentFactor ??
    (material.transmission != null && material.transmission !== 0 ? material.transmission : undefined);
  return Math.max(0, Math.min(1, finiteNumber(value, 1 - opacity)));
}

function normalizeShadingModel(value) {
  const text = String(value || "").toLowerCase();
  if (
    text.includes("lambert") ||
    text.includes("basic") ||
    text.includes("toon") ||
    text.includes("matcap") ||
    text.includes("unlit")
  ) {
    return "Lambert";
  }
  return "Phong";
}

function optionalFiniteNumber(value, fallback) {
  return value == null ? fallback : finiteNumber(value, fallback);
}

function normalizeReflectionFactor(material) {
  const hasReflectionTexture = Boolean(material.reflectionTexture ?? material.envMap);
  return finiteNumber(
    material.reflectionFactor ??
      (material.clearcoat != null && material.clearcoat !== 0 ? material.clearcoat : undefined) ??
      material.reflectivity ??
      (hasReflectionTexture ? material.envMapIntensity : undefined) ??
      material.metalness,
    DEFAULT_MATERIAL.reflectionFactor
  );
}

function normalizeThicknessRange(material, index, fallback) {
  const range = material.iridescenceThicknessRange ?? material.iridescenceThickness ?? material.iridescenceThicknesses;
  const value = material[index === 0 ? "iridescenceThicknessMinimum" : "iridescenceThicknessMaximum"] ??
    (Array.isArray(range) || ArrayBuffer.isView(range) ? range[index] : undefined);
  return finiteNumber(value, fallback);
}

export function normalizeMaterials(materials, options = {}) {
  const source = materials?.length ? materials : [DEFAULT_MATERIAL];
  return source.map((material, index) => {
    const name = material.name || (index === 0 ? DEFAULT_MATERIAL.name : `Material_${index + 1}`);
    const textures = normalizeMaterialTextures(material, name, options);
    const opacity = normalizeOpacity(material.opacity);
    return {
      name,
      animationName: material.animationName ?? material.animationTarget ?? material.targetName ?? null,
      shadingModel: normalizeShadingModel(material.shadingModel ?? material.model ?? material.type),
      diffuseColor: vector(material.diffuseColor ?? material.color, 3, DEFAULT_MATERIAL.diffuseColor),
      emissiveColor: vector(material.emissiveColor ?? material.emissive, 3, DEFAULT_MATERIAL.emissiveColor),
      ambientColor: vector(material.ambientColor ?? material.ambient, 3, DEFAULT_MATERIAL.ambientColor),
      specularColor: vector(material.specularColor ?? material.sheenColor, 3, DEFAULT_MATERIAL.specularColor),
      transparentColor: vector(material.transparentColor ?? material.transparencyColor, 3, DEFAULT_MATERIAL.transparentColor),
      blendColor: vector(material.blendColor, 3, DEFAULT_MATERIAL.blendColor),
      opacity,
      transparencyFactor: normalizeTransparencyFactor(material, opacity),
      diffuseFactor: finiteNumber(material.diffuseFactor, DEFAULT_MATERIAL.diffuseFactor),
      emissiveFactor: finiteNumber(material.emissiveFactor ?? material.emissiveIntensity, DEFAULT_MATERIAL.emissiveFactor),
      ambientFactor: finiteNumber(material.ambientFactor, DEFAULT_MATERIAL.ambientFactor),
      specularFactor: finiteNumber(material.specularFactor ?? material.sheen, DEFAULT_MATERIAL.specularFactor),
      shininess: normalizeShininess(material),
      bumpFactor: finiteNumber(material.bumpFactor ?? material.bumpScale, DEFAULT_MATERIAL.bumpFactor),
      displacementFactor: finiteNumber(material.displacementFactor ?? material.displacementScale, DEFAULT_MATERIAL.displacementFactor),
      vectorDisplacementFactor: finiteNumber(
        material.vectorDisplacementFactor ?? material.vectorDisplacementScale,
        DEFAULT_MATERIAL.vectorDisplacementFactor
      ),
      reflectionFactor: normalizeReflectionFactor(material),
      anisotropy: finiteNumber(material.anisotropy, DEFAULT_MATERIAL.anisotropy),
      anisotropyRotation: finiteNumber(material.anisotropyRotation, DEFAULT_MATERIAL.anisotropyRotation),
      iridescence: finiteNumber(material.iridescence, DEFAULT_MATERIAL.iridescence),
      iridescenceIOR: finiteNumber(material.iridescenceIOR, DEFAULT_MATERIAL.iridescenceIOR),
      iridescenceThicknessMinimum: normalizeThicknessRange(material, 0, DEFAULT_MATERIAL.iridescenceThicknessMinimum),
      iridescenceThicknessMaximum: normalizeThicknessRange(material, 1, DEFAULT_MATERIAL.iridescenceThicknessMaximum),
      thickness: finiteNumber(material.thickness, DEFAULT_MATERIAL.thickness),
      attenuationColor: vector(material.attenuationColor, 3, DEFAULT_MATERIAL.attenuationColor),
      attenuationDistance: finiteNumber(material.attenuationDistance, DEFAULT_MATERIAL.attenuationDistance),
      ior: finiteNumber(material.ior, DEFAULT_MATERIAL.ior),
      dispersion: finiteNumber(material.dispersion, DEFAULT_MATERIAL.dispersion),
      aoMapIntensity: finiteNumber(material.aoMapIntensity, DEFAULT_MATERIAL.aoMapIntensity),
      displacementBias: finiteNumber(material.displacementBias, DEFAULT_MATERIAL.displacementBias),
      alphaTest: finiteNumber(material.alphaTest, DEFAULT_MATERIAL.alphaTest),
      normalMapType: finiteNumber(material.normalMapType, DEFAULT_MATERIAL.normalMapType),
      side: finiteNumber(material.side, DEFAULT_MATERIAL.side),
      blending: finiteNumber(material.blending, DEFAULT_MATERIAL.blending),
      blendSrc: finiteNumber(material.blendSrc, DEFAULT_MATERIAL.blendSrc),
      blendDst: finiteNumber(material.blendDst, DEFAULT_MATERIAL.blendDst),
      blendEquation: finiteNumber(material.blendEquation, DEFAULT_MATERIAL.blendEquation),
      blendSrcAlpha: optionalFiniteNumber(material.blendSrcAlpha, DEFAULT_MATERIAL.blendSrcAlpha),
      blendDstAlpha: optionalFiniteNumber(material.blendDstAlpha, DEFAULT_MATERIAL.blendDstAlpha),
      blendEquationAlpha: optionalFiniteNumber(material.blendEquationAlpha, DEFAULT_MATERIAL.blendEquationAlpha),
      blendAlpha: finiteNumber(material.blendAlpha, DEFAULT_MATERIAL.blendAlpha),
      depthFunc: finiteNumber(material.depthFunc, DEFAULT_MATERIAL.depthFunc),
      depthTest: finiteNumber(material.depthTest, DEFAULT_MATERIAL.depthTest),
      depthWrite: finiteNumber(material.depthWrite, DEFAULT_MATERIAL.depthWrite),
      colorWrite: finiteNumber(material.colorWrite, DEFAULT_MATERIAL.colorWrite),
      vertexColors: finiteNumber(material.vertexColors, DEFAULT_MATERIAL.vertexColors),
      fog: finiteNumber(material.fog, DEFAULT_MATERIAL.fog),
      materialVisible: finiteNumber(material.materialVisible ?? material.visible, DEFAULT_MATERIAL.materialVisible),
      allowOverride: finiteNumber(material.allowOverride, DEFAULT_MATERIAL.allowOverride),
      shadowSide: optionalFiniteNumber(material.shadowSide, DEFAULT_MATERIAL.shadowSide),
      polygonOffset: finiteNumber(material.polygonOffset, DEFAULT_MATERIAL.polygonOffset),
      polygonOffsetFactor: finiteNumber(material.polygonOffsetFactor, DEFAULT_MATERIAL.polygonOffsetFactor),
      polygonOffsetUnits: finiteNumber(material.polygonOffsetUnits, DEFAULT_MATERIAL.polygonOffsetUnits),
      stencilWrite: finiteNumber(material.stencilWrite, DEFAULT_MATERIAL.stencilWrite),
      stencilWriteMask: finiteNumber(material.stencilWriteMask, DEFAULT_MATERIAL.stencilWriteMask),
      stencilFunc: finiteNumber(material.stencilFunc, DEFAULT_MATERIAL.stencilFunc),
      stencilRef: finiteNumber(material.stencilRef, DEFAULT_MATERIAL.stencilRef),
      stencilFuncMask: finiteNumber(material.stencilFuncMask, DEFAULT_MATERIAL.stencilFuncMask),
      stencilFail: finiteNumber(material.stencilFail, DEFAULT_MATERIAL.stencilFail),
      stencilZFail: finiteNumber(material.stencilZFail, DEFAULT_MATERIAL.stencilZFail),
      stencilZPass: finiteNumber(material.stencilZPass, DEFAULT_MATERIAL.stencilZPass),
      clipIntersection: finiteNumber(material.clipIntersection, DEFAULT_MATERIAL.clipIntersection),
      clipShadows: finiteNumber(material.clipShadows, DEFAULT_MATERIAL.clipShadows),
      clippingPlaneCount: finiteNumber(material.clippingPlaneCount, DEFAULT_MATERIAL.clippingPlaneCount),
      alphaHash: finiteNumber(material.alphaHash, DEFAULT_MATERIAL.alphaHash),
      alphaToCoverage: finiteNumber(material.alphaToCoverage, DEFAULT_MATERIAL.alphaToCoverage),
      premultipliedAlpha: finiteNumber(material.premultipliedAlpha, DEFAULT_MATERIAL.premultipliedAlpha),
      forceSinglePass: finiteNumber(material.forceSinglePass, DEFAULT_MATERIAL.forceSinglePass),
      toneMapped: finiteNumber(material.toneMapped, DEFAULT_MATERIAL.toneMapped),
      dithering: finiteNumber(material.dithering, DEFAULT_MATERIAL.dithering),
      wireframe: finiteNumber(material.wireframe, DEFAULT_MATERIAL.wireframe),
      wireframeLinewidth: finiteNumber(material.wireframeLinewidth, DEFAULT_MATERIAL.wireframeLinewidth),
      clippingPlanes: normalizeMaterialClippingPlanes(material.clippingPlanes),
      customProperties: normalizeCustomMaterialProperties(material.customProperties),
      textures,
      diffuseTexture: textures.find((texture) => texture.property === "DiffuseColor") || null
    };
  });
}

export function normalizeMaterialAnimationProperty(property) {
  if (
    MATERIAL_COLOR_ANIMATION_PROPERTIES.has(property) ||
    MATERIAL_COLOR_COMPONENT_ANIMATION_PROPERTIES.has(property) ||
    MATERIAL_VECTOR_ANIMATION_PROPERTIES.has(property) ||
    MATERIAL_VECTOR_COMPONENT_ANIMATION_PROPERTIES.has(property) ||
    MATERIAL_SCALAR_ANIMATION_PROPERTIES.has(property)
  ) {
    return property;
  }
  return MATERIAL_ANIMATION_ALIASES[property] || null;
}

export function materialAnimationPropertyAliases(property) {
  const aliases = [property];
  for (const [alias, normalizedProperty] of Object.entries(MATERIAL_ANIMATION_ALIASES)) {
    if (normalizedProperty === property && alias !== property) {
      aliases.push(alias);
    }
  }
  return aliases;
}
