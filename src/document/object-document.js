import { FbxNode } from "../core/binary-writer.js";
import { buildAnimationConnections, buildAnimationObjects } from "../animation/animation-document.js";
import { buildCameraConnections, buildCameraObjects, cameraParentMap } from "../camera/camera-document.js";
import {
  buildHierarchyConnections,
  buildHierarchyObjects,
  hierarchyParentMap
} from "./hierarchy-document.js";
import { buildLightConnections, buildLightObjects, lightParentMap } from "../light/light-document.js";
import { buildMeshConnections, buildMeshObjects, meshParentMap } from "../geometry/mesh-document.js";
import { buildMorphConnections, buildMorphObjects } from "../morph/morph-document.js";
import { buildSkeletonConnections, buildSkeletonObjects } from "../skeleton/skeleton-document.js";

function modelParentMap(hierarchyRecords, cameraRecords, lightRecords, meshRecords) {
  return new Map([
    ...hierarchyParentMap(hierarchyRecords),
    ...cameraParentMap(cameraRecords),
    ...lightParentMap(lightRecords),
    ...meshParentMap(meshRecords)
  ]);
}

export function buildObjects({
  hierarchyRecords,
  cameraRecords,
  lightRecords,
  meshRecords,
  morphRecords,
  skeletonRecords,
  animationRecords
}) {
  const objects = new FbxNode("Objects");
  objects.children.push(...buildHierarchyObjects(hierarchyRecords));
  objects.children.push(...buildCameraObjects(cameraRecords));
  objects.children.push(...buildLightObjects(lightRecords));
  objects.children.push(...buildMeshObjects(meshRecords));
  objects.children.push(...buildMorphObjects(morphRecords));
  objects.children.push(...buildSkeletonObjects(skeletonRecords));
  objects.children.push(...buildAnimationObjects(animationRecords));
  return objects;
}

export function buildConnections({
  hierarchyRecords,
  cameraRecords,
  lightRecords,
  meshRecords,
  morphRecords,
  skeletonRecords,
  animationRecords
}, rootId) {
  const connections = new FbxNode("Connections");
  const parentModelIds = modelParentMap(hierarchyRecords, cameraRecords, lightRecords, meshRecords);
  buildHierarchyConnections(connections, hierarchyRecords, rootId, parentModelIds);
  buildCameraConnections(connections, cameraRecords, rootId, parentModelIds);
  buildLightConnections(connections, lightRecords, rootId, parentModelIds);
  buildMeshConnections(connections, meshRecords, rootId, parentModelIds);
  buildMorphConnections(connections, morphRecords);
  buildSkeletonConnections(connections, skeletonRecords);
  buildAnimationConnections(connections, animationRecords);
  return connections;
}
