import {
  attributeComponent,
  attributeCount,
  rawAttributeComponent
} from "./three-buffer-attribute.js";
import { threeModelCustomProperties } from "./three-model-custom-properties.js";
import { objectTransform } from "./three-transform-adapter.js";

function matrixElements(matrix) {
  if (!matrix) {
    return null;
  }
  const source = matrix.elements || (typeof matrix.toArray === "function" ? matrix.toArray() : matrix);
  return source ? Array.from(source) : null;
}

function fallbackBoneName(index) {
  return `Bone_${index + 1}`;
}

function boneNames(bones, exportedNames = new Map()) {
  return new Map(bones.map((bone, index) => [
    bone,
    exportedNames.get(bone) || bone.name || fallbackBoneName(index)
  ]));
}

function boneParentName(bone, names) {
  return bone.parent && names.has(bone.parent) ? names.get(bone.parent) : null;
}

function vertexCount(geometry) {
  const position = geometry.getAttribute?.("position") || geometry.attributes?.position;
  return attributeCount(position, 3);
}

function clustersFromGeometry(object, bones, names) {
  const geometry = object.geometry;
  const skinIndex = geometry.getAttribute?.("skinIndex") || geometry.attributes?.skinIndex;
  const skinWeight = geometry.getAttribute?.("skinWeight") || geometry.attributes?.skinWeight;
  if (!skinIndex || !skinWeight) {
    return [];
  }

  const byBone = new Map(bones.map((bone) => {
    const name = names.get(bone);
    return [name, { bone: name, indices: [], weights: [] }];
  }));
  const count = vertexCount(geometry);
  const itemSize = Math.min(skinIndex.itemSize || 4, skinWeight.itemSize || 4, 4);

  for (let vertex = 0; vertex < count; vertex += 1) {
    for (let component = 0; component < itemSize; component += 1) {
      const weight = attributeComponent(skinWeight, vertex, component);
      if (weight <= 0) {
        continue;
      }
      const boneIndex = rawAttributeComponent(skinIndex, vertex, component);
      const bone = bones[boneIndex];
      if (!bone) {
        continue;
      }
      const cluster = byBone.get(names.get(bone));
      cluster.indices.push(vertex);
      cluster.weights.push(weight);
    }
  }

  return Array.from(byBone.values());
}

export function skinFromThreeSkinnedMesh(object, options = {}) {
  const bones = object.skeleton?.bones || [];
  if (!object.isSkinnedMesh || !bones.length) {
    return null;
  }
  const names = boneNames(bones, options.boneNames);

  return {
    bones: bones.map((bone, index) => ({
      name: names.get(bone) || fallbackBoneName(index),
      sourceName: bone.name || null,
      sourceUuid: bone.uuid || null,
      parent: boneParentName(bone, names),
      size: bone.userData?.fbxSize ?? bone.userData?.size,
      transform: objectTransform(bone),
      customProperties: threeModelCustomProperties(bone),
      bindMatrix: matrixElements(bone.userData?.bindMatrix ?? bone.userData?.bindPoseMatrix),
      inverseBindMatrix: matrixElements(object.skeleton?.boneInverses?.[index] ?? bone.userData?.inverseBindMatrix)
    })),
    bindMatrix: matrixElements(object.bindMatrix),
    associateModelMatrix: matrixElements(object.userData?.associateModelMatrix ?? object.userData?.armatureMatrix),
    clusters: clustersFromGeometry(object, bones, names)
  };
}
