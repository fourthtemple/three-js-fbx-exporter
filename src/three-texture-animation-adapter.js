import { THREE_TRACK_TARGET_PATTERN, threeTrackTargetName } from "./three-track-path.js";
import { THREE_MATERIAL_TEXTURE_TRACK_PATTERN } from "./three-material-texture-fields.js";
import { shaderUniformTextureField } from "./three-shader-uniform-adapter.js";
import {
  customTextureAnimationProperty,
  customTextureVectorComponentAnimationProperty
} from "./texture-custom-properties.js";
import { isCustomTexturePropertyPath, parseCustomTexturePropertyPath } from "./three-texture-custom-property-path.js";
import { textureLayerAlphaAnimationProperty, textureLayerBlendModeAnimationProperty } from "./texture-layer-animation-normalizer.js";
import {
  TEXTURE_SCALAR_SOURCE_PATH,
  TEXTURE_SCALAR_TRACK_PROPERTIES,
  threeTextureScalarProperty
} from "./three-texture-scalar-properties.js";

const TEXTURE_TRACK_PROPERTIES = THREE_MATERIAL_TEXTURE_TRACK_PATTERN;
const TEXTURE_FIELD_PATH = `(?:userData\\.)?(${TEXTURE_TRACK_PROPERTIES})`;
const TEXTURE_TRANSFORM_SOURCE_PATH = `(?:(?:${TEXTURE_SCALAR_SOURCE_PATH})\\.)?`;
const UNIFORM_NAME = "([A-Za-z_$][\\w$]*)";
const UNIFORM_TEXTURE_FIELD_PATH = `uniforms\\.${UNIFORM_NAME}\\.value(?:\\[(\\d+)\\])?`;
const TEXTURE_ATLAS_TILE_TRACK_PROPERTIES = "textureAtlasTile|atlasTile|atlasCell|tile|flipbookTile";
const TEXTURE_LAYER_SCALAR_TRACK_PROPERTIES = "layerAlpha|textureLayerAlpha|layerOpacity|textureLayerOpacity|layerBlendMode|textureLayerBlendMode";
const TEXTURE_LAYER_SOURCE_PATH = `(?:${TEXTURE_SCALAR_SOURCE_PATH}\\.)?`;
const AXIS_SUFFIXES = Object.freeze({ 0: "X", 1: "Y", 2: "Z", r: "X", g: "Y", b: "Z", x: "X", y: "Y", z: "Z" });
const AXIS_INDICES = Object.freeze({ X: 0, Y: 1, Z: 2 });
const TARGET = THREE_TRACK_TARGET_PATTERN;

function textureLayerProperty(property, index) {
  return property.toLowerCase().includes("blend")
    ? textureLayerBlendModeAnimationProperty(index)
    : textureLayerAlphaAnimationProperty(index);
}

function uniformTextureField(uniformName, arrayIndex) {
  return shaderUniformTextureField(arrayIndex == null ? uniformName : `${uniformName}_${arrayIndex}`);
}

function texturePivotProperty(property) {
  if (property === "rotationPivot" || property === "textureRotationPivot") {
    return "textureRotationPivot";
  }
  if (property === "scalingPivot" || property === "textureScalingPivot") {
    return "textureScalingPivot";
  }
  return null;
}

function componentAxis(suffix) {
  const axis = suffix?.match(/^(?:\.([rgbxyzRGBXYZ])|\[([rgbxyzRGBXYZ012])\])$/);
  return axis ? AXIS_SUFFIXES[(axis[1] || axis[2]).toLowerCase()] : null;
}

function customTexturePropertyKind(track) {
  const type = String(track.ValueTypeName || track.valueTypeName || "").toLowerCase();
  if (type.includes("color")) {
    return "color";
  }
  if (type.includes("vector") || trackValueSize(track) >= 3) {
    return "vector";
  }
  return "scalar";
}

function trackValueSize(track) {
  if (typeof track.getValueSize === "function") {
    return track.getValueSize();
  }
  const times = track.times?.length || 1;
  const values = track.values?.length || 1;
  return Math.max(1, Math.floor(values / times));
}

