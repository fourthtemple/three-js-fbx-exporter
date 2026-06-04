import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createCharacterExportOptions,
  exportCharacterFbx,
  fromThreeObject,
  normalizeFbxScene
} from "../src/index.js";
import { fbxLoaderReport } from "../scripts/fbx-validation-report.js";
import {
  createMixamoRoundTripFixture,
  mixamoFixtureTextureResolver
} from "../scripts/mixamo-round-trip-fixture.js";

function includesAll(actual, expected) {
  for (const value of expected) {
    assert.ok(actual.includes(value), `${JSON.stringify(actual)} does not include ${value}`);
  }
}

function withoutNamespaceSeparators(names) {
  return names.map((name) => name.replace(/:/g, ""));
}

test("provides character export defaults for editor handoff", () => {
  const options = createCharacterExportOptions({ frameRate: 24 });

  assert.equal(options.bakeAnimations, true);
  assert.equal(options.embedTextures, true);
  assert.equal(options.frameRate, 24);
  assert.equal(options.textureTransformMode, "blender");
  assert.deepEqual(options.warnings, []);
});

test("adapts a Mixamo-style edited character fixture into the internal scene model", () => {
  const fixture = createMixamoRoundTripFixture();
  const scene = normalizeFbxScene(fromThreeObject(fixture.root, createCharacterExportOptions({
    animations: fixture.animations,
    frameRate: fixture.frameRate
  })));
  const mesh = scene.meshes[0];
  const hipsTrack = scene.animations[0].tracks.find((track) => {
    return track.target === "mixamorig:Hips" && track.property === "translation";
  });

  assert.equal(scene.frameRate, 30);
  assert.equal(scene.meshes.length, 1);
  assert.deepEqual(mesh.skin.bones.map((bone) => bone.name), fixture.expectations.bones);
  assert.equal(mesh.materials.length, fixture.expectations.materials);
  assert.deepEqual(mesh.geometry.morphTargets.map((target) => target.name), fixture.expectations.morphTargets);
  assert.deepEqual(scene.animations.map((animation) => animation.name), fixture.expectations.animations);
  assert.ok(hipsTrack);
  assert.ok(Math.abs(hipsTrack.keyframes.at(-1).value[2] - fixture.expectations.hipsTravelZ) < 1e-5);
  assert.ok(scene.animations[0].tracks.some((track) => {
    return track.target === "MixamoCatMesh" && track.property === "morph";
  }));
});

test("emits structured warnings when editor-default embedding lacks file bytes", () => {
  const fixture = createMixamoRoundTripFixture();
  const warnings = [];
  const bytes = exportCharacterFbx({
    object3D: fixture.root,
    animations: fixture.animations,
    frameRate: fixture.frameRate
  }, { warnings });

  assert.ok(bytes instanceof Uint8Array);
  assert.ok(warnings.some((warning) => {
    return warning.code === "texture.embed.unresolved" && warning.fileName === "checker.tga";
  }));
});

test("Three.js FBXLoader parses the Mixamo round-trip fixture with skeleton, morphs, and hips travel", async () => {
  const fixture = createMixamoRoundTripFixture();
  const bytes = exportCharacterFbx({
    object3D: fixture.root,
    animations: fixture.animations,
    frameRate: fixture.frameRate
  }, {
    resolveTextureContent: mixamoFixtureTextureResolver
  });
  const report = await fbxLoaderReport(bytes);
  const animationNames = report.animations.map((animation) => animation.name);
  const hipsMotions = report.animations.map((animation) => animation.hipsMotion).filter(Boolean);

  assert.equal(report.skinnedMeshes, fixture.expectations.skinnedMeshes);
  includesAll(report.bones, withoutNamespaceSeparators(fixture.expectations.bones));
  includesAll(report.morphTargets, fixture.expectations.morphTargets);
  includesAll(animationNames, fixture.expectations.animations);
  assert.ok(report.hasSkinIndex);
  assert.ok(report.hasSkinWeight);
  assert.ok(report.materials >= fixture.expectations.materials);
  assert.ok(report.textures >= 1);
  assert.ok(hipsMotions.some((motion) => motion.rangeZ >= fixture.expectations.hipsTravelZ * 0.9));
});
