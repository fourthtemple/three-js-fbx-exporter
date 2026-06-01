import { FbxNode } from "../core/binary-writer.js";
import {
  addBoolProperty,
  addDoubleProperty,
  addProperties70,
  addVectorProperty,
  fbxName,
  float32Array,
  float64,
  frameToKtime,
  int32,
  int32Array,
  int64,
  int64Array
} from "../core/fbx-values.js";
import {
  animationTrackChannels,
  animationTrackConfig,
  animationTrackDefaults
} from "./animation-track-config.js";
import {
  MATERIAL_COLOR_ANIMATION_PROPERTIES,
  MATERIAL_COLOR_COMPONENT_ANIMATION_PROPERTIES,
  MATERIAL_SCALAR_ANIMATION_PROPERTIES,
  MATERIAL_VECTOR_ANIMATION_PROPERTIES,
  MATERIAL_VECTOR_COMPONENT_ANIMATION_PROPERTIES
} from "../material/material-normalizer.js";
import { isCustomMaterialAnimationProperty } from "../material/material-custom-properties.js";
import { isCustomModelAnimationProperty } from "../model/model-custom-properties.js";
import { isCustomTextureAnimationProperty } from "../texture/texture-custom-properties.js";
import { TEXTURE_ANIMATION_PROPERTIES } from "../texture/texture-animation-normalizer.js";
import { isTextureLayerAnimationProperty } from "../texture/texture-layer-animation-normalizer.js";
import { isTextureVideoAnimationProperty } from "../texture/texture-video-animation-normalizer.js";
import { animationKeyAttributes } from "./animation-key-attributes.js";
import { normalizeAnimationLayerSettings } from "./animation-layer-settings.js";
import { animationClipFrameRange } from "./animation-timing.js";

const ANIM_KEY_VERSION = 4008;

function keyTime(frame, frameRate) {
  return int64(frameToKtime(frame, frameRate));
}

function keyTimes(keyframes, frameRate) {
  return keyframes.map((keyframe) => frameToKtime(keyframe.frame, frameRate));
}

function channelValues(keyframes, channel) {
  return keyframes.map((keyframe) => keyframe.value[channel]);
}

function curveValues(track, channel) {
  if (track.config.value) {
    return track.keyframes.map((keyframe) => track.config.value(keyframe, channel));
  }
  return channelValues(track.keyframes, channel);
}

function targetKeys(record) {
  return Array.from(new Set([
    record.animationName,
    record.material?.animationName,
    record.name || record.mesh?.name || record.material?.name
  ].filter(Boolean)));
}

function targetRecordsByKey(targetRecords) {
  const recordsByKey = new Map();
  for (const record of targetRecords) {
    for (const key of targetKeys(record)) {
      const records = recordsByKey.get(key) || [];
      records.push(record);
      recordsByKey.set(key, records);
    }
  }
  return recordsByKey;
}

function isTextureTargetTrack(track) {
  return TEXTURE_ANIMATION_PROPERTIES.has(track.property) ||
    isTextureVideoAnimationProperty(track.property) ||
    isCustomTextureAnimationProperty(track.property);
}

function isMaterialTargetTrack(track) {
  return MATERIAL_COLOR_ANIMATION_PROPERTIES.has(track.property) ||
    MATERIAL_COLOR_COMPONENT_ANIMATION_PROPERTIES.has(track.property) ||
    MATERIAL_VECTOR_ANIMATION_PROPERTIES.has(track.property) ||
    MATERIAL_VECTOR_COMPONENT_ANIMATION_PROPERTIES.has(track.property) ||
    MATERIAL_SCALAR_ANIMATION_PROPERTIES.has(track.property) ||
    isCustomMaterialAnimationProperty(track.property);
}

function isModelTargetTrack(track) {
  return isCustomModelAnimationProperty(track.property);
}

function isTextureLayerTargetTrack(track) {
  return isTextureLayerAnimationProperty(track.property);
}

