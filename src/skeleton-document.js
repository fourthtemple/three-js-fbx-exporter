import { FbxNode } from "./binary-writer.js";
import {
  addDoubleProperty,
  addProperties70,
  fbxName,
  float64,
  float64Array,
  int32,
  int32Array,
  int64
} from "./fbx-values.js";
import {
  identityMatrix,
  inverseAffineMatrix,
  multiplyMatrices,
  normalizeMatrix,
  transformMatrix
} from "./transform-matrix.js";
import { addModelTransformProperties } from "./model-document.js";

const MODEL_VERSION = 232;
const POSE_BIND_VERSION = 100;
const DEFORMER_SKIN_VERSION = 101;
const DEFORMER_CLUSTER_VERSION = 100;

function boneParentRecord(skeletonSet, boneRecord) {
  if (!boneRecord.bone.parent) {
    return null;
  }
  const parent = skeletonSet.bones.find((candidate) => candidate.bone.name === boneRecord.bone.parent);
  if (!parent) {
    throw new Error(`Bone parent was not exported: ${boneRecord.bone.parent}`);
  }
  return parent;
}

function boneParent(skeletonSet, boneRecord) {
  const parent = boneParentRecord(skeletonSet, boneRecord);
  if (!parent) {
    return 0;
  }
  return parent.ids.model;
}

function boneGlobalMatrix(skeletonSet, boneRecord) {
  if (boneRecord.globalMatrix) {
    return boneRecord.globalMatrix;
  }
  const local = transformMatrix(boneRecord.bone.transform);
  const parent = boneParentRecord(skeletonSet, boneRecord);
  if (!parent) {
    boneRecord.globalMatrix = local;
    return boneRecord.globalMatrix;
  }
  boneRecord.globalMatrix = multiplyMatrices(boneGlobalMatrix(skeletonSet, parent), local);
  return boneRecord.globalMatrix;
}

function meshBindMatrix(record) {
  return record.mesh.skin?.bindMatrix || transformMatrix(record.mesh.transform);
}

function boneBindMatrix(skeletonSet, boneRecord) {
  const explicit = normalizeMatrix(boneRecord.bone.bindMatrix);
  if (explicit) {
    return explicit;
  }
  const inverseBind = normalizeMatrix(boneRecord.bone.inverseBindMatrix);
  if (inverseBind) {
    return inverseAffineMatrix(inverseBind);
  }
  return boneGlobalMatrix(skeletonSet, boneRecord);
}

function associateModelMatrix(record) {
  return record.mesh.skin?.associateModelMatrix || identityMatrix();
}

function clusterWeights(mesh, boneName) {
  const cluster = mesh.skin.clusters.find((candidate) => candidate.bone === boneName);
  return {
    indices: cluster?.indices || [],
    weights: cluster?.weights || []
  };
}

export function createSkeletonRecords(meshRecords, nextId) {
  const bonesByName = new Map();
  const skinnedRecords = [];

  const ensureBone = (bone) => {
    const existing = bonesByName.get(bone.name);
    if (existing) {
      if (existing.bone.parent !== bone.parent) {
        throw new Error(`Shared bone '${bone.name}' has conflicting parents`);
      }
      return existing;
    }
    const boneRecord = {
      bone,
      ids: {
        model: nextId(),
        attribute: nextId()
      },
      transform: bone.transform
    };
    bonesByName.set(bone.name, boneRecord);
    return boneRecord;
  };

  for (const record of meshRecords) {
    if (!record.mesh.skin) {
      continue;
    }
    record.ids.pose = nextId();
    record.ids.skin = nextId();
    record.bones = record.mesh.skin.bones.map((bone) => {
      const sharedBone = ensureBone(bone);
      return {
        bone: sharedBone.bone,
        ids: {
          model: sharedBone.ids.model,
          attribute: sharedBone.ids.attribute,
          cluster: nextId()
        },
        sharedBone,
        transform: sharedBone.transform
      };
    });
    skinnedRecords.push(record);
  }
  return {
    records: skinnedRecords,
    bones: Array.from(bonesByName.values())
  };
}

export function skeletonTargets(skeletonSet) {
  return skeletonSet.bones.map((boneRecord) => ({
    name: boneRecord.bone.name,
    ids: { model: boneRecord.ids.model },
    transform: boneRecord.bone.transform,
    customProperties: boneRecord.bone.customProperties
  }));
}

export function countSkeletonObjects(skeletonSet) {
  return skeletonSet.bones.length * 2 + skeletonSet.records.reduce((count, record) => {
    return count + 2 + record.bones.length;
  }, 0);
}

export function skeletonDefinitionCounts(skeletonSet) {
  return skeletonSet.records.reduce((counts, record) => {
    counts.poses += 1;
    counts.deformers += 1 + record.bones.length;
    return counts;
  }, {
    models: skeletonSet.bones.length,
    nodeAttributes: skeletonSet.bones.length,
    poses: 0,
    deformers: 0
  });
}

