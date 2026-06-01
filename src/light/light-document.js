import { FbxNode } from "../core/binary-writer.js";
import {
  addBoolProperty,
  addDoubleProperty,
  addIntProperty,
  addProperties70,
  addVectorProperty,
  fbxName,
  int32,
  int64
} from "../core/fbx-values.js";
import { addModelTransformProperties } from "../model/model-document.js";

const MODEL_VERSION = 232;
const LIGHT_VERSION = 124;

const LIGHT_TYPES = {
  point: 0,
  directional: 1,
  spot: 2
};

function parentId(record, parentModelIds, rootId) {
  if (!record.light.parent) {
    return rootId;
  }
  const parent = parentModelIds.get(record.light.parent);
  if (!parent) {
    throw new Error(`Light parent was not exported: ${record.light.parent}`);
  }
  return parent;
}

export function createLightRecords(scene, nextId) {
  return (scene.lights || []).map((light) => ({
    light,
    name: light.name,
    ids: {
      model: nextId(),
      attribute: nextId()
    },
    transform: light.transform,
    visibility: light.visibility,
    customProperties: light.customProperties
  }));
}

export function lightDefinitionCounts(records) {
  return {
    models: records.length,
    nodeAttributes: records.length
  };
}

export function lightParentMap(records) {
  return new Map(records.map((record) => [record.light.name, record.ids.model]));
}

export function lightTargets(records) {
  return records.map((record) => ({
    name: record.light.name,
    ids: {
      model: record.ids.model,
      attribute: record.ids.attribute
    },
    transform: record.light.transform,
    visibility: record.light.visibility,
    customProperties: record.light.customProperties,
    color: record.light.color,
    intensity: record.light.intensity,
    distance: record.light.distance,
    innerAngle: record.light.innerAngle,
    outerAngle: record.light.outerAngle
  }));
}

function buildLightAttribute(record) {
  const light = record.light;
  const node = new FbxNode("NodeAttribute", [
    int64(record.ids.attribute),
    fbxName("NodeAttribute", light.name),
    "Light"
  ]);
  node.add("TypeFlags", ["Light"]);
  node.add("Version", [LIGHT_VERSION]);
  const properties = addProperties70(node);
  addIntProperty(properties, "LightType", "enum", LIGHT_TYPES[light.kind] ?? 0);
  addBoolProperty(properties, "CastLight", light.enabled);
  addBoolProperty(properties, "CastLightOnObject", light.enabled);
  addVectorProperty(properties, "Color", "Color", light.color);
  addDoubleProperty(properties, "Intensity", "Number", light.intensity * 100);
  addBoolProperty(properties, "EnableFarAttenuation", light.distance > 0);
  addDoubleProperty(properties, "FarAttenuationEnd", "Number", light.distance);
  addDoubleProperty(properties, "InnerAngle", "Number", light.innerAngle);
  addDoubleProperty(properties, "OuterAngle", "Number", light.outerAngle);
  return node;
}

function buildLightModel(record) {
  const node = new FbxNode("Model", [int64(record.ids.model), fbxName("Model", record.light.name), "Light"]);
  node.add("Version", [MODEL_VERSION]);
  const properties = addProperties70(node);
  addModelTransformProperties(properties, record.light.transform, {
    visibility: record.light.visibility,
    customProperties: record.light.customProperties
  });
  node.add("MultiLayer", [int32(0)]);
  node.add("MultiTake", [int32(0)]);
  node.add("Shading", ["Y"]);
  node.add("Culling", ["CullingOff"]);
  return node;
}

export function buildLightObjects(records) {
  return records.flatMap((record) => [
    buildLightAttribute(record),
    buildLightModel(record)
  ]);
}

export function buildLightConnections(connections, records, rootId, parentModelIds = new Map()) {
  for (const record of records) {
    connections.add("C", ["OO", int64(record.ids.model), int64(parentId(record, parentModelIds, rootId))]);
    connections.add("C", ["OO", int64(record.ids.attribute), int64(record.ids.model)]);
  }
}
