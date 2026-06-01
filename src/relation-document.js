import { FbxNode } from "./binary-writer.js";
import { fbxName } from "./fbx-values.js";

function addRelation(relations, nodeType, fbxType, name, className = "") {
  relations.add(nodeType, [fbxName(fbxType, name), className]);
}

function textureName(material, texture) {
  return texture.name || `${material.name}${texture.label || "Texture"}`;
}

function addHierarchyRelations(relations, records) {
  for (const record of records) {
    addRelation(relations, "NodeAttribute", "NodeAttribute", record.node.name, "Null");
    addRelation(relations, "Model", "Model", record.node.name, "Null");
  }
}

function addCameraRelations(relations, records) {
  for (const record of records) {
    addRelation(relations, "NodeAttribute", "NodeAttribute", record.camera.name, "Camera");
    addRelation(relations, "Model", "Model", record.camera.name, "Camera");
  }
}

function addLightRelations(relations, records) {
  for (const record of records) {
    addRelation(relations, "NodeAttribute", "NodeAttribute", record.light.name, "Light");
    addRelation(relations, "Model", "Model", record.light.name, "Light");
  }
}

function addMeshRelations(relations, records) {
  for (const record of records) {
    addRelation(relations, "Geometry", "Geometry", `${record.mesh.name}Geometry`, "Mesh");
    addRelation(relations, "Model", "Model", record.mesh.name, "Mesh");
    for (const materialRecord of record.materials) {
      addRelation(relations, "Material", "Material", materialRecord.material.name);
      for (const textureRecord of materialRecord.textures) {
        const name = textureName(materialRecord.material, textureRecord.texture);
        addRelation(relations, "Texture", "Texture", name);
        addRelation(relations, "Video", "Video", name, "Clip");
      }
      for (const layerRecord of materialRecord.layers || []) {
        addRelation(relations, "LayeredTexture", "LayeredTexture", layerRecord.name);
      }
    }
  }
}

function addMorphRelations(relations, records) {
  for (const record of records) {
    addRelation(relations, "Deformer", "Deformer", `${record.mesh.name}BlendShape`, "BlendShape");
    for (const targetRecord of record.morphTargets) {
      addRelation(relations, "Deformer", "SubDeformer", targetRecord.target.name, "BlendShapeChannel");
      addRelation(relations, "Geometry", "Geometry", targetRecord.target.name, "Shape");
    }
  }
}

function addSkeletonRelations(relations, skeletonSet) {
  for (const boneRecord of skeletonSet.bones) {
    addRelation(relations, "NodeAttribute", "NodeAttribute", boneRecord.bone.name, "LimbNode");
    addRelation(relations, "Model", "Model", boneRecord.bone.name, "LimbNode");
  }
  for (const record of skeletonSet.records) {
    addRelation(relations, "Pose", "Pose", `${record.mesh.name}BindPose`, "BindPose");
    addRelation(relations, "Deformer", "Deformer", `${record.mesh.name}Skin`, "Skin");
    for (const boneRecord of record.bones) {
      addRelation(relations, "Deformer", "SubDeformer", boneRecord.bone.name, "Cluster");
    }
  }
}

function addAnimationRelations(relations, records) {
  for (const record of records) {
    addRelation(relations, "AnimationStack", "AnimStack", record.clip.name);
    for (const layer of record.layers) {
      addRelation(relations, "AnimationLayer", "AnimLayer", layer.settings.name);
      for (const track of layer.tracks) {
        addRelation(relations, "AnimationCurveNode", "AnimCurveNode", track.config.group);
        for (let index = 0; index < track.curveIds.length; index += 1) {
          addRelation(relations, "AnimationCurve", "AnimCurve", "");
        }
      }
    }
  }
}

export function buildRelations({
  hierarchyRecords,
  cameraRecords,
  lightRecords,
  meshRecords,
  morphRecords,
  skeletonRecords,
  animationRecords
}) {
  const relations = new FbxNode("Relations");
  addHierarchyRelations(relations, hierarchyRecords);
  addCameraRelations(relations, cameraRecords);
  addLightRelations(relations, lightRecords);
  addMeshRelations(relations, meshRecords);
  addMorphRelations(relations, morphRecords);
  addSkeletonRelations(relations, skeletonRecords);
  addAnimationRelations(relations, animationRecords);
  return relations;
}