function customTextureTrackProperty(track, fbxProperty, axis) {
  if (axis) {
    return customTextureVectorComponentAnimationProperty(fbxProperty, AXIS_INDICES[axis]);
  }
  return customTextureAnimationProperty(customTexturePropertyKind(track), fbxProperty);
}

function textureTransformComponentProperty(property, axis) {
  if (property === "offset") {
    return `textureTranslation${axis}`;
  }
  if (property === "rotation") {
    return `textureRotation${axis}`;
  }
  if (property === "repeat") {
    return `textureScale${axis}`;
  }
  return null;
}

function texturePivotComponentProperties(property, axis) {
  if (property === "center" || property === "pivot") {
    return [`textureRotationPivot${axis}`, `textureScalingPivot${axis}`];
  }
  const pivotProperty = texturePivotProperty(property);
  return pivotProperty ? [`${pivotProperty}${axis}`] : [];
}

function normalizeMapObjectTrackName(source) {
  const mapObjectMatch = source.match(new RegExp(`^${TARGET}\\.map(\\..+)$`));
  if (/(^|\.)(material|materials)$/.test(mapObjectMatch?.[1] || "")) {
    return source;
  }
  return mapObjectMatch
    ? `${threeTrackTargetName(mapObjectMatch[1])}.material.map${mapObjectMatch[2]}`
    : source;
}

function resolvesToKnownTextureTarget(target, options = {}) {
  const resolved = options.trackTargetAliases?.get(target) || target;
  return options.textureTargetNames?.has(target) || options.textureTargetNames?.has(resolved);
}

function parseBareDirectTextureTrackName(source, options = {}) {
  if (source.includes(".__texture.")) {
    return null;
  }
  for (let index = source.lastIndexOf("."); index > 0; index = source.lastIndexOf(".", index - 1)) {
    const target = source.slice(0, index);
    const localPath = source.slice(index + 1);
    if (resolvesToKnownTextureTarget(target, options) && isThreeTextureLocalTrackName(localPath)) {
      return parseThreeTextureTrackName(`${target}.__texture.${localPath}`);
    }
  }
  return null;
}

export function isThreeTextureLocalTrackName(text) {
  const source = String(text);
  return new RegExp(`^${TEXTURE_TRANSFORM_SOURCE_PATH}(matrix|transformMatrix|uvMatrix)(?:\\.elements)?$`).test(source) ||
    new RegExp(`^${TEXTURE_TRANSFORM_SOURCE_PATH}(offset|repeat|rotation)(?:(?:\\.[xyzXYZ])|(?:\\[[xyzXYZ012]\\]))?$`).test(source) ||
    new RegExp(`^${TEXTURE_TRANSFORM_SOURCE_PATH}(center|pivot|rotationPivot|scalingPivot|textureRotationPivot|textureScalingPivot)(?:(?:\\.[xyzXYZ])|(?:\\[[xyzXYZ012]\\]))?$`).test(source) ||
    isCustomTexturePropertyPath(source) ||
    new RegExp(`^${TEXTURE_TRANSFORM_SOURCE_PATH}(${TEXTURE_ATLAS_TILE_TRACK_PROPERTIES})$`).test(source) ||
    new RegExp(`^${TEXTURE_LAYER_SOURCE_PATH}(${TEXTURE_LAYER_SCALAR_TRACK_PROPERTIES})$`).test(source) ||
    new RegExp(`^(?:${TEXTURE_SCALAR_SOURCE_PATH}\\.)?(${TEXTURE_SCALAR_TRACK_PROPERTIES})$`).test(source) ||
    new RegExp(`^userData\\.(?:${TEXTURE_SCALAR_SOURCE_PATH}\\.)?(${TEXTURE_SCALAR_TRACK_PROPERTIES})$`).test(source);
}

