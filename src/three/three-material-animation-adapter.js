import { roughnessToFbxShininess } from "../material/material-normalizer.js";
import {
  customMaterialAnimationProperty,
  customMaterialVectorComponentAnimationProperty
} from "../material/material-custom-properties.js";
import {
  MATERIAL_CLIPPING_PLANE_LIMIT,
  materialClippingPlaneConstantField,
  materialClippingPlaneNormalComponentField,
  materialClippingPlaneNormalField
} from "../material/material-clipping.js";
import {
  colorComponentKeyframesToFbx,
  colorKeyframesToFbx
} from "./three-color-adapter.js";
import {
  THREE_TRACK_TARGET_PATTERN,
  threeTrackTargetName
} from "./three-track-path.js";
import {
  parseShaderUniformComponentSuffix,
  parseShaderUniformArrayIndexSuffix,
  shaderUniformAnimationProperty,
  shaderUniformArrayElementAnimationProperty
} from "./three-shader-uniform-adapter.js";
import {
  isCustomMaterialPropertyPath,
  parseCustomMaterialPropertyPath
} from "./three-material-custom-property-path.js";

const TARGET = THREE_TRACK_TARGET_PATTERN;
const DIRECT_MATERIAL_PATH = `${TARGET}\\.__material(?:\\.userData)?`;
const UNIFORM_NAME = "([A-Za-z_$][\\w$]*)";
const UNIFORM_VALUE_PATH = `uniforms\\.${UNIFORM_NAME}\\.value`;
const UNIFORM_VALUE_SUFFIX = "((?:\\.[rgbxyzRGBXYZ])|(?:\\[[rgbxyzRGBXYZ0-9]+\\]))?";
const MATERIAL_SCALAR_TRACKS = Object.freeze({
  transparencyFactor: { property: "transparencyFactor" },
  transparentFactor: { property: "transparencyFactor" },
  transmission: { property: "transparencyFactor" },
  emissiveIntensity: { property: "emissiveFactor" },
  lightMapIntensity: { property: "ambientFactor" },
  specularIntensity: { property: "specularFactor" },
  sheen: { property: "specularFactor" },
  shininess: { property: "shininess" },
  roughness: { property: "shininess", mapValue: roughnessToFbxShininess },
  sheenRoughness: { property: "shininess", mapValue: roughnessToFbxShininess },
  clearcoatRoughness: { property: "shininess", mapValue: roughnessToFbxShininess },
  bumpScale: { property: "bumpFactor" },
  displacementScale: { property: "displacementFactor" },
  vectorDisplacementScale: { property: "vectorDisplacementFactor" },
  vectorDisplacementFactor: { property: "vectorDisplacementFactor" },
  reflectivity: { property: "reflectionFactor" },
  envMapIntensity: { property: "reflectionFactor" },
  clearcoat: { property: "reflectionFactor" },
  metalness: { property: "reflectionFactor" },
  anisotropy: { property: "anisotropy" },
  anisotropyRotation: { property: "anisotropyRotation" },
  iridescence: { property: "iridescence" },
  iridescenceIOR: { property: "iridescenceIOR" },
  thickness: { property: "thickness" },
  attenuationDistance: { property: "attenuationDistance" },
  ior: { property: "ior" },
  dispersion: { property: "dispersion" },
  aoMapIntensity: { property: "aoMapIntensity" },
  displacementBias: { property: "displacementBias" },
  alphaTest: { property: "alphaTest" },
  normalMapType: { property: "normalMapType" },
  side: { property: "side" },
  blending: { property: "blending" },
  blendSrc: { property: "blendSrc" },
  blendDst: { property: "blendDst" },
  blendEquation: { property: "blendEquation" },
  blendSrcAlpha: { property: "blendSrcAlpha" },
  blendDstAlpha: { property: "blendDstAlpha" },
  blendEquationAlpha: { property: "blendEquationAlpha" },
  blendAlpha: { property: "blendAlpha" },
  depthFunc: { property: "depthFunc" },
  depthTest: { property: "depthTest" },
  depthWrite: { property: "depthWrite" },
  colorWrite: { property: "colorWrite" },
  vertexColors: { property: "vertexColors" },
  fog: { property: "fog" },
  visible: { property: "materialVisible" },
  allowOverride: { property: "allowOverride" },
  shadowSide: { property: "shadowSide" },
  polygonOffset: { property: "polygonOffset" },
  polygonOffsetFactor: { property: "polygonOffsetFactor" },
  polygonOffsetUnits: { property: "polygonOffsetUnits" },
  stencilWrite: { property: "stencilWrite" },
  stencilWriteMask: { property: "stencilWriteMask" },
  stencilFunc: { property: "stencilFunc" },
  stencilRef: { property: "stencilRef" },
  stencilFuncMask: { property: "stencilFuncMask" },
  stencilFail: { property: "stencilFail" },
  stencilZFail: { property: "stencilZFail" },
  stencilZPass: { property: "stencilZPass" },
  clipIntersection: { property: "clipIntersection" },
  clipShadows: { property: "clipShadows" },
  clippingPlaneCount: { property: "clippingPlaneCount" },
  alphaHash: { property: "alphaHash" },
  alphaToCoverage: { property: "alphaToCoverage" },
  premultipliedAlpha: { property: "premultipliedAlpha" },
  forceSinglePass: { property: "forceSinglePass" },
  toneMapped: { property: "toneMapped" },
  dithering: { property: "dithering" },
  wireframe: { property: "wireframe" },
  wireframeLinewidth: { property: "wireframeLinewidth" }
});
const MATERIAL_SCALAR_TRACK_PROPERTIES = Object.keys(MATERIAL_SCALAR_TRACKS).join("|");
const MATERIAL_VECTOR_SCALAR_TRACKS = Object.freeze({
  normalScale: { property: "bumpFactor", componentIndex: 0 },
  clearcoatNormalScale: { property: "bumpFactor", componentIndex: 0 },
  iridescenceThicknessRange: {
    properties: ["iridescenceThicknessMinimum", "iridescenceThicknessMaximum"],
    componentIndex: 0
  }
});
const MATERIAL_VECTOR_SCALAR_TRACK_PROPERTIES = Object.keys(MATERIAL_VECTOR_SCALAR_TRACKS).join("|");
const MATERIAL_COLOR_TRACKS = Object.freeze({
  color: "diffuseColor",
  emissive: "emissiveColor",
  specular: "specularColor",
  specularColor: "specularColor",
  sheenColor: "specularColor",
  transparentColor: "transparentColor",
  blendColor: "blendColor",
  attenuationColor: "attenuationColor"
});
const MATERIAL_COLOR_TRACK_PROPERTIES = Object.keys(MATERIAL_COLOR_TRACKS).join("|");
const COLOR_COMPONENTS = Object.freeze({
  0: "R",
  1: "G",
  2: "B",
  r: "R",
  g: "G",
  b: "B",
  x: "R",
  y: "G",
  z: "B"
});
const VECTOR_SCALAR_COMPONENTS = Object.freeze({
  0: 0,
  1: 1,
  x: 0,
  y: 1
});
const VECTOR_COMPONENTS = Object.freeze({
  0: 0,
  1: 1,
  2: 2,
  x: 0,
  y: 1,
  z: 2
});
const CUSTOM_COMPONENTS = Object.freeze({
  0: 0,
  1: 1,
  2: 2,
  r: 0,
  g: 1,
  b: 2,
  x: 0,
  y: 1,
  z: 2
});

