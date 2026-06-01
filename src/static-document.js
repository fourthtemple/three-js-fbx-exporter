import { FbxBinaryWriter } from "./binary-writer.js";
import { makeIdFactory } from "./fbx-values.js";
import { normalizeFbxScene } from "./scene.js";
import {
  buildTakes,
  createAnimationRecords
} from "./animation-document.js";
import {
  cameraTargets,
  createCameraRecords
} from "./camera-document.js";
import {
  createHierarchyRecords,
  hierarchyTargets
} from "./hierarchy-document.js";
import {
  createLightRecords,
  lightTargets
} from "./light-document.js";
import {
  createMeshRecords,
  materialTargets,
  textureLayerTargets,
  textureTargets
} from "./mesh-document.js";
import {
  createMorphRecords,
  morphTargets
} from "./morph-document.js";
import {
  createSkeletonRecords,
  skeletonTargets
} from "./skeleton-document.js";
import {
  ROOT_ID,
  buildDocuments,
  buildFileMetadata,
  buildGlobalSettings,
  buildHeader,
  buildReferences
} from "./document-sections.js";
import { buildDefinitions } from "./definition-document.js";
import { buildConnections, buildObjects } from "./object-document.js";
import { buildRelations } from "./relation-document.js";

export function createStaticMeshFbxDocument(source, options = {}) {
  const scene = normalizeFbxScene(source, options);
  const nextId = makeIdFactory();
  const hierarchyRecords = createHierarchyRecords(scene, nextId);
  const cameraRecords = createCameraRecords(scene, nextId);
  const lightRecords = createLightRecords(scene, nextId);
  const meshRecords = createMeshRecords(scene, nextId);
  const morphRecords = createMorphRecords(meshRecords, nextId);
  const skeletonRecords = createSkeletonRecords(meshRecords, nextId);
  const animationTargets = [
    ...hierarchyTargets(hierarchyRecords),
    ...cameraTargets(cameraRecords),
    ...lightTargets(lightRecords),
    ...meshRecords,
    ...materialTargets(meshRecords),
    ...textureTargets(meshRecords),
    ...textureLayerTargets(meshRecords),
    ...morphTargets(morphRecords),
    ...skeletonTargets(skeletonRecords)
  ];
  const animationRecords = createAnimationRecords(scene, animationTargets, nextId);
  const records = {
    hierarchyRecords,
    cameraRecords,
    lightRecords,
    meshRecords,
    morphRecords,
    skeletonRecords,
    animationRecords
  };
  return [
    buildHeader(options),
    ...buildFileMetadata(options),
    buildGlobalSettings(scene),
    buildDocuments(scene),
    buildReferences(),
    buildDefinitions(records),
    buildObjects(records),
    buildRelations(records),
    buildConnections(records, ROOT_ID),
    buildTakes(animationRecords)
  ];
}

export function writeStaticMeshFbx(source, options = {}) {
  const writer = new FbxBinaryWriter(options);
  return writer.writeDocument(createStaticMeshFbxDocument(source, options));
}