function targetRecordForTrack(targetKey, track, matchingTargetRecords) {
  if (isTextureLayerTargetTrack(track)) {
    const layerRecords = matchingTargetRecords.filter((record) => record.layer);
    if (!layerRecords.length) {
      throw new Error(`Texture layer animation target was not exported: ${targetKey}`);
    }
    if (layerRecords.length > 1) {
      throw new Error(`Animation target is ambiguous: ${targetKey}`);
    }
    return layerRecords[0];
  }
  if (isTextureTargetTrack(track)) {
    const textureRecords = matchingTargetRecords.filter((record) => record.texture);
    if (!textureRecords.length) {
      throw new Error(`Texture animation target was not exported: ${targetKey}`);
    }
    if (textureRecords.length > 1) {
      throw new Error(`Animation target is ambiguous: ${targetKey}`);
    }
    return textureRecords[0];
  }
  if (isMaterialTargetTrack(track)) {
    const materialRecords = matchingTargetRecords.filter((record) => record.material);
    if (!materialRecords.length) {
      throw new Error(`Material animation target was not exported: ${targetKey}`);
    }
    if (materialRecords.length > 1) {
      throw new Error(`Animation target is ambiguous: ${targetKey}`);
    }
    return materialRecords[0];
  }
  if (isModelTargetTrack(track)) {
    const modelRecords = matchingTargetRecords.filter((record) => record.ids?.model);
    if (!modelRecords.length) {
      throw new Error(`Model animation target was not exported: ${targetKey}`);
    }
    if (modelRecords.length > 1) {
      throw new Error(`Animation target is ambiguous: ${targetKey}`);
    }
    return modelRecords[0];
  }
  return matchingTargetRecords[matchingTargetRecords.length - 1];
}

function clipLayerSources(clip) {
  const layers = Array.isArray(clip.layers) ? clip.layers : [];
  if (layers.length) {
    return layers;
  }
  return [{
    ...normalizeAnimationLayerSettings(clip),
    tracks: clip.tracks || []
  }];
}

function createTrackRecord(track, targetByName, nextId, frameRate) {
  const targetKey = track.property === "morph" ? `${track.target}.${track.morphTarget}` : track.target;
  const matchingTargetRecords = targetByName.get(targetKey);
  if (!matchingTargetRecords) {
    throw new Error(`Animation target was not exported: ${targetKey}`);
  }
  const config = animationTrackConfig(track);
  const targetRecord = targetRecordForTrack(targetKey, track, matchingTargetRecords);
  const channels = animationTrackChannels(config);
  return {
    ...track,
    frameRate,
    config,
    targetRecord,
    curveNodeId: nextId(),
    curveIds: channels.map(() => nextId())
  };
}

export function createAnimationRecords(scene, targetRecords, nextId) {
  const targetByName = targetRecordsByKey(targetRecords);
  return (scene.animations || []).map((clip, clipIndex) => {
    const frameRate = clip.frameRate || scene.frameRate || 30;
    const stackId = nextId();
    const layers = clipLayerSources(clip).map((layer) => ({
      settings: normalizeAnimationLayerSettings(layer),
      id: nextId(),
      tracks: (layer.tracks || []).map((track) => createTrackRecord(track, targetByName, nextId, frameRate))
    }));
    return {
      clip: {
        ...clip,
        name: clip.name || `AnimStack_${clipIndex + 1}`,
        frameRate,
        layer: layers[0]?.settings || normalizeAnimationLayerSettings(clip)
      },
      id: stackId,
      layerId: layers[0]?.id,
      layers,
      tracks: layers.flatMap((layer) => layer.tracks)
    };
  });
}

export function countAnimationObjects(animationRecords) {
  return animationRecords.reduce((count, record) => {
    return count + 1 + record.layers.reduce((layerCount, layer) => {
      return layerCount + 1 + layer.tracks.reduce((trackCount, track) => trackCount + 1 + track.curveIds.length, 0);
    }, 0);
  }, 0);
}

function buildAnimationStack(record) {
  const { startFrame, endFrame } = animationClipFrameRange(record.clip);
  const node = new FbxNode("AnimationStack", [int64(record.id), fbxName("AnimStack", record.clip.name), ""]);
  const properties = addProperties70(node);
  properties.add("P", ["Description", "KString", "", "", record.clip.name]);
  properties.add("P", ["LocalStart", "KTime", "Time", "", keyTime(startFrame, record.clip.frameRate)]);
  properties.add("P", ["LocalStop", "KTime", "Time", "", keyTime(endFrame, record.clip.frameRate)]);
  properties.add("P", ["ReferenceStart", "KTime", "Time", "", keyTime(startFrame, record.clip.frameRate)]);
  properties.add("P", ["ReferenceStop", "KTime", "Time", "", keyTime(endFrame, record.clip.frameRate)]);
  return node;
}