function buildBoneAttribute(boneRecord) {
  const node = new FbxNode("NodeAttribute", [
    int64(boneRecord.ids.attribute),
    fbxName("NodeAttribute", boneRecord.bone.name),
    "LimbNode"
  ]);
  node.add("TypeFlags", ["Skeleton"]);
  const properties = addProperties70(node);
  addDoubleProperty(properties, "Size", "double", boneRecord.bone.size || 33);
  return node;
}

function buildBoneModel(boneRecord) {
  const node = new FbxNode("Model", [int64(boneRecord.ids.model), fbxName("Model", boneRecord.bone.name), "LimbNode"]);
  node.add("Version", [MODEL_VERSION]);
  const properties = addProperties70(node);
  addModelTransformProperties(properties, boneRecord.bone.transform, {
    defaultAttributeIndex: 0,
    customProperties: boneRecord.bone.customProperties
  });
  node.add("MultiLayer", [int32(0)]);
  node.add("MultiTake", [int32(0)]);
  node.add("Shading", ["Y"]);
  node.add("Culling", ["CullingOff"]);
  return node;
}

function buildBindPose(skeletonSet, record) {
  const node = new FbxNode("Pose", [int64(record.ids.pose), fbxName("Pose", `${record.mesh.name}BindPose`), "BindPose"]);
  node.add("Type", ["BindPose"]);
  node.add("Version", [POSE_BIND_VERSION]);
  node.add("NbPoseNodes", [int32(1 + record.bones.length)]);

  const meshPose = node.add("PoseNode");
  meshPose.add("Node", [int64(record.ids.model)]);
  meshPose.add("Matrix", [float64Array(meshBindMatrix(record))]);

  for (const boneRecord of record.bones) {
    const bonePose = node.add("PoseNode");
    bonePose.add("Node", [int64(boneRecord.ids.model)]);
    bonePose.add("Matrix", [float64Array(boneBindMatrix(skeletonSet, boneRecord.sharedBone))]);
  }
  return node;
}

function buildSkin(record) {
  const node = new FbxNode("Deformer", [int64(record.ids.skin), fbxName("Deformer", `${record.mesh.name}Skin`), "Skin"]);
  node.add("Version", [DEFORMER_SKIN_VERSION]);
  node.add("Link_DeformAcuracy", [float64(50)]);
  return node;
}

function buildCluster(skeletonSet, record, boneRecord) {
  const weights = clusterWeights(record.mesh, boneRecord.bone.name);
  const globalBoneMatrix = boneBindMatrix(skeletonSet, boneRecord.sharedBone);
  const meshMatrix = meshBindMatrix(record);
  const node = new FbxNode("Deformer", [
    int64(boneRecord.ids.cluster),
    fbxName("SubDeformer", boneRecord.bone.name),
    "Cluster"
  ]);
  node.add("Version", [DEFORMER_CLUSTER_VERSION]);
  node.add("UserData", ["", ""]);
  node.add("Indexes", [int32Array(weights.indices)]);
  node.add("Weights", [float64Array(weights.weights)]);
  node.add("Transform", [float64Array(multiplyMatrices(inverseAffineMatrix(globalBoneMatrix), meshMatrix))]);
  node.add("TransformLink", [float64Array(globalBoneMatrix)]);
  node.add("TransformAssociateModel", [float64Array(associateModelMatrix(record))]);
  return node;
}

export function buildSkeletonObjects(skeletonSet) {
  const nodes = [];
  for (const boneRecord of skeletonSet.bones) {
    nodes.push(buildBoneAttribute(boneRecord));
    nodes.push(buildBoneModel(boneRecord));
  }
  for (const record of skeletonSet.records) {
    nodes.push(buildBindPose(skeletonSet, record));
    nodes.push(buildSkin(record));
    for (const boneRecord of record.bones) {
      nodes.push(buildCluster(skeletonSet, record, boneRecord));
    }
  }
  return nodes;
}

export function buildSkeletonConnections(connections, skeletonSet) {
  for (const boneRecord of skeletonSet.bones) {
    connections.add("C", ["OO", int64(boneRecord.ids.model), int64(boneParent(skeletonSet, boneRecord))]);
    connections.add("C", ["OO", int64(boneRecord.ids.attribute), int64(boneRecord.ids.model)]);
  }
  for (const record of skeletonSet.records) {
    connections.add("C", ["OO", int64(record.ids.skin), int64(record.ids.geometry)]);
    for (const boneRecord of record.bones) {
      connections.add("C", ["OO", int64(boneRecord.ids.cluster), int64(record.ids.skin)]);
      connections.add("C", ["OO", int64(boneRecord.ids.model), int64(boneRecord.ids.cluster)]);
    }
  }
}