function parseColorComponentSuffix(suffix) {
  const match = suffix?.match(/^(?:\.([rgbxyzRGBXYZ])|\[([rgbxyzRGBXYZ012])\])$/);
  return match ? COLOR_COMPONENTS[(match[1] || match[2]).toLowerCase()] : null;
}

function parseVectorScalarComponentSuffix(suffix) {
  const match = suffix?.match(/^(?:\.([xyXY])|\[([xyXY01])\])$/);
  return match ? VECTOR_SCALAR_COMPONENTS[(match[1] || match[2]).toLowerCase()] : null;
}

function parseVectorComponentSuffix(suffix) {
  const match = suffix?.match(/^(?:\.([xyzXYZ])|\[([xyzXYZ012])\])$/);
  return match ? VECTOR_COMPONENTS[(match[1] || match[2]).toLowerCase()] : null;
}

function parseCustomComponentSuffix(suffix) {
  const match = suffix?.match(/^(?:\.([rgbxyzRGBXYZ])|\[([rgbxyzRGBXYZ012])\])$/);
  return match ? CUSTOM_COMPONENTS[(match[1] || match[2]).toLowerCase()] : null;
}

function materialTarget(parsed, context) {
  if (parsed.directMaterial) {
    return context.options.materialTargetNames?.has(parsed.target) ? parsed.target : null;
  }
  const target = context.options.materialNamesByMesh?.get(parsed.target)?.[parsed.materialIndex];
  return target && context.targetNames.has(target) ? target : null;
}