function buildAnimationLayer(layerRecord) {
  const layer = layerRecord.settings;
  const node = new FbxNode("AnimationLayer", [int64(layerRecord.id), fbxName("AnimLayer", layer.name), ""]);
  const properties = addProperties70(node);
  addDoubleProperty(properties, "Weight", "Number", layer.weight);
  addBoolProperty(properties, "Mute", layer.mute);
  addBoolProperty(properties, "Solo", layer.solo);
  addBoolProperty(properties, "Lock", layer.lock);
  addVectorProperty(properties, "Color", "ColorRGB", layer.color);
  properties.add("P", ["BlendMode", "enum", "", "", int32(layer.blendMode)]);
  properties.add("P", ["RotationAccumulationMode", "enum", "", "", int32(layer.rotationAccumulationMode)]);
  properties.add("P", ["ScaleAccumulationMode", "enum", "", "", int32(layer.scaleAccumulationMode)]);
  return node;
}

function buildAnimationCurveNode(track) {
  const node = new FbxNode("AnimationCurveNode", [
    int64(track.curveNodeId),
    fbxName("AnimCurveNode", track.config.group),
    ""
  ]);
  const properties = addProperties70(node);
  const channels = animationTrackChannels(track.config);
  const defaults = animationTrackDefaults(track);
  channels.forEach((axis, index) => {
    properties.add("P", [`d|${axis}`, "Number", "", "A", float64(defaults[index])]);
  });
  return node;
}

function buildAnimationCurve(track, channel) {
  const keyframes = track.keyframes;
  const values = curveValues(track, channel);
  const keyAttributes = animationKeyAttributes(keyframes, track, channel);
  const node = new FbxNode("AnimationCurve", [int64(track.curveIds[channel]), fbxName("AnimCurve", ""), ""]);
  node.add("Default", [float64(values[0] ?? 0)]);
  node.add("KeyVer", [int32(ANIM_KEY_VERSION)]);
  node.add("KeyTime", [int64Array(keyTimes(keyframes, track.frameRate))]);
  node.add("KeyValueFloat", [float32Array(values)]);
  node.add("KeyAttrFlags", [int32Array(keyAttributes.flags)]);
  node.add("KeyAttrDataFloat", [float32Array(keyAttributes.dataFloat)]);
  node.add("KeyAttrRefCount", [int32Array(keyAttributes.refCounts)]);
  return node;
}

export function buildAnimationObjects(animationRecords) {
  const nodes = [];
  for (const record of animationRecords) {
    nodes.push(buildAnimationStack(record));
    for (const layer of record.layers) {
      nodes.push(buildAnimationLayer(layer));
      for (const track of layer.tracks) {
        nodes.push(buildAnimationCurveNode(track));
        for (let channel = 0; channel < track.curveIds.length; channel += 1) {
          nodes.push(buildAnimationCurve(track, channel));
        }
      }
    }
  }
  return nodes;
}

export function buildAnimationConnections(connections, animationRecords) {
  for (const record of animationRecords) {
    for (const layer of record.layers) {
      connections.add("C", ["OO", int64(layer.id), int64(record.id)]);
      for (const track of layer.tracks) {
        connections.add("C", ["OO", int64(track.curveNodeId), int64(layer.id)]);
        const targetId = track.config.targetId
          ? track.config.targetId(track.targetRecord)
          : track.targetRecord.ids.model;
        connections.add("C", ["OP", int64(track.curveNodeId), int64(targetId), track.config.property]);
        animationTrackChannels(track.config).forEach((axis, channel) => {
          connections.add("C", ["OP", int64(track.curveIds[channel]), int64(track.curveNodeId), `d|${axis}`]);
        });
      }
    }
  }
}

export function buildTakes(animationRecords) {
  const takes = new FbxNode("Takes");
  takes.add("Current", [animationRecords[0]?.clip.name || ""]);
  for (const record of animationRecords) {
    const { startFrame, endFrame } = animationClipFrameRange(record.clip);
    const take = takes.add("Take", [record.clip.name]);
    take.add("FileName", [`${record.clip.name}.tak`]);
    take.add("LocalTime", [keyTime(startFrame, record.clip.frameRate), keyTime(endFrame, record.clip.frameRate)]);
    take.add("ReferenceTime", [keyTime(startFrame, record.clip.frameRate), keyTime(endFrame, record.clip.frameRate)]);
  }
  return takes;
}
