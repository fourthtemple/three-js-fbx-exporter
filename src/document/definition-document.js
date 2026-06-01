import { FbxNode } from "../core/binary-writer.js";
import { cameraDefinitionCounts } from "../camera/camera-document.js";
import { hierarchyDefinitionCounts } from "./hierarchy-document.js";
import { lightDefinitionCounts } from "../light/light-document.js";
import { meshDefinitionCounts } from "../geometry/mesh-document.js";
import { morphDefinitionCounts } from "../morph/morph-document.js";
import { skeletonDefinitionCounts } from "../skeleton/skeleton-document.js";
import { addDefinitionPropertyTemplate } from "./definition-templates.js";

function addObjectType(definitions, name, count) {
  const objectType = definitions.add("ObjectType", [name]);
  objectType.add("Count", [count]);
  addDefinitionPropertyTemplate(objectType, name);
  return objectType;
}

function animationDefinitionCounts(animationRecords) {
  return {
    stacks: animationRecords.length,
    layers: animationRecords.reduce((sum, record) => sum + record.layers.length, 0),
    curveNodes: animationRecords.reduce((sum, record) => {
      return sum + record.layers.reduce((layerSum, layer) => layerSum + layer.tracks.length, 0);
    }, 0),
    curves: animationRecords.reduce((sum, record) => {
      return sum + record.layers.reduce((layerSum, layer) => {
        return layerSum + layer.tracks.reduce((trackSum, track) => trackSum + track.curveIds.length, 0);
      }, 0);
    }, 0)
  };
}

export function buildDefinitions({
  hierarchyRecords,
  cameraRecords,
  lightRecords,
  meshRecords,
  morphRecords,
  skeletonRecords,
  animationRecords
}) {
  const hierarchyCounts = hierarchyDefinitionCounts(hierarchyRecords);
  const cameraCounts = cameraDefinitionCounts(cameraRecords);
  const lightCounts = lightDefinitionCounts(lightRecords);
  const meshCounts = meshDefinitionCounts(meshRecords);
  const morphCounts = morphDefinitionCounts(morphRecords);
  const skeletonCounts = skeletonDefinitionCounts(skeletonRecords);
  const modelCount = hierarchyCounts.models + cameraCounts.models + lightCounts.models + meshCounts.models + skeletonCounts.models;
  const nodeAttributeCount = hierarchyCounts.nodeAttributes + cameraCounts.nodeAttributes + lightCounts.nodeAttributes + skeletonCounts.nodeAttributes;
  const animationCounts = animationDefinitionCounts(animationRecords);
  const objectTypes = [
    ["GlobalSettings", 1],
    ["Model", modelCount],
    ["Geometry", meshCounts.geometries + morphCounts.geometries],
    ["Material", meshCounts.materials],
    ["Texture", meshCounts.textures],
    ["Video", meshCounts.textures],
    ["LayeredTexture", meshCounts.textureLayers],
    ["NodeAttribute", nodeAttributeCount],
    ["Pose", skeletonCounts.poses],
    ["Deformer", skeletonCounts.deformers + morphCounts.deformers],
    ["AnimationStack", animationCounts.stacks],
    ["AnimationLayer", animationCounts.layers],
    ["AnimationCurveNode", animationCounts.curveNodes],
    ["AnimationCurve", animationCounts.curves]
  ].filter(([, count]) => count > 0);

  const definitions = new FbxNode("Definitions");
  definitions.add("Version", [100]);
  definitions.add("Count", [objectTypes.length]);
  for (const [name, count] of objectTypes) {
    addObjectType(definitions, name, count);
  }
  return definitions;
}