export function parseThreeTextureTrackName(text, options = {}) {
  const source = normalizeMapObjectTrackName(String(text));
  const directMatrixMatch = source.match(new RegExp(`^${TARGET}\\.__texture\\.${TEXTURE_TRANSFORM_SOURCE_PATH}(matrix|transformMatrix|uvMatrix)(?:\\.elements)?$`));
  if (directMatrixMatch) {
    return {
      target: threeTrackTargetName(directMatrixMatch[1]),
      binding: "textureMatrix",
      materialIndex: 0,
      textureField: "map",
      directTexture: true
    };
  }

  const directTransformComponentMatch = source.match(new RegExp(`^${TARGET}\\.__texture\\.${TEXTURE_TRANSFORM_SOURCE_PATH}(offset|repeat|rotation)((?:\\.[xyzXYZ])|(?:\\[[xyzXYZ012]\\]))$`));
  if (directTransformComponentMatch) {
    return {
      target: threeTrackTargetName(directTransformComponentMatch[1]),
      binding: "textureTransformComponent",
      materialIndex: 0,
      textureField: "map",
      textureProperty: directTransformComponentMatch[2],
      component: componentAxis(directTransformComponentMatch[3]),
      directTexture: true
    };
  }

  const directTransformMatch = source.match(new RegExp(`^${TARGET}\\.__texture\\.${TEXTURE_TRANSFORM_SOURCE_PATH}(offset|repeat|rotation)$`));
  if (directTransformMatch) {
    return {
      target: threeTrackTargetName(directTransformMatch[1]),
      binding: "textureTransform",
      materialIndex: 0,
      textureField: "map",
      textureProperty: directTransformMatch[2],
      directTexture: true
    };
  }

  const directPivotComponentMatch = source.match(new RegExp(`^${TARGET}\\.__texture\\.${TEXTURE_TRANSFORM_SOURCE_PATH}(center|pivot|rotationPivot|scalingPivot|textureRotationPivot|textureScalingPivot)((?:\\.[xyzXYZ])|(?:\\[[xyzXYZ012]\\]))$`));
  if (directPivotComponentMatch) {
    return {
      target: threeTrackTargetName(directPivotComponentMatch[1]),
      binding: "texturePivotComponent",
      materialIndex: 0,
      textureField: "map",
      textureProperty: directPivotComponentMatch[2],
      component: componentAxis(directPivotComponentMatch[3]),
      directTexture: true
    };
  }

  const directPivotMatch = source.match(new RegExp(`^${TARGET}\\.__texture\\.${TEXTURE_TRANSFORM_SOURCE_PATH}(center|pivot|rotationPivot|scalingPivot|textureRotationPivot|textureScalingPivot)$`));
  if (directPivotMatch) {
    return {
      target: threeTrackTargetName(directPivotMatch[1]),
      binding: "texturePivot",
      materialIndex: 0,
      textureField: "map",
      textureProperty: directPivotMatch[2],
      directTexture: true
    };
  }

  const directScalarMatch = source.match(new RegExp(`^${TARGET}\\.__texture(?:\\.${TEXTURE_SCALAR_SOURCE_PATH})?\\.(${TEXTURE_SCALAR_TRACK_PROPERTIES})$`)) ||
    source.match(new RegExp(`^${TARGET}\\.__texture\\.userData(?:\\.${TEXTURE_SCALAR_SOURCE_PATH})?\\.(${TEXTURE_SCALAR_TRACK_PROPERTIES})$`));
  if (directScalarMatch) {
    return {
      target: threeTrackTargetName(directScalarMatch[1]),
      binding: "textureScalar",
      materialIndex: 0,
      textureField: "map",
      property: threeTextureScalarProperty(directScalarMatch[2]),
      directTexture: true
    };
  }

  const directAtlasTileMatch = source.match(new RegExp(`^${TARGET}\\.__texture\\.${TEXTURE_TRANSFORM_SOURCE_PATH}(${TEXTURE_ATLAS_TILE_TRACK_PROPERTIES})$`));
  if (directAtlasTileMatch) {
    return {
      target: threeTrackTargetName(directAtlasTileMatch[1]),
      binding: "textureAtlasTile",
      materialIndex: 0,
      textureField: "map",
      directTexture: true
    };
  }

  const directLayerMatch = source.match(new RegExp(`^${TARGET}\\.__texture\\.${TEXTURE_LAYER_SOURCE_PATH}(${TEXTURE_LAYER_SCALAR_TRACK_PROPERTIES})$`));
  if (directLayerMatch) {
    return {
      target: threeTrackTargetName(directLayerMatch[1]),
      binding: "textureLayerScalar",
      layerProperty: directLayerMatch[2],
      directTexture: true
    };
  }

  const directCustomPropertyMatch = source.match(new RegExp(`^${TARGET}\\.__texture\\.(.+)$`));
  const directCustomProperty = directCustomPropertyMatch
    ? parseCustomTexturePropertyPath(directCustomPropertyMatch[2])
    : null;
  if (directCustomProperty) {
    return {
      target: threeTrackTargetName(directCustomPropertyMatch[1]),
      binding: "textureCustomProperty",
      materialIndex: 0,
      textureField: "map",
      customProperty: directCustomProperty.name,
      component: componentAxis(directCustomProperty.componentSuffix),
      directTexture: true
    };
  }

  const uniformMatrixMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.${UNIFORM_TEXTURE_FIELD_PATH}\\.${TEXTURE_TRANSFORM_SOURCE_PATH}(matrix|transformMatrix|uvMatrix)(?:\\.elements)?$`));
  if (uniformMatrixMatch) {
    return {
      target: threeTrackTargetName(uniformMatrixMatch[1]),
      binding: "textureMatrix",
      materialIndex: Number(uniformMatrixMatch[2] || 0),
      textureField: uniformTextureField(uniformMatrixMatch[3], uniformMatrixMatch[4])
    };
  }

  const uniformTransformComponentMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.${UNIFORM_TEXTURE_FIELD_PATH}\\.${TEXTURE_TRANSFORM_SOURCE_PATH}(offset|repeat|rotation)((?:\\.[xyzXYZ])|(?:\\[[xyzXYZ012]\\]))$`));
  if (uniformTransformComponentMatch) {
    return {
      target: threeTrackTargetName(uniformTransformComponentMatch[1]),
      binding: "textureTransformComponent",
      materialIndex: Number(uniformTransformComponentMatch[2] || 0),
      textureField: uniformTextureField(uniformTransformComponentMatch[3], uniformTransformComponentMatch[4]),
      textureProperty: uniformTransformComponentMatch[5],
      component: componentAxis(uniformTransformComponentMatch[6])
    };
  }

  const uniformTransformMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.${UNIFORM_TEXTURE_FIELD_PATH}\\.${TEXTURE_TRANSFORM_SOURCE_PATH}(offset|repeat|rotation)$`));
  if (uniformTransformMatch) {
    return {
      target: threeTrackTargetName(uniformTransformMatch[1]),
      binding: "textureTransform",
      materialIndex: Number(uniformTransformMatch[2] || 0),
      textureField: uniformTextureField(uniformTransformMatch[3], uniformTransformMatch[4]),
      textureProperty: uniformTransformMatch[5]
    };
  }

  const uniformPivotComponentMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.${UNIFORM_TEXTURE_FIELD_PATH}\\.${TEXTURE_TRANSFORM_SOURCE_PATH}(center|pivot|rotationPivot|scalingPivot|textureRotationPivot|textureScalingPivot)((?:\\.[xyzXYZ])|(?:\\[[xyzXYZ012]\\]))$`));
  if (uniformPivotComponentMatch) {
    return {
      target: threeTrackTargetName(uniformPivotComponentMatch[1]),
      binding: "texturePivotComponent",
      materialIndex: Number(uniformPivotComponentMatch[2] || 0),
      textureField: uniformTextureField(uniformPivotComponentMatch[3], uniformPivotComponentMatch[4]),
      textureProperty: uniformPivotComponentMatch[5],
      component: componentAxis(uniformPivotComponentMatch[6])
    };
  }

  const uniformPivotMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.${UNIFORM_TEXTURE_FIELD_PATH}\\.${TEXTURE_TRANSFORM_SOURCE_PATH}(center|pivot|rotationPivot|scalingPivot|textureRotationPivot|textureScalingPivot)$`));
  if (uniformPivotMatch) {
    return {
      target: threeTrackTargetName(uniformPivotMatch[1]),
      binding: "texturePivot",
      materialIndex: Number(uniformPivotMatch[2] || 0),
      textureField: uniformTextureField(uniformPivotMatch[3], uniformPivotMatch[4]),
      textureProperty: uniformPivotMatch[5]
    };
  }

  const uniformScalarMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.${UNIFORM_TEXTURE_FIELD_PATH}(?:\\.${TEXTURE_SCALAR_SOURCE_PATH})?\\.(${TEXTURE_SCALAR_TRACK_PROPERTIES})$`));
  if (uniformScalarMatch) {
    return {
      target: threeTrackTargetName(uniformScalarMatch[1]),
      binding: "textureScalar",
      materialIndex: Number(uniformScalarMatch[2] || 0),
      textureField: uniformTextureField(uniformScalarMatch[3], uniformScalarMatch[4]),
      property: threeTextureScalarProperty(uniformScalarMatch[5])
    };
  }

  const uniformAtlasTileMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.${UNIFORM_TEXTURE_FIELD_PATH}\\.${TEXTURE_TRANSFORM_SOURCE_PATH}(${TEXTURE_ATLAS_TILE_TRACK_PROPERTIES})$`));
  if (uniformAtlasTileMatch) {
    return {
      target: threeTrackTargetName(uniformAtlasTileMatch[1]),
      binding: "textureAtlasTile",
      materialIndex: Number(uniformAtlasTileMatch[2] || 0),
      textureField: uniformTextureField(uniformAtlasTileMatch[3], uniformAtlasTileMatch[4])
    };
  }

  const uniformCustomPropertyMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.${UNIFORM_TEXTURE_FIELD_PATH}\\.(.+)$`));
  const uniformCustomProperty = uniformCustomPropertyMatch
    ? parseCustomTexturePropertyPath(uniformCustomPropertyMatch[5])
    : null;
  if (uniformCustomProperty) {
    return {
      target: threeTrackTargetName(uniformCustomPropertyMatch[1]),
      binding: "textureCustomProperty",
      materialIndex: Number(uniformCustomPropertyMatch[2] || 0),
      textureField: uniformTextureField(uniformCustomPropertyMatch[3], uniformCustomPropertyMatch[4]),
      customProperty: uniformCustomProperty.name,
      component: componentAxis(uniformCustomProperty.componentSuffix)
    };
  }

  const matrixMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.${TEXTURE_FIELD_PATH}\\.${TEXTURE_TRANSFORM_SOURCE_PATH}(matrix|transformMatrix|uvMatrix)(?:\\.elements)?$`));
  if (matrixMatch) {
    return {
      target: threeTrackTargetName(matrixMatch[1]),
      binding: "textureMatrix",
      materialIndex: Number(matrixMatch[2] || 0),
      textureField: matrixMatch[3]
    };
  }

  const envMapRotationComponentMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.envMapRotation((?:\\.[xyzXYZ])|(?:\\[[xyzXYZ012]\\]))$`));
  if (envMapRotationComponentMatch) {
    return {
      target: threeTrackTargetName(envMapRotationComponentMatch[1]),
      binding: "textureTransformComponent",
      materialIndex: Number(envMapRotationComponentMatch[2] || 0),
      textureField: "envMap",
      textureProperty: "rotation",
      component: componentAxis(envMapRotationComponentMatch[3])
    };
  }

  const envMapRotationMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.envMapRotation$`));
  if (envMapRotationMatch) {
    return {
      target: threeTrackTargetName(envMapRotationMatch[1]),
      binding: "textureRotationVector",
      materialIndex: Number(envMapRotationMatch[2] || 0),
      textureField: "envMap"
    };
  }

  const transformComponentMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.${TEXTURE_FIELD_PATH}\\.${TEXTURE_TRANSFORM_SOURCE_PATH}(offset|repeat|rotation)((?:\\.[xyzXYZ])|(?:\\[[xyzXYZ012]\\]))$`));
  if (transformComponentMatch) {
    return {
      target: threeTrackTargetName(transformComponentMatch[1]),
      binding: "textureTransformComponent",
      materialIndex: Number(transformComponentMatch[2] || 0),
      textureField: transformComponentMatch[3],
      textureProperty: transformComponentMatch[4],
      component: componentAxis(transformComponentMatch[5])
    };
  }

  const transformMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.${TEXTURE_FIELD_PATH}\\.${TEXTURE_TRANSFORM_SOURCE_PATH}(offset|repeat|rotation)$`));
  if (transformMatch) {
    return {
      target: threeTrackTargetName(transformMatch[1]),
      binding: "textureTransform",
      materialIndex: Number(transformMatch[2] || 0),
      textureField: transformMatch[3],
      textureProperty: transformMatch[4]
    };
  }

  const pivotComponentMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.${TEXTURE_FIELD_PATH}\\.${TEXTURE_TRANSFORM_SOURCE_PATH}(center|pivot|rotationPivot|scalingPivot|textureRotationPivot|textureScalingPivot)((?:\\.[xyzXYZ])|(?:\\[[xyzXYZ012]\\]))$`));
  if (pivotComponentMatch) {
    return {
      target: threeTrackTargetName(pivotComponentMatch[1]),
      binding: "texturePivotComponent",
      materialIndex: Number(pivotComponentMatch[2] || 0),
      textureField: pivotComponentMatch[3],
      textureProperty: pivotComponentMatch[4],
      component: componentAxis(pivotComponentMatch[5])
    };
  }

  const pivotMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.${TEXTURE_FIELD_PATH}\\.${TEXTURE_TRANSFORM_SOURCE_PATH}(center|pivot|rotationPivot|scalingPivot|textureRotationPivot|textureScalingPivot)$`));
  if (pivotMatch) {
    return {
      target: threeTrackTargetName(pivotMatch[1]),
      binding: "texturePivot",
      materialIndex: Number(pivotMatch[2] || 0),
      textureField: pivotMatch[3],
      textureProperty: pivotMatch[4]
    };
  }

  const scalarMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.${TEXTURE_FIELD_PATH}(?:\\.${TEXTURE_SCALAR_SOURCE_PATH})?\\.(${TEXTURE_SCALAR_TRACK_PROPERTIES})$`));
  if (scalarMatch) {
    return {
      target: threeTrackTargetName(scalarMatch[1]),
      binding: "textureScalar",
      materialIndex: Number(scalarMatch[2] || 0),
      textureField: scalarMatch[3],
      property: threeTextureScalarProperty(scalarMatch[4])
    };
  }

  const atlasTileMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.${TEXTURE_FIELD_PATH}\\.${TEXTURE_TRANSFORM_SOURCE_PATH}(${TEXTURE_ATLAS_TILE_TRACK_PROPERTIES})$`));
  if (atlasTileMatch) {
    return {
      target: threeTrackTargetName(atlasTileMatch[1]),
      binding: "textureAtlasTile",
      materialIndex: Number(atlasTileMatch[2] || 0),
      textureField: atlasTileMatch[3]
    };
  }

  const layerMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.${TEXTURE_FIELD_PATH}\\.${TEXTURE_LAYER_SOURCE_PATH}(${TEXTURE_LAYER_SCALAR_TRACK_PROPERTIES})$`));
  if (layerMatch) {
    return {
      target: threeTrackTargetName(layerMatch[1]),
      binding: "textureLayerScalar",
      materialIndex: Number(layerMatch[2] || 0),
      textureField: layerMatch[3],
      layerProperty: layerMatch[4]
    };
  }

  const customPropertyMatch = source.match(new RegExp(`^${TARGET}(?:\\.[^.]+)*\\.materials?(?:\\[(\\d+)\\])?\\.${TEXTURE_FIELD_PATH}\\.(.+)$`));
  const customProperty = customPropertyMatch
    ? parseCustomTexturePropertyPath(customPropertyMatch[4])
    : null;
  if (customProperty) {
    return {
      target: threeTrackTargetName(customPropertyMatch[1]),
      binding: "textureCustomProperty",
      materialIndex: Number(customPropertyMatch[2] || 0),
      textureField: customPropertyMatch[3],
      customProperty: customProperty.name,
      component: componentAxis(customProperty.componentSuffix)
    };
  }
  return options.allowBareDirectTargets ? parseBareDirectTextureTrackName(source, options) : null;
}