function trackValueSize(track) {
  if (typeof track.getValueSize === "function") {
    return track.getValueSize();
  }
  const times = track.times?.length || 1;
  const values = track.values?.length || 1;
  return Math.max(1, Math.floor(values / times));
}

function customMaterialPropertyKind(track) {
  const type = String(track.ValueTypeName || track.valueTypeName || "").toLowerCase();
  if (type.includes("color")) {
    return "color";
  }
  if (type.includes("vector") || trackValueSize(track) >= 3) {
    return "vector";
  }
  return "scalar";
}

function customMaterialTrackProperty(track, fbxProperty, component) {
  return component == null
    ? customMaterialAnimationProperty(customMaterialPropertyKind(track), fbxProperty)
    : customMaterialVectorComponentAnimationProperty(fbxProperty, component);
}

function resolvesToKnownMaterialTarget(target, options = {}) {
  const resolved = options.trackTargetAliases?.get(target) || target;
  return options.materialTargetNames?.has(target) || options.materialTargetNames?.has(resolved);
}

function parseBareDirectMaterialTrackName(source, options = {}) {
  if (source.includes(".__material.")) {
    return null;
  }
  for (let index = source.lastIndexOf("."); index > 0; index = source.lastIndexOf(".", index - 1)) {
    const target = source.slice(0, index);
    const localPath = source.slice(index + 1);
    if (resolvesToKnownMaterialTarget(target, options) && isThreeMaterialLocalTrackName(localPath)) {
      return parseThreeMaterialTrackName(`${target}.__material.${localPath}`);
    }
  }
  return null;
}

export function isThreeMaterialLocalTrackName(text) {
  const source = String(text);
  return new RegExp(`^(${MATERIAL_COLOR_TRACK_PROPERTIES})(?:(?:\\.[rgbxyzRGBXYZ])|(?:\\[[rgbxyzRGBXYZ012]\\]))?$`).test(source) ||
    /^opacity$/.test(source) ||
    new RegExp(`^(${MATERIAL_SCALAR_TRACK_PROPERTIES})$`).test(source) ||
    new RegExp(`^(${MATERIAL_VECTOR_SCALAR_TRACK_PROPERTIES})(?:(?:\\.[xyXY])|(?:\\[[xyXY01]\\]))?$`).test(source) ||
    isCustomMaterialPropertyPath(source) ||
    new RegExp(`^${UNIFORM_VALUE_PATH}${UNIFORM_VALUE_SUFFIX}$`).test(source);
}

