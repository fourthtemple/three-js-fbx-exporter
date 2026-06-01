import {
  MATERIAL_COLOR_ANIMATION_PROPERTIES,
  MATERIAL_COLOR_COMPONENT_ANIMATION_PROPERTIES,
  MATERIAL_SCALAR_ANIMATION_PROPERTIES,
  MATERIAL_VECTOR_ANIMATION_PROPERTIES,
  MATERIAL_VECTOR_COMPONENT_ANIMATION_PROPERTIES,
  normalizeMaterialAnimationProperty
} from "../material/material-normalizer.js";
import {
  isCustomMaterialAnimationProperty,
  isCustomMaterialScalarAnimationProperty
} from "../material/material-custom-properties.js";
import {
  materialScalarKeyframeValue,
  materialVectorKeyframeValue
} from "../material/material-animation-keyframe-value.js";
import {
  sceneScalarKeyframeValue,
  sceneVectorKeyframeValue
} from "../scene/scene-animation-keyframe-value.js";
import {
  isCustomTextureAnimationProperty,
  isCustomTextureScalarAnimationProperty
} from "../texture/texture-custom-properties.js";
import {
  customAnimationScalarKeyframeValue,
  customAnimationVectorKeyframeValue
} from "./custom-animation-keyframe-value.js";
import {
  modelScalarKeyframeValue,
  modelVectorKeyframeValue
} from "../model/model-animation-keyframe-value.js";
import {
  isCustomModelAnimationProperty,
  isCustomModelScalarAnimationProperty
} from "../model/model-custom-properties.js";
import {
  LIGHT_COLOR_ANIMATION_PROPERTIES,
  LIGHT_SCALAR_ANIMATION_PROPERTIES,
  isLightAnimationProperty,
  isLightScalarAnimationProperty,
  normalizeLightAnimationProperty
} from "../light/light-normalizer.js";
import {
  TEXTURE_ANIMATION_PROPERTIES,
  TEXTURE_SCALAR_ANIMATION_PROPERTIES,
  isTextureScalarAnimationProperty,
  normalizeTextureAnimationKeyValue,
  normalizeTextureAnimationProperty,
  textureScalarKeyframeValue,
  textureVectorKeyframeValue
} from "../texture/texture-animation-normalizer.js";
import {
  TEXTURE_VIDEO_ANIMATION_PROPERTIES,
  isTextureVideoAnimationProperty,
  normalizeTextureVideoAnimationProperty,
  textureVideoScalarKeyframeValue
} from "../texture/texture-video-animation-normalizer.js";
import {
  isTextureLayerAnimationProperty,
  isTextureLayerScalarAnimationProperty,
  normalizeTextureLayerAnimationProperty,
  textureLayerScalarKeyframeValue
} from "../texture/texture-layer-animation-normalizer.js";
import { textureLayerTargetNames } from "../texture/texture-layer-properties.js";
import {
  expandTextureMatrixAnimationTrack,
  normalizeTextureMatrixAnimationProperty
} from "../texture/texture-matrix-animation-normalizer.js";
import {
  expandTextureAtlasAnimationTrack,
  normalizeTextureAtlasAnimationProperty
} from "../texture/texture-atlas-animation-normalizer.js";
import { normalizeTextureAtlas } from "../texture/texture-atlas.js";
import {
  MODEL_COMPONENT_ANIMATION_PROPERTIES,
  MODEL_VECTOR_ANIMATION_PROPERTIES,
  isModelScalarAnimationProperty,
  modelAnimationVectorFallback,
  normalizeModelAnimationProperty
} from "../model/model-animation-normalizer.js";
import { normalizeAnimationInterpolation } from "./animation-key-attributes.js";
import { normalizeAnimationLayerSettings } from "./animation-layer-settings.js";
import { finiteNumber, vector } from "../core/value-normalizers.js";

