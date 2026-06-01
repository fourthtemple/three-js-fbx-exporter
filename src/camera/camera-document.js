import { FbxNode } from "../core/binary-writer.js";
import {
  addDoubleProperty,
  addIntProperty,
  addProperties70,
  fbxName,
  float64,
  int32,
  int64
} from "../core/fbx-values.js";
import { addModelTransformProperties } from "../model/model-document.js";

const MODEL_VERSION = 232;
const CAMERA_VERSION = 124;
// FBX camera distance properties are centimeters for Blender-compatible imports.
const DISTANCE_TO_FBX_CENTIMETERS = 100;

function parentId(record, parentModelIds, rootId) {
  if (!record.camera.parent) {
    return rootId;
  }
  const parent = parentModelIds.get(record.camera.parent);
  if (!parent) {
    throw new Error(`Camera parent was not exported: ${record.camera.parent}`);
  }
  return parent;
}

export function createCameraRecords(scene, nextId) {
  return (scene.cameras || []).map((camera) => ({
    camera,
    name: camera.name,
    ids: {
      model: nextId(),
      attribute: nextId()
    },
    transform: camera.transform,
    visibility: camera.visibility,
    customProperties: camera.customProperties
  }));
}

export function cameraDefinitionCounts(records) {
  return {
    models: records.length,
    nodeAttributes: records.length
  };
}

export function cameraParentMap(records) {
  return new Map(records.map((record) => [record.camera.name, record.ids.model]));
}

export function cameraTargets(records) {
  return records.map((record) => ({
    name: record.camera.name,
    ids: {
      model: record.ids.model,
      attribute: record.ids.attribute
    },
    transform: record.camera.transform,
    visibility: record.camera.visibility,
    customProperties: record.camera.customProperties,
    focalLength: record.camera.focalLength,
    focusDistance: record.camera.focusDistance,
    orthoZoom: record.camera.orthoZoom
  }));
}

function buildCameraAttribute(record) {
  const camera = record.camera;
  const node = new FbxNode("NodeAttribute", [
    int64(record.ids.attribute),
    fbxName("NodeAttribute", camera.name),
    "Camera"
  ]);
  node.add("TypeFlags", ["Camera"]);
  node.add("Version", [CAMERA_VERSION]);
  const properties = addProperties70(node);
  addIntProperty(properties, "CameraProjectionType", "enum", camera.projection === "orthographic" ? 1 : 0);
  addDoubleProperty(properties, "OrthoZoom", "Number", camera.orthoZoom ?? 1);
  addDoubleProperty(properties, "FieldOfView", "FieldOfView", camera.fov);
  addDoubleProperty(properties, "FieldOfViewX", "FieldOfView", camera.fov);
  addDoubleProperty(properties, "FieldOfViewY", "FieldOfView", camera.fov);
  if (camera.focalLength != null) {
    addDoubleProperty(properties, "FocalLength", "Number", camera.focalLength);
  }
  if (camera.focusDistance != null) {
    addDoubleProperty(properties, "FocusDistance", "Number", camera.focusDistance * DISTANCE_TO_FBX_CENTIMETERS);
  }
  addDoubleProperty(properties, "NearPlane", "Number", camera.near * 1000);
  addDoubleProperty(properties, "FarPlane", "Number", camera.far * 1000);
  addDoubleProperty(properties, "AspectWidth", "Number", camera.aspectWidth);
  addDoubleProperty(properties, "AspectHeight", "Number", camera.aspectHeight);
  node.add("CameraOrthoZoom", [float64(camera.orthoZoom ?? 1)]);
  return node;
}

function buildCameraModel(record) {
  const node = new FbxNode("Model", [int64(record.ids.model), fbxName("Model", record.camera.name), "Camera"]);
  node.add("Version", [MODEL_VERSION]);
  const properties = addProperties70(node);
  addModelTransformProperties(properties, record.camera.transform, {
    visibility: record.camera.visibility,
    customProperties: record.camera.customProperties
  });
  node.add("MultiLayer", [int32(0)]);
  node.add("MultiTake", [int32(0)]);
  node.add("Shading", ["Y"]);
  node.add("Culling", ["CullingOff"]);
  return node;
}

export function buildCameraObjects(records) {
  return records.flatMap((record) => [
    buildCameraAttribute(record),
    buildCameraModel(record)
  ]);
}

export function buildCameraConnections(connections, records, rootId, parentModelIds = new Map()) {
  for (const record of records) {
    connections.add("C", ["OO", int64(record.ids.model), int64(parentId(record, parentModelIds, rootId))]);
    connections.add("C", ["OO", int64(record.ids.attribute), int64(record.ids.model)]);
  }
}
