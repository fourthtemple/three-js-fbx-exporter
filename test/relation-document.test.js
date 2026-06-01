import assert from "node:assert/strict";
import { test } from "node:test";
import { createSkinnedCubeScene, createStaticMeshFbxDocument } from "../src/index.js";
import { checkerTga } from "./fbx-test-helpers.js";

function nodeByName(document, name) {
  return document.find((node) => node.name === name);
}

function childCounts(node) {
  const counts = new Map();
  for (const child of node.children) {
    counts.set(child.name, (counts.get(child.name) || 0) + 1);
  }
  return counts;
}

function childWith(node, name, predicate) {
  return node.children.find((child) => child.name === name && predicate(child));
}

function relationStressScene() {
  const scene = createSkinnedCubeScene({ animated: true, textured: true });
  const mesh = scene.meshes[0];
  const material = mesh.materials[0];
  material.textures.push({
    ...material.textures[0],
    name: "DetailTexture",
    fileName: "detail.tga",
    relativeFileName: "detail.tga",
    content: checkerTga()
  });
  mesh.geometry.morphTargets = [
    {
      name: "Puff",
      indices: [2, 3],
      vertices: [0, 0, 0.25, 0, 0, 0.25],
      weight: 0.5
    }
  ];
  scene.animations[0].tracks.push(
    {
      target: material.name,
      property: "opacity",
      keyframes: [
        { frame: 0, value: 1 },
        { frame: 30, value: 0.5 }
      ]
    },
    {
      target: mesh.name,
      property: "morph",
      morphTarget: "Puff",
      keyframes: [
        { frame: 0, value: 0 },
        { frame: 30, value: 1 }
      ]
    }
  );
  return scene;
}

test("Relations section mirrors emitted object records", () => {
  const document = createStaticMeshFbxDocument(relationStressScene());
  const objects = nodeByName(document, "Objects");
  const relations = nodeByName(document, "Relations");
  const connections = nodeByName(document, "Connections");

  assert.ok(relations);
  assert.ok(document.indexOf(objects) < document.indexOf(relations));
  assert.ok(document.indexOf(relations) < document.indexOf(connections));
  assert.deepEqual(childCounts(relations), childCounts(objects));
});

test("Relations section labels texture, animation, skin, and morph classes", () => {
  const relations = nodeByName(createStaticMeshFbxDocument(relationStressScene()), "Relations");

  assert.ok(childWith(relations, "Model", (node) => node.properties[0].includes("SkinnedCube") && node.properties[1] === "Mesh"));
  assert.ok(childWith(relations, "Texture", (node) => node.properties[0].includes("checker")));
  assert.ok(childWith(relations, "Video", (node) => node.properties[0].includes("checker") && node.properties[1] === "Clip"));
  assert.ok(childWith(relations, "LayeredTexture", (node) => node.properties[0].includes("DiffuseColorLayer")));
  assert.ok(childWith(relations, "AnimationStack", (node) => node.properties[0].includes("BoneBend")));
  assert.ok(childWith(relations, "AnimationCurveNode", (node) => node.properties[0].includes("Opacity")));
  assert.ok(childWith(relations, "Deformer", (node) => node.properties[0].includes("SkinnedCubeSkin") && node.properties[1] === "Skin"));
  assert.ok(childWith(relations, "Deformer", (node) => node.properties[0].includes("Puff") && node.properties[1] === "BlendShapeChannel"));
  assert.ok(childWith(relations, "Geometry", (node) => node.properties[0].includes("Puff") && node.properties[1] === "Shape"));
});
