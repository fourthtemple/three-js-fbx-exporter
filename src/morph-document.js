import { FbxNode } from "./binary-writer.js";
import {
  addProperties70,
  fbxName,
  float64,
  float64Array,
  int32,
  int32Array,
  int64
} from "./fbx-values.js";

const DEFORMER_VERSION = 100;
const SHAPE_VERSION = 100;

export function createMorphRecords(meshRecords, nextId) {
  const records = [];
  for (const record of meshRecords) {
    const targets = record.mesh.geometry.morphTargets || [];
    if (!targets.length) {
      continue;
    }

    record.ids.blendShape = nextId();
    record.morphTargets = targets.map((target) => ({
      target,
      name: `${record.mesh.name}.${target.name}`,
      ids: {
        channel: nextId(),
        shapeGeometry: nextId()
      },
      meshRecord: record
    }));
    records.push(record);
  }
  return records;
}

export function morphDefinitionCounts(records) {
  return records.reduce((counts, record) => {
    counts.geometries += record.morphTargets.length;
    counts.deformers += 1 + record.morphTargets.length;
    return counts;
  }, {
    geometries: 0,
    deformers: 0
  });
}

export function morphTargets(records) {
  return records.flatMap((record) => record.morphTargets.map((targetRecord) => ({
    name: targetRecord.name,
    ids: { channel: targetRecord.ids.channel },
    defaultValue: targetRecord.target.weight || 0,
    morphName: targetRecord.target.name,
    meshName: record.mesh.name
  })));
}

function buildBlendShape(record) {
  const node = new FbxNode("Deformer", [
    int64(record.ids.blendShape),
    fbxName("Deformer", `${record.mesh.name}BlendShape`),
    "BlendShape"
  ]);
  node.add("Version", [int32(DEFORMER_VERSION)]);
  return node;
}

function buildBlendShapeChannel(targetRecord) {
  const node = new FbxNode("Deformer", [
    int64(targetRecord.ids.channel),
    fbxName("SubDeformer", targetRecord.target.name),
    "BlendShapeChannel"
  ]);
  node.add("Version", [int32(DEFORMER_VERSION)]);
  node.add("DeformPercent", [float64((targetRecord.target.weight || 0) * 100)]);
  node.add("FullWeights", [float64Array([100])]);
  return node;
}

function buildShapeGeometry(targetRecord) {
  const node = new FbxNode("Geometry", [
    int64(targetRecord.ids.shapeGeometry),
    fbxName("Geometry", targetRecord.target.name),
    "Shape"
  ]);
  addProperties70(node);
  node.add("Version", [int32(SHAPE_VERSION)]);
  node.add("Indexes", [int32Array(targetRecord.target.indices)]);
  node.add("Vertices", [float64Array(targetRecord.target.vertices)]);
  node.add("Normals", [float64Array(targetRecord.target.normals || [])]);
  return node;
}

export function buildMorphObjects(records) {
  const nodes = [];
  for (const record of records) {
    nodes.push(buildBlendShape(record));
    for (const targetRecord of record.morphTargets) {
      nodes.push(buildBlendShapeChannel(targetRecord));
      nodes.push(buildShapeGeometry(targetRecord));
    }
  }
  return nodes;
}

export function buildMorphConnections(connections, records) {
  for (const record of records) {
    connections.add("C", ["OO", int64(record.ids.blendShape), int64(record.ids.geometry)]);
    for (const targetRecord of record.morphTargets) {
      connections.add("C", ["OO", int64(targetRecord.ids.channel), int64(record.ids.blendShape)]);
      connections.add("C", ["OO", int64(targetRecord.ids.shapeGeometry), int64(targetRecord.ids.channel)]);
    }
  }
}