function isScalarAnimationProperty(property) {
  return ["morph", "cameraFocalLength", "cameraFocusDistance", "cameraOrthoZoom"].includes(property) ||
    isModelScalarAnimationProperty(property) ||
    isCustomModelScalarAnimationProperty(property) ||
    isLightScalarAnimationProperty(property) ||
    MATERIAL_COLOR_COMPONENT_ANIMATION_PROPERTIES.has(property) ||
    MATERIAL_VECTOR_COMPONENT_ANIMATION_PROPERTIES.has(property) ||
    MATERIAL_SCALAR_ANIMATION_PROPERTIES.has(property) ||
    isCustomMaterialScalarAnimationProperty(property) ||
    isTextureScalarAnimationProperty(property) ||
    isCustomTextureScalarAnimationProperty(property) ||
    isTextureVideoAnimationProperty(property) ||
    isTextureLayerScalarAnimationProperty(property) ||
    property === "visibility";
}

function animationTangentData(source) {
  const explicit = source.keyAttrDataFloat ?? source.keyAttributeDataFloat ?? source.tangentData ?? source.tangents ?? source.tangent;
  if (explicit != null) {
    return explicit;
  }
  const data = {
    rightSlope: source.rightSlope ?? source.outSlope ?? source.outTangent ?? source.rightDerivative,
    nextLeftSlope: source.nextLeftSlope ?? source.leftSlope ?? source.inSlope ?? source.inTangent ?? source.leftDerivative,
    rightWeight: source.rightWeight ?? source.outWeight,
    nextLeftWeight: source.nextLeftWeight ?? source.leftWeight ?? source.inWeight
  };
  return Object.values(data).some((value) => value != null) ? data : null;
}

function animationKeyMetadata(source) {
  const metadata = {};
  const flags = source.keyAttrFlags ?? source.keyAttributeFlags;
  if (Number.isInteger(flags)) {
    metadata.keyAttrFlags = flags;
  }
  const channelTangents = source.keyAttrDataFloatByChannel ??
    source.keyAttributeDataFloatByChannel ??
    source.tangentDataByChannel ??
    source.tangentsByChannel ??
    source.channelTangents;
  if (channelTangents != null) {
    metadata.tangentDataByChannel = channelTangents;
  }
  const tangentData = animationTangentData(source);
  if (tangentData != null) {
    metadata.tangentData = tangentData;
  }
  if (source.tangentMode != null) {
    metadata.tangentMode = source.tangentMode;
  }
  return metadata;
}

function scalarKeyframeValue(keyframe, property, options, sourceProperty = property) {
  const customValue = customAnimationScalarKeyframeValue(keyframe, property);
  if (customValue != null) {
    return customValue;
  }
  const modelValue = modelScalarKeyframeValue(keyframe, property, sourceProperty);
  if (modelValue != null) {
    return modelValue;
  }
  const layerValue = textureLayerScalarKeyframeValue(keyframe, property);
  if (layerValue != null) {
    return layerValue;
  }
  const materialValue = materialScalarKeyframeValue(keyframe, property, sourceProperty);
  if (materialValue != null) {
    return materialValue;
  }
  const sceneValue = sceneScalarKeyframeValue(keyframe, property, sourceProperty);
  if (sceneValue != null) {
    return sceneValue;
  }
  const direct = keyframe.value ?? keyframe[property];
  if (direct != null) {
    return textureScalarKeyframeValue(keyframe, property, options) ??
      textureVideoScalarKeyframeValue(keyframe, property) ??
      direct;
  }
  const textureValue = textureScalarKeyframeValue(keyframe, property, options);
  if (textureValue != null) {
    return textureValue;
  }
  const videoValue = textureVideoScalarKeyframeValue(keyframe, property);
  if (videoValue != null) {
    return videoValue;
  }
  if (property === "lightInnerAngle") {
    return keyframe.innerAngle ?? keyframe.spotInnerAngle ?? keyframe.hotSpotAngle ?? keyframe.angle ?? 0;
  }
  if (property === "lightOuterAngle") {
    return keyframe.outerAngle ?? keyframe.spotOuterAngle ?? keyframe.spotAngle ?? keyframe.coneAngle ?? keyframe.angle ?? 0;
  }
  return keyframe.lens ??
    keyframe.focusDistance ??
    keyframe.intensity ??
    keyframe.distance ??
    keyframe.farAttenuationEnd ??
    keyframe.weight ??
    keyframe.morph ??
    0;
}