function textureTarget(parsed, context) {
  if (parsed.directTexture) {
    return context.options.textureTargetNames?.has(parsed.target) ? parsed.target : null;
  }
  const target = context.options.textureNamesByMesh?.get(parsed.target)?.[parsed.materialIndex]?.[parsed.textureField];
  return target && context.targetNames.has(target) ? target : null;
}

function textureLayerTarget(parsed, context) {
  return parsed.directTexture
    ? context.options.textureLayerNamesByTexture?.get(parsed.target)
    : context.options.textureLayerNamesByMesh?.get(parsed.target)?.[parsed.materialIndex]?.[parsed.textureField];
}

export function convertThreeTextureTrack(parsed, track, context) {
  if (!parsed.binding?.startsWith("texture")) {
    return undefined;
  }
  if (parsed.binding === "textureLayerScalar") {
    const layer = textureLayerTarget(parsed, context);
    return layer ? {
      target: layer.target,
      property: textureLayerProperty(parsed.layerProperty, layer.index),
      keyframes: context.scalarKeyframes(track)
    } : null;
  }
  const target = textureTarget(parsed, context);
  if (!target) {
    return null;
  }

  if (parsed.binding === "textureTransform") {
    if (parsed.textureProperty === "rotation") {
      return {
        target,
        property: "textureRotation",
        keyframes: context.scalarZKeyframes(track)
      };
    }
    const property = parsed.textureProperty === "repeat" ? "textureScale" : "textureTranslation";
    return {
      target,
      property,
      keyframes: context.vectorKeyframes(track, property)
    };
  }

  if (parsed.binding === "textureRotationVector") {
    return {
      target,
      property: "textureRotation",
      keyframes: context.vectorKeyframes(track, "textureRotation")
    };
  }

  if (parsed.binding === "textureTransformComponent") {
    return {
      target,
      property: textureTransformComponentProperty(parsed.textureProperty, parsed.component),
      keyframes: context.scalarKeyframes(track)
    };
  }

  if (parsed.binding === "textureMatrix") {
    return {
      target,
      property: "textureMatrix",
      keyframes: context.matrixKeyframes(track)
    };
  }

  if (parsed.binding === "texturePivot") {
    const keyframes = context.vectorKeyframes(track, "textureRotationPivot");
    const property = texturePivotProperty(parsed.textureProperty);
    if (property) {
      return { target, property, keyframes };
    }
    return [
      { target, property: "textureRotationPivot", keyframes },
      { target, property: "textureScalingPivot", keyframes }
    ];
  }

  if (parsed.binding === "texturePivotComponent") {
    return texturePivotComponentProperties(parsed.textureProperty, parsed.component).map((property) => ({
      target,
      property,
      keyframes: context.scalarKeyframes(track)
    }));
  }

  if (parsed.binding === "textureAtlasTile") {
    return {
      target,
      property: "textureAtlasTile",
      keyframes: context.vectorKeyframes(track, "textureAtlasTile")
    };
  }

  if (parsed.binding === "textureScalar") {
    return {
      target,
      property: parsed.property,
      keyframes: context.scalarKeyframes(track)
    };
  }
  if (parsed.binding === "textureCustomProperty") {
    const isComponent = Boolean(parsed.component);
    const valueSize = trackValueSize(track);
    return {
      target,
      property: customTextureTrackProperty(track, parsed.customProperty, parsed.component),
      keyframes: isComponent
        ? valueSize > 1 ? context.vectorComponentKeyframes(track, AXIS_INDICES[parsed.component]) : context.scalarKeyframes(track)
        : customTexturePropertyKind(track) === "scalar"
          ? context.scalarKeyframes(track)
          : context.vectorKeyframes(track, "textureCustomProperty")
    };
  }
  return null;
}
