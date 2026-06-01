import { FbxNode } from "./binary-writer.js";
import {
  addProperties70,
  fbxName,
  int32,
  int64
} from "./fbx-values.js";
import { addModelTransformProperties } from "./model-document.js";

const MODEL_VERSION = 232;

function parentId(record, parentModelIds, rootId) {
  if (!record.node.parent) {
    return rootId;
  }
  const parent = parentModelIds.get(record.node.parent);
  if (!parent) {
    throw new Error(`Hierarchy parent was not exported: ${record.node.parent}`);
  }
  return parent;
}

function buildNullAttribute(record) {
  const node = new FbxNode("NodeAttribute", [
    int64(record.ids.attribute),
    fbxName("NodeAttribute", record.node.name),
    "Null"
  ]);
  node.add("TypeFlags", ["Null"]);
  return node;
}

function buildNullModel(record) {
  const node = new FbxNode("Model", [int64(record.ids.model), fbxName("Model", record.node.name), "Null"]);
  node.add("Version", [MODEL_VERSION]);
  const properties = addProperties70(node);
  addModelTransformProperties(properties, record.node.transform, {
    visibility: record.node.visibility,
    customProperties: record.node.customProperties
  });
  node.add("MultiLayer", [int32(0)]);
  node.add("MultiTake", [int32(0)]);
  node.add("Shading", ["Y"]);
  node.add("Culling", ["CullingOff"]);
  return node;
}

export function createHierarchyRecords(scene, nextId) {
  return (scene.nodes || []).map((node) => ({
    node,
    name: node.name,
    ids: {
      model: nextId(),
      attribute: nextId()
    },
    transform: node.transform,
    visibility: node.visibility,
    customProperties: node.customProperties
  }));
}

export function hierarchyDefinitionCounts(records) {
  return {
    models: records.length,
    nodeAttributes: records.length
  };
}

export function hierarchyParentMap(records) {
  return new Map(records.map((record) => [record.node.name, record.ids.model]));
}

export function hierarchyTargets(records) {
  return records.map((record) => ({
    name: record.node.name,
    ids: { model: record.ids.model },
    transform: record.node.transform,
    visibility: record.node.visibility,
    customProperties: record.node.customProperties
  }));
}

export function buildHierarchyObjects(records) {
  return records.flatMap((record) => [
    buildNullAttribute(record),
    buildNullModel(record)
  ]);
}

export function buildHierarchyConnections(connections, records, rootId, parentModelIds = hierarchyParentMap(records)) {
  for (const record of records) {
    connections.add("C", ["OO", int64(record.ids.model), int64(parentId(record, parentModelIds, rootId))]);
    connections.add("C", ["OO", int64(record.ids.attribute), int64(record.ids.model)]);
  }
}