function normalizeKeyframe(keyframe, property, options, fallbackInterpolation, sourceProperty = property) {
  const colorSource = MATERIAL_COLOR_ANIMATION_PROPERTIES.has(property) || LIGHT_COLOR_ANIMATION_PROPERTIES.has(property) ? keyframe.color : undefined;
  const customVectorSource = customAnimationVectorKeyframeValue(keyframe, property);
  const modelVectorSource = modelVectorKeyframeValue(keyframe, property, sourceProperty);
  const materialVectorSource = materialVectorKeyframeValue(keyframe, property, sourceProperty);
  const sceneVectorSource = sceneVectorKeyframeValue(keyframe, property, sourceProperty);
  const textureVectorSource = textureVectorKeyframeValue(keyframe, property, sourceProperty);
  const vectorSource = customVectorSource !== undefined
    ? customVectorSource
    : modelVectorSource ?? materialVectorSource ?? sceneVectorSource ?? textureVectorSource ?? keyframe.value ?? keyframe[property] ?? colorSource;
  const metadata = animationKeyMetadata(keyframe);
  if (TEXTURE_ANIMATION_PROPERTIES.has(property) && !isTextureScalarAnimationProperty(property)) {
    return {
      frame: finiteNumber(keyframe.frame ?? keyframe.time, 0),
      value: normalizeTextureAnimationKeyValue(vectorSource, property, options),
      interpolation: normalizeAnimationInterpolation(keyframe.interpolation ?? keyframe.interpolationMode ?? keyframe.easing, fallbackInterpolation),
      ...metadata
    };
  }
  return {
    frame: finiteNumber(keyframe.frame ?? keyframe.time, 0),
    value: isScalarAnimationProperty(property)
      ? finiteNumber(scalarKeyframeValue(keyframe, property, options, sourceProperty), 0)
      : vector(vectorSource, 3, modelAnimationVectorFallback(property)),
    interpolation: normalizeAnimationInterpolation(keyframe.interpolation ?? keyframe.interpolationMode ?? keyframe.easing, fallbackInterpolation),
    ...metadata
  };
}

function normalizeAnimationProperty(property) {
  if (
    isCustomModelAnimationProperty(property) ||
    isCustomMaterialAnimationProperty(property) ||
    isCustomTextureAnimationProperty(property) ||
    isTextureLayerAnimationProperty(property)
  ) {
    return property;
  }
  if (property === "blendShape" || property === "shape") {
    return "morph";
  }
  const modelProperty = normalizeModelAnimationProperty(property);
  if (modelProperty) {
    return modelProperty;
  }
  const materialProperty = normalizeMaterialAnimationProperty(property);
  if (materialProperty) {
    return materialProperty;
  }
  const lightProperty = normalizeLightAnimationProperty(property);
  if (lightProperty) {
    return lightProperty;
  }
  const textureProperty = normalizeTextureAnimationProperty(property);
  if (textureProperty) {
    return textureProperty;
  }
  const textureMatrixProperty = normalizeTextureMatrixAnimationProperty(property);
  if (textureMatrixProperty) {
    return textureMatrixProperty;
  }
  const textureAtlasProperty = normalizeTextureAtlasAnimationProperty(property);
  if (textureAtlasProperty) {
    return textureAtlasProperty;
  }
  const textureVideoProperty = normalizeTextureVideoAnimationProperty(property);
  if (textureVideoProperty) {
    return textureVideoProperty;
  }
  const textureLayerProperty = normalizeTextureLayerAnimationProperty(property);
  if (textureLayerProperty) {
    return textureLayerProperty;
  }
  if (property === "focalLength" || property === "lens" || property === "cameraFocalLength") {
    return "cameraFocalLength";
  }
  if (property === "focusDistance" || property === "dofFocusDistance" || property === "cameraFocusDistance") {
    return "cameraFocusDistance";
  }
  if (property === "orthoZoom" || property === "orthoScale" || property === "orthographicScale" || property === "cameraOrthoZoom") {
    return "cameraOrthoZoom";
  }
  if (property === "visibility" || property === "visible" || property === "Visibility") {
    return "visibility";
  }
  return property;
}