export function parseThreeMaterialTrackName(text, options = {}) {
  const source = String(text);
  const colorFields = MATERIAL_COLOR_TRACK_PROPERTIES;
  const directColorMatch = source.match(new RegExp(`^${DIRECT_MATERIAL_PATH}\\.(${colorFields})$`));
  if (directColorMatch) {
    return {
      target: threeTrackTargetName(directColorMatch[1]),
      binding: "materialColor",
      materialIndex: 0,
      property: MATERIAL_COLOR_TRACKS[directColorMatch[2]],
      directMaterial: true
    };
  }

  const directColorComponentMatch = source.match(new RegExp(`^${DIRECT_MATERIAL_PATH}\\.(${colorFields})((?:\\.[rgbxyzRGBXYZ])|(?:\\[[rgbxyzRGBXYZ012]\\]))$`));
  if (directColorComponentMatch) {
    return {
      target: threeTrackTargetName(directColorComponentMatch[1]),
      binding: "materialColorComponent",
      materialIndex: 0,
      property: `${MATERIAL_COLOR_TRACKS[directColorComponentMatch[2]]}${parseColorComponentSuffix(directColorComponentMatch[3])}`,
      directMaterial: true
    };
  }

  const directOpacityMatch = source.match(new RegExp(`^${DIRECT_MATERIAL_PATH}\\.opacity$`));
  if (directOpacityMatch) {
    return {
      target: threeTrackTargetName(directOpacityMatch[1]),
      binding: "materialOpacity",
      materialIndex: 0,
      directMaterial: true
    };
  }

  const directScalarMatch = source.match(new RegExp(`^${DIRECT_MATERIAL_PATH}\\.(${MATERIAL_SCALAR_TRACK_PROPERTIES})$`));
  if (directScalarMatch) {
    return {
      target: threeTrackTargetName(directScalarMatch[1]),
      binding: "materialScalar",
      materialIndex: 0,
      scalarTrack: MATERIAL_SCALAR_TRACKS[directScalarMatch[2]],
      directMaterial: true
    };
  }

  const directVectorScalarMatch = source.match(new RegExp(`^${DIRECT_MATERIAL_PATH}\\.(${MATERIAL_VECTOR_SCALAR_TRACK_PROPERTIES})((?:\\.[xyXY])|(?:\\[[xyXY01]\\]))?$`));
  if (directVectorScalarMatch) {
    const vectorScalarTrack = MATERIAL_VECTOR_SCALAR_TRACKS[directVectorScalarMatch[2]];
    return {
      target: threeTrackTargetName(directVectorScalarMatch[1]),
      binding: "materialVectorScalar",
      materialIndex: 0,
      vectorScalarTrack: {
        ...vectorScalarTrack,
        componentIndex: parseVectorScalarComponentSuffix(directVectorScalarMatch[3]) ?? vectorScalarTrack.componentIndex
      },
      directMaterial: true
    };
  }

  const directUniformMatch = source.match(new RegExp(`^${DIRECT_MATERIAL_PATH}\\.${UNIFORM_VALUE_PATH}${UNIFORM_VALUE_SUFFIX}$`));
  if (directUniformMatch) {
    return {
      target: threeTrackTargetName(directUniformMatch[1]),
      binding: "materialShaderUniform",
      materialIndex: 0,
      uniformName: directUniformMatch[2],
      component: parseShaderUniformComponentSuffix(directUniformMatch[3]),
      arrayIndex: parseShaderUniformArrayIndexSuffix(directUniformMatch[3]),
      directMaterial: true
    };
  }

  const directCustomPropertyMatch = source.match(new RegExp(`^${DIRECT_MATERIAL_PATH}\\.(.+)$`));
  const directCustomProperty = directCustomPropertyMatch
    ? parseCustomMaterialPropertyPath(directCustomPropertyMatch[2])
    : null;
  if (directCustomProperty) {
    return {
      target: threeTrackTargetName(directCustomPropertyMatch[1]),
      binding: "materialCustomProperty",
      materialIndex: 0,
      customProperty: directCustomProperty.name,
      component: parseCustomComponentSuffix(directCustomProperty.componentSuffix),
      directMaterial: true
    };
  }

  const colorMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.(${colorFields})$`));
  if (colorMatch) {
    return {
      target: threeTrackTargetName(colorMatch[1]),
      binding: "materialColor",
      materialIndex: Number(colorMatch[2] || 0),
      property: MATERIAL_COLOR_TRACKS[colorMatch[3]]
    };
  }

  const colorComponentMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.(${colorFields})((?:\\.[rgbxyzRGBXYZ])|(?:\\[[rgbxyzRGBXYZ012]\\]))$`));
  if (colorComponentMatch) {
    return {
      target: threeTrackTargetName(colorComponentMatch[1]),
      binding: "materialColorComponent",
      materialIndex: Number(colorComponentMatch[2] || 0),
      property: `${MATERIAL_COLOR_TRACKS[colorComponentMatch[3]]}${parseColorComponentSuffix(colorComponentMatch[4])}`
    };
  }

  const opacityMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.opacity$`));
  if (opacityMatch) {
    return {
      target: threeTrackTargetName(opacityMatch[1]),
      binding: "materialOpacity",
      materialIndex: Number(opacityMatch[2] || 0)
    };
  }

  const clippingPlaneConstantMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.clippingPlanes\\[(\\d+)\\]\\.constant$`));
  if (clippingPlaneConstantMatch) {
    const clippingPlaneIndex = Number(clippingPlaneConstantMatch[3]);
    return clippingPlaneIndex < MATERIAL_CLIPPING_PLANE_LIMIT
      ? {
          target: threeTrackTargetName(clippingPlaneConstantMatch[1]),
          binding: "materialScalar",
          materialIndex: Number(clippingPlaneConstantMatch[2] || 0),
          scalarTrack: { property: materialClippingPlaneConstantField(clippingPlaneIndex) }
        }
      : null;
  }

  const clippingPlaneNormalMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.clippingPlanes\\[(\\d+)\\]\\.normal((?:\\.[xyzXYZ])|(?:\\[[xyzXYZ012]\\]))?$`));
  if (clippingPlaneNormalMatch) {
    const clippingPlaneIndex = Number(clippingPlaneNormalMatch[3]);
    const componentIndex = parseVectorComponentSuffix(clippingPlaneNormalMatch[4]);
    if (clippingPlaneIndex >= MATERIAL_CLIPPING_PLANE_LIMIT) {
      return null;
    }
    return {
      target: threeTrackTargetName(clippingPlaneNormalMatch[1]),
      binding: componentIndex == null ? "materialVector" : "materialVectorComponent",
      materialIndex: Number(clippingPlaneNormalMatch[2] || 0),
      vectorTrack: {
        property: componentIndex == null
          ? materialClippingPlaneNormalField(clippingPlaneIndex)
          : materialClippingPlaneNormalComponentField(clippingPlaneIndex, componentIndex),
        componentIndex
      }
    };
  }

  const scalarMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.(${MATERIAL_SCALAR_TRACK_PROPERTIES})$`));
  if (scalarMatch) {
    return {
      target: threeTrackTargetName(scalarMatch[1]),
      binding: "materialScalar",
      materialIndex: Number(scalarMatch[2] || 0),
      scalarTrack: MATERIAL_SCALAR_TRACKS[scalarMatch[3]]
    };
  }

  const vectorScalarMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.(${MATERIAL_VECTOR_SCALAR_TRACK_PROPERTIES})((?:\\.[xyXY])|(?:\\[[xyXY01]\\]))?$`));
  if (vectorScalarMatch) {
    const vectorScalarTrack = MATERIAL_VECTOR_SCALAR_TRACKS[vectorScalarMatch[3]];
    return {
      target: threeTrackTargetName(vectorScalarMatch[1]),
      binding: "materialVectorScalar",
      materialIndex: Number(vectorScalarMatch[2] || 0),
      vectorScalarTrack: {
        ...vectorScalarTrack,
        componentIndex: parseVectorScalarComponentSuffix(vectorScalarMatch[4]) ?? vectorScalarTrack.componentIndex
      }
    };
  }
  const uniformMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.${UNIFORM_VALUE_PATH}${UNIFORM_VALUE_SUFFIX}$`));
  if (uniformMatch) {
    return {
      target: threeTrackTargetName(uniformMatch[1]),
      binding: "materialShaderUniform",
      materialIndex: Number(uniformMatch[2] || 0),
      uniformName: uniformMatch[3],
      component: parseShaderUniformComponentSuffix(uniformMatch[4]),
      arrayIndex: parseShaderUniformArrayIndexSuffix(uniformMatch[4])
    };
  }
  const customPropertyMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.(.+)$`));
  const customProperty = customPropertyMatch
    ? parseCustomMaterialPropertyPath(customPropertyMatch[3])
    : null;
  if (customProperty) {
    return {
      target: threeTrackTargetName(customPropertyMatch[1]),
      binding: "materialCustomProperty",
      materialIndex: Number(customPropertyMatch[2] || 0),
      customProperty: customProperty.name,
      component: parseCustomComponentSuffix(customProperty.componentSuffix)
    };
  }
  return options.allowBareDirectTargets ? parseBareDirectMaterialTrackName(source, options) : null;
}

export function convertThreeMaterialTrack(parsed, track, context) {
  if (!parsed.binding?.startsWith("material")) {
    return undefined;
  }
  const target = materialTarget(parsed, context);
  if (!target) {
    return null;
  }

  if (parsed.binding === "materialColor") {
    return {
      target,
      property: parsed.property,
      keyframes: colorKeyframesToFbx(context.vectorKeyframes(track, parsed.property))
    };
  }
  if (parsed.binding === "materialColorComponent") {
    return {
      target,
      property: parsed.property,
      keyframes: colorComponentKeyframesToFbx(context.scalarKeyframes(track))
    };
  }
  if (parsed.binding === "materialOpacity") {
    return {
      target,
      property: "opacity",
      keyframes: context.scalarKeyframes(track)
    };
  }
  if (parsed.binding === "materialScalar") {
    return {
      target,
      property: parsed.scalarTrack.property,
      keyframes: parsed.scalarTrack.mapValue
        ? context.scalarKeyframesMapped(track, parsed.scalarTrack.mapValue)
        : context.scalarKeyframes(track)
    };
  }
  if (parsed.binding === "materialVector") {
    return {
      target,
      property: parsed.vectorTrack.property,
      keyframes: context.vectorKeyframes(track, parsed.vectorTrack.property)
    };
  }
  if (parsed.binding === "materialVectorComponent") {
    return {
      target,
      property: parsed.vectorTrack.property,
      keyframes: context.vectorComponentKeyframes(track, parsed.vectorTrack.componentIndex)
    };
  }
  if (parsed.binding === "materialVectorScalar") {
    const property = parsed.vectorScalarTrack.properties?.[parsed.vectorScalarTrack.componentIndex] ??
      parsed.vectorScalarTrack.property;
    return {
      target,
      property,
      keyframes: context.vectorComponentKeyframes(track, parsed.vectorScalarTrack.componentIndex)
    };
  }
  if (parsed.binding === "materialShaderUniform") {
    const valueSize = trackValueSize(track);
    const uniformArray = context.options.shaderUniformArraysByMaterial?.get(target)?.get(parsed.uniformName);
    if (uniformArray) {
      const elementKind = uniformArray.get(parsed.arrayIndex);
      if (parsed.arrayIndex != null && elementKind) {
        return {
          target,
          property: shaderUniformArrayElementAnimationProperty(parsed.uniformName, parsed.arrayIndex, elementKind),
          keyframes: elementKind === "scalar"
            ? context.scalarKeyframes(track)
            : context.vectorKeyframes(track, "materialShaderUniformArray")
        };
      }
      if (valueSize > 3 && Array.from(uniformArray.values()).every((kind) => kind === "scalar")) {
        return Array.from({ length: valueSize }, (_, index) => ({
          target,
          property: shaderUniformArrayElementAnimationProperty(parsed.uniformName, index),
          keyframes: context.vectorComponentKeyframes(track, index)
        }));
      }
    }
    const property = shaderUniformAnimationProperty(parsed.uniformName, valueSize, parsed.component);
    return {
      target,
      property,
      keyframes: parsed.component == null
        ? valueSize > 1 ? context.vectorKeyframes(track, property) : context.scalarKeyframes(track)
        : valueSize > 1 ? context.vectorComponentKeyframes(track, parsed.component) : context.scalarKeyframes(track)
    };
  }
  if (parsed.binding === "materialCustomProperty") {
    const isComponent = parsed.component != null;
    const valueSize = trackValueSize(track);
    return {
      target,
      property: customMaterialTrackProperty(track, parsed.customProperty, parsed.component),
      keyframes: isComponent
        ? valueSize > 1 ? context.vectorComponentKeyframes(track, parsed.component) : context.scalarKeyframes(track)
        : customMaterialPropertyKind(track) === "scalar"
          ? context.scalarKeyframes(track)
          : context.vectorKeyframes(track, "materialCustomProperty")
    };
  }
  return null;
}
