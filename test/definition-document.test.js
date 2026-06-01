import assert from "node:assert/strict";
import { test } from "node:test";
import { createSkinnedCubeScene, createStaticMeshFbxDocument } from "../src/index.js";
import { checkerTga } from "./fbx-test-helpers.js";

function findChild(node, name) {
  return node.children.find((child) => child.name === name);
}

function nodeByName(document, name) {
  return document.find((node) => node.name === name);
}

function objectTypeCounts(definitions) {
  return new Map(definitions.children
    .filter((child) => child.name === "ObjectType")
    .map((child) => {
      const count = findChild(child, "Count")?.properties[0] ?? 0;
      return [child.properties[0], count];
    }));
}

function emittedObjectCounts(objects) {
  const counts = new Map();
  for (const child of objects.children) {
    counts.set(child.name, (counts.get(child.name) || 0) + 1);
  }
  return counts;
}

function objectType(definitions, name) {
  return definitions.children.find((child) => child.name === "ObjectType" && child.properties[0] === name);
}

function propertyTemplate(definitions, objectTypeName) {
  return findChild(objectType(definitions, objectTypeName), "PropertyTemplate");
}

function propertyValue(properties, name) {
  const property = properties.children.find((child) => child.name === "P" && child.properties[0] === name);
  const values = property?.properties.slice(4).map((value) => value?.value ?? value);
  return values?.length === 1 ? values[0] : values;
}

function definitionStressScene() {
  const scene = createSkinnedCubeScene({ animated: true, textured: true });
  const mesh = scene.meshes[0];
  const material = mesh.materials[0];
  const baseTexture = material.textures[0];
  material.textures.push({
    ...baseTexture,
    name: "DetailTexture",
    fileName: "detail.tga",
    relativeFileName: "detail.tga",
    content: checkerTga(),
    alpha: 0.5,
    blendMode: 2
  });
  mesh.geometry.morphTargets = [
    {
      name: "Puff",
      indices: [2, 3],
      vertices: [0, 0, 0.25, 0, 0, 0.25],
      normals: [0, 0, 1, 0, 0, 1],
      weight: 0.25
    }
  ];
  scene.animations[0].tracks.push(
    {
      target: mesh.name,
      property: "morph",
      morphTarget: "Puff",
      keyframes: [
        { frame: 0, value: 0.25 },
        { frame: 30, value: 0.75 }
      ]
    },
    {
      target: material.name,
      property: "opacity",
      keyframes: [
        { frame: 0, value: 1 },
        { frame: 30, value: 0.4 }
      ]
    },
    {
      target: baseTexture.name,
      property: "textureAlpha",
      keyframes: [
        { frame: 0, value: 1 },
        { frame: 30, value: 0.25 }
      ]
    }
  );
  return scene;
}

test("Definitions counts match emitted object types for animation and texture heavy scenes", () => {
  const document = createStaticMeshFbxDocument(definitionStressScene());
  const definitions = nodeByName(document, "Definitions");
  const objects = nodeByName(document, "Objects");
  const definedCounts = objectTypeCounts(definitions);
  const objectCounts = emittedObjectCounts(objects);
  const declaredTypeCount = findChild(definitions, "Count").properties[0];

  assert.equal(declaredTypeCount, definedCounts.size);
  assert.equal(definedCounts.get("GlobalSettings"), 1);
  for (const [type, count] of definedCounts) {
    if (type === "GlobalSettings") {
      continue;
    }
    assert.equal(count, objectCounts.get(type) || 0, `${type} definition count`);
  }
});

test("Definitions include property templates for exported object types", () => {
  const definitions = nodeByName(createStaticMeshFbxDocument(definitionStressScene()), "Definitions");
  const expectedTemplates = new Map([
    ["Model", "FbxNode"],
    ["Geometry", "FbxMesh"],
    ["Material", "FbxSurfacePhong"],
    ["Texture", "FbxFileTexture"],
    ["Video", "FbxVideo"],
    ["LayeredTexture", "FbxLayeredTexture"],
    ["NodeAttribute", "FbxNodeAttribute"],
    ["Pose", "FbxPose"],
    ["Deformer", "FbxDeformer"],
    ["AnimationStack", "FbxAnimStack"],
    ["AnimationLayer", "FbxAnimLayer"],
    ["AnimationCurveNode", "FbxAnimCurveNode"],
    ["AnimationCurve", "FbxAnimCurve"]
  ]);

  for (const [typeName, templateName] of expectedTemplates) {
    const template = propertyTemplate(definitions, typeName);
    assert.equal(template?.properties[0], templateName);
    assert.ok(findChild(template, "Properties70"), `${typeName} template properties`);
  }

  assert.deepEqual(propertyValue(findChild(propertyTemplate(definitions, "Model"), "Properties70"), "Lcl Scaling"), [1, 1, 1]);
  assert.deepEqual(propertyValue(findChild(propertyTemplate(definitions, "Material"), "Properties70"), "DiffuseColor"), [0.8, 0.8, 0.8]);
  assert.equal(propertyValue(findChild(propertyTemplate(definitions, "Texture"), "Properties70"), "WrapModeU"), 1);
  assert.equal(propertyValue(findChild(propertyTemplate(definitions, "Video"), "Properties70"), "AccessMode"), 0);
  assert.equal(propertyValue(findChild(propertyTemplate(definitions, "AnimationLayer"), "Properties70"), "Weight"), 100);
  assert.equal(propertyValue(findChild(propertyTemplate(definitions, "AnimationCurveNode"), "Properties70"), "d|X"), 0);
});