function normalizeAnimationTrack(track, options) {
  const property = track.property || track.channel || "translation";
  const normalizedProperty = normalizeAnimationProperty(property);
  if (![
    ...MODEL_VECTOR_ANIMATION_PROPERTIES,
    ...MODEL_COMPONENT_ANIMATION_PROPERTIES,
    "morph",
    ...MATERIAL_COLOR_ANIMATION_PROPERTIES,
    ...MATERIAL_COLOR_COMPONENT_ANIMATION_PROPERTIES,
    ...MATERIAL_VECTOR_ANIMATION_PROPERTIES,
    ...MATERIAL_VECTOR_COMPONENT_ANIMATION_PROPERTIES,
    ...MATERIAL_SCALAR_ANIMATION_PROPERTIES,
    "cameraFocalLength",
    "cameraFocusDistance",
    "cameraOrthoZoom",
    ...LIGHT_COLOR_ANIMATION_PROPERTIES,
    ...LIGHT_SCALAR_ANIMATION_PROPERTIES,
    ...TEXTURE_ANIMATION_PROPERTIES,
    "textureMatrix",
    ...Object.keys(TEXTURE_VIDEO_ANIMATION_PROPERTIES),
    "visibility"
  ].includes(normalizedProperty) &&
    !isCustomModelAnimationProperty(normalizedProperty) &&
    !isCustomMaterialAnimationProperty(normalizedProperty) &&
    !isCustomTextureAnimationProperty(normalizedProperty) &&
    !isTextureLayerAnimationProperty(normalizedProperty)) {
    throw new Error(`Unsupported animation track property: ${property}`);
  }
  const interpolation = normalizeAnimationInterpolation(track.interpolation ?? track.interpolationMode ?? track.curveInterpolation, "linear");
  const keyframes = (track.keyframes || track.keys || []).map((keyframe) => {
    return normalizeKeyframe(keyframe, normalizedProperty, options, interpolation, property);
  });
  if (!keyframes.length) {
    throw new Error("Animation tracks require at least one keyframe");
  }
  keyframes.sort((a, b) => a.frame - b.frame);
  return {
    target: track.target || track.bone || track.mesh || track.object || track.meshName,
    property: normalizedProperty,
    interpolation,
    ...animationKeyMetadata(track),
    morphTarget: track.morphTarget || track.shape || track.channelName || track.targetName || null,
    keyframes
  };
}

function normalizeAnimationTracks(tracks, options) {
  return (tracks || [])
    .flatMap((track) => expandTextureAtlasAnimationTrack(track, options))
    .flatMap((track) => expandTextureMatrixAnimationTrack(track))
    .map((track) => normalizeAnimationTrack(track, options));
}

function textureAtlasTargetMap(meshes) {
  const targets = new Map();
  for (const mesh of meshes) {
    for (const material of mesh.materials || []) {
      for (const texture of material.textures || []) {
        const atlas = normalizeTextureAtlas(texture);
        const key = texture.animationName || texture.name;
        if (atlas && key) {
          targets.set(key, atlas);
        }
      }
    }
  }
  return targets;
}

function normalizeAnimationLayers(clip, options) {
  const layers = Array.isArray(clip.layers) ? clip.layers : [];
  if (!layers.length) {
    return [{
      ...normalizeAnimationLayerSettings(clip),
      tracks: normalizeAnimationTracks(clip.tracks, options)
    }];
  }
  return layers.map((layer, index) => ({
    ...normalizeAnimationLayerSettings({
      ...clip,
      ...layer,
      layer: layer.layer || layer,
      name: layer.name || layer.layerName || `${clip.name || "Anim"}Layer_${index + 1}`
    }),
    tracks: normalizeAnimationTracks(layer.tracks, options)
  }));
}

function animationLayerSettingsOnly(layer) {
  if (!layer) {
    return null;
  }
  const { tracks, ...settings } = layer;
  return settings;
}

