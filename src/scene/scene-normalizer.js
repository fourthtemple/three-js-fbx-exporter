import { normalizeGeometry } from "../geometry/geometry-normalizer.js";
import { normalizeAnimations } from "../animation/animation-normalizer.js";
import { normalizeLight as normalizeLightFields } from "../light/light-normalizer.js";
import { normalizeMaterials } from "../material/material-normalizer.js";
import { normalizeCustomModelProperties } from "../model/model-custom-properties.js";
import { normalizeMatrix } from "../core/transform-matrix.js";
import { finiteNumber, vector } from "../core/value-normalizers.js";

function modelCustomProperties(source = {}) {
  return source.customProperties ??
    source.fbxCustomProperties ??
    source.modelCustomProperties ??
    source.userData?.customProperties ??
    source.userData?.fbxCustomProperties ??
    source.userData?.modelCustomProperties;
}

function normalizeBone(bone, index) {
  return {
    name: bone.name || `Bone_${index + 1}`,
    sourceName: bone.sourceName || null,
    sourceUuid: bone.sourceUuid || bone.uuid || null,
    parent: bone.parent || null,
    size: finiteNumber(bone.size, 33),
    transform: normalizeTransform(bone),
    customProperties: normalizeCustomModelProperties(modelCustomProperties(bone)),
    bindMatrix: normalizeMatrix(bone.bindMatrix ?? bone.bindPoseMatrix ?? bone.transform?.bindMatrix),
    inverseBindMatrix: normalizeMatrix(
      bone.inverseBindMatrix ??
      bone.bindMatrixInverse ??
      bone.boneInverse ??
      bone.transform?.inverseBindMatrix
    )
  };
}

function normalizeCluster(cluster, vertexCount) {
  const indices = Array.from(cluster.indices || [], (index) => {
    const vertexIndex = Number(index);
    if (!Number.isInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= vertexCount) {
      throw new Error(`Invalid skin cluster vertex index: ${index}`);
    }
    return vertexIndex;
  });
  const weights = Array.from(cluster.weights || [], (weight) => Math.max(0, finiteNumber(weight, 0)));
  if (indices.length !== weights.length) {
    throw new Error(`Skin cluster '${cluster.bone}' must have matching indices and weights`);
  }
  return {
    bone: cluster.bone,
    indices,
    weights
  };
}

function normalizeSkin(skin, geometry) {
  if (!skin) {
    return null;
  }
  const bones = (skin.bones || []).map(normalizeBone);
  if (!bones.length) {
    throw new Error("Skinned meshes require at least one bone");
  }
  const boneNames = new Set(bones.map((bone) => bone.name));
  for (const bone of bones) {
    if (bone.parent && !boneNames.has(bone.parent)) {
      throw new Error(`Bone '${bone.name}' references unknown parent '${bone.parent}'`);
    }
  }

  const vertexCount = geometry.vertices.length / 3;
  const clusters = (skin.clusters || []).map((cluster) => normalizeCluster(cluster, vertexCount));
  for (const cluster of clusters) {
    if (!boneNames.has(cluster.bone)) {
      throw new Error(`Skin cluster references unknown bone '${cluster.bone}'`);
    }
  }
  return {
    bones,
    clusters,
    bindMatrix: normalizeMatrix(skin.bindMatrix ?? skin.meshBindMatrix),
    associateModelMatrix: normalizeMatrix(skin.associateModelMatrix ?? skin.armatureMatrix)
  };
}

function normalizeTransform(source = {}) {
  return {
    translation: vector(source.transform?.translation ?? source.translation, 3, [0, 0, 0]),
    rotation: vector(source.transform?.rotation ?? source.rotation, 3, [0, 0, 0]),
    scale: vector(source.transform?.scale ?? source.scale, 3, [1, 1, 1]),
    rotationOrder: normalizeRotationOrder(source.transform?.rotationOrder ?? source.rotationOrder),
    rotationOffset: vector(source.transform?.rotationOffset ?? source.rotationOffset, 3, [0, 0, 0]),
    rotationPivot: vector(source.transform?.rotationPivot ?? source.rotationPivot ?? source.pivot, 3, [0, 0, 0]),
    preRotation: vector(source.transform?.preRotation ?? source.preRotation, 3, [0, 0, 0]),
    postRotation: vector(source.transform?.postRotation ?? source.postRotation, 3, [0, 0, 0]),
    scalingOffset: vector(source.transform?.scalingOffset ?? source.scalingOffset, 3, [0, 0, 0]),
    scalingPivot: vector(source.transform?.scalingPivot ?? source.scalingPivot ?? source.pivot, 3, [0, 0, 0]),
    geometricTranslation: vector(source.transform?.geometricTranslation ?? source.geometricTranslation, 3, [0, 0, 0]),
    geometricRotation: vector(source.transform?.geometricRotation ?? source.geometricRotation, 3, [0, 0, 0]),
    geometricScaling: vector(
      source.transform?.geometricScaling ?? source.transform?.geometricScale ?? source.geometricScaling ?? source.geometricScale,
      3,
      [1, 1, 1]
    )
  };
}