export function normalizeAnimations(scene, nodes, meshes, cameras, lights, options = {}) {
  const materialNames = new Set(meshes.flatMap((mesh) => {
    return mesh.materials.flatMap((material) => [material.animationName, material.name].filter(Boolean));
  }));
  const textureNames = new Set(meshes.flatMap((mesh) => {
    return mesh.materials.flatMap((material) => {
      return material.textures.flatMap((texture) => [texture.animationName, texture.name].filter(Boolean));
    });
  }));
  const textureLayerNames = new Set(textureLayerTargetNames(meshes));
  const cameraNames = new Set(cameras.map((camera) => camera.name));
  const lightNames = new Set(lights.map((light) => light.name));
  const boneNames = new Set(meshes.flatMap((mesh) => {
    return (mesh.skin?.bones || []).map((bone) => bone.name);
  }));
  const modelNames = new Set([
    ...nodes.map((node) => node.name),
    ...meshes.map((mesh) => mesh.name),
    ...cameras.map((camera) => camera.name),
    ...lights.map((light) => light.name),
    ...boneNames
  ]);
  const targetNames = new Set([
    ...modelNames,
    ...materialNames,
    ...textureNames,
    ...textureLayerNames
  ]);
  const textureAtlasByTarget = textureAtlasTargetMap(meshes);
  return (scene.animations || []).map((clip, index) => {
    const hasExplicitLayers = Array.isArray(clip.layers) && clip.layers.length > 0;
    const layers = normalizeAnimationLayers(clip, { ...options, textureAtlasByTarget });
    const tracks = layers.flatMap((layer) => layer.tracks);
    for (const track of tracks) {
      if (!targetNames.has(track.target)) {
        throw new Error(`Animation track references unknown target: ${track.target}`);
      }
      if (
        (
          MATERIAL_COLOR_ANIMATION_PROPERTIES.has(track.property) ||
          MATERIAL_COLOR_COMPONENT_ANIMATION_PROPERTIES.has(track.property) ||
          MATERIAL_VECTOR_ANIMATION_PROPERTIES.has(track.property) ||
          MATERIAL_VECTOR_COMPONENT_ANIMATION_PROPERTIES.has(track.property) ||
          MATERIAL_SCALAR_ANIMATION_PROPERTIES.has(track.property) ||
          isCustomMaterialAnimationProperty(track.property)
        ) &&
        !materialNames.has(track.target)
      ) {
        throw new Error(`Material animation target must be a material: ${track.target}`);
      }
      if ((track.property === "cameraFocalLength" || track.property === "cameraFocusDistance" || track.property === "cameraOrthoZoom") && !cameraNames.has(track.target)) {
        throw new Error(`Camera property animation target must be a camera: ${track.target}`);
      }
      if (isLightAnimationProperty(track.property) && !lightNames.has(track.target)) {
        throw new Error(`Light property animation target must be a light: ${track.target}`);
      }
      if (
        (TEXTURE_ANIMATION_PROPERTIES.has(track.property) || isCustomTextureAnimationProperty(track.property)) &&
        !textureNames.has(track.target)
      ) {
        throw new Error(`Texture animation target must be a texture: ${track.target}`);
      }
      if (isTextureVideoAnimationProperty(track.property) && !textureNames.has(track.target)) {
        throw new Error(`Texture video animation target must be a texture: ${track.target}`);
      }
      if (isTextureLayerAnimationProperty(track.property) && !textureLayerNames.has(track.target)) {
        throw new Error(`Texture layer animation target must be a layered texture: ${track.target}`);
      }
      if (isCustomModelAnimationProperty(track.property) && !modelNames.has(track.target)) {
        throw new Error(`Model custom property animation target must be a model: ${track.target}`);
      }
      if (track.property === "visibility" && !modelNames.has(track.target)) {
        throw new Error(`Visibility animation target must be a model: ${track.target}`);
      }
      if (track.property === "morph") {
        const mesh = meshes.find((candidate) => candidate.name === track.target);
        if (!mesh) {
          throw new Error(`Morph animation target must be a mesh: ${track.target}`);
        }
        if (!track.morphTarget) {
          throw new Error(`Morph animation track for '${track.target}' requires a morphTarget name`);
        }
        const morphTarget = mesh.geometry.morphTargets.find((target) => target.name === track.morphTarget);
        if (!morphTarget) {
          throw new Error(`Morph animation references unknown target '${track.target}.${track.morphTarget}'`);
        }
      }
    }
    const normalizedClip = {
      name: clip.name || `Take_${index + 1}`,
      frameRate: finiteNumber(clip.frameRate ?? scene.frameRate, 30),
      startFrame: clip.startFrame == null ? undefined : finiteNumber(clip.startFrame, 0),
      endFrame: clip.endFrame == null ? undefined : finiteNumber(clip.endFrame, 0),
      layer: animationLayerSettingsOnly(layers[0]) || normalizeAnimationLayerSettings(clip),
      tracks
    };
    if (hasExplicitLayers) {
      normalizedClip.layers = layers;
    }
    return normalizedClip;
  });
}