function normalizeRotationOrder(value) {
  if (Number.isInteger(value) && value >= 0 && value <= 6) {
    return value;
  }
  const order = String(value || "").toUpperCase();
  return {
    XYZ: 0,
    XZY: 1,
    YZX: 2,
    YXZ: 3,
    ZXY: 4,
    ZYX: 5,
    SPHERICXYZ: 6,
    SPHERICALXYZ: 6
  }[order] ?? 0;
}

function normalizeVisibility(source = {}) {
  if (source.visibility != null) {
    return Math.max(0, Math.min(1, finiteNumber(source.visibility, 1)));
  }
  if (source.visible != null) {
    return source.visible ? 1 : 0;
  }
  if (source.hidden != null) {
    return source.hidden ? 0 : 1;
  }
  return 1;
}

function normalizeNode(node, index) {
  return {
    name: node.name || `Node_${index + 1}`,
    parent: node.parent || null,
    transform: normalizeTransform(node),
    visibility: normalizeVisibility(node),
    customProperties: normalizeCustomModelProperties(modelCustomProperties(node))
  };
}

function normalizeCamera(camera, index) {
  const projection = camera.projection === "orthographic" || camera.type === "orthographic" ? "orthographic" : "perspective";
  return {
    name: camera.name || `Camera_${index + 1}`,
    parent: camera.parent || null,
    transform: normalizeTransform(camera),
    visibility: normalizeVisibility(camera),
    customProperties: normalizeCustomModelProperties(modelCustomProperties(camera)),
    projection,
    fov: finiteNumber(camera.fov ?? camera.fieldOfView, 45),
    focalLength: camera.focalLength == null && camera.lens == null ? null : finiteNumber(camera.focalLength ?? camera.lens, 35),
    focusDistance: camera.focusDistance == null && camera.dofFocusDistance == null ? null : finiteNumber(camera.focusDistance ?? camera.dofFocusDistance, 10),
    orthoZoom: finiteNumber(camera.orthoZoom ?? camera.orthographicScale ?? camera.orthoScale, projection === "orthographic" ? 1 : 0),
    near: finiteNumber(camera.near, 0.1),
    far: finiteNumber(camera.far, 1000),
    aspectWidth: finiteNumber(camera.aspectWidth ?? camera.width, 16),
    aspectHeight: finiteNumber(camera.aspectHeight ?? camera.height, 9)
  };
}

function normalizeLight(light, index) {
  return {
    ...normalizeLightFields({
      ...light,
      transform: normalizeTransform(light),
      visibility: normalizeVisibility(light)
    }, index),
    customProperties: normalizeCustomModelProperties(modelCustomProperties(light))
  };
}

function normalizeMesh(mesh, index, options = {}) {
  const geometry = normalizeGeometry(mesh.geometry || {});
  return {
    name: mesh.name || `Mesh_${index + 1}`,
    parent: mesh.parent || null,
    transform: normalizeTransform(mesh),
    visibility: normalizeVisibility(mesh),
    customProperties: normalizeCustomModelProperties(modelCustomProperties(mesh)),
    geometry,
    skin: normalizeSkin(mesh.skin ?? mesh.skeleton, geometry),
    materialIndices: mesh.materialIndices || [],
    materials: normalizeMaterials(mesh.materials, options)
  };
}

function validateUniqueNames(items) {
  const names = new Set();
  for (const item of items) {
    if (names.has(item.name)) {
      throw new Error(`FBX export requires unique object names; duplicate '${item.name}'`);
    }
    names.add(item.name);
  }
}

function validateParents(items) {
  const names = new Set(items.map((item) => item.name));
  for (const item of items) {
    if (item.parent && !names.has(item.parent)) {
      throw new Error(`Object '${item.name}' references unknown parent '${item.parent}'`);
    }
  }
}

export function normalizeFbxScene(scene = {}, options = {}) {
  const nodes = (scene.nodes || scene.nulls || scene.groups || []).map(normalizeNode);
  const cameras = (scene.cameras || []).map(normalizeCamera);
  const lights = (scene.lights || []).map(normalizeLight);
  const meshes = (scene.meshes || scene.objects || []).map((mesh, index) => normalizeMesh(mesh, index, options));
  const sceneObjects = [...nodes, ...cameras, ...lights, ...meshes];
  if (!sceneObjects.length) {
    throw new Error("FBX export requires at least one scene object");
  }
  validateUniqueNames(sceneObjects);
  validateParents(sceneObjects);
  return {
    name: scene.name || "Scene",
    frameRate: finiteNumber(scene.frameRate, 30),
    nodes,
    cameras,
    lights,
    meshes,
    animations: normalizeAnimations(scene, nodes, meshes, cameras, lights, options)
  };
}
