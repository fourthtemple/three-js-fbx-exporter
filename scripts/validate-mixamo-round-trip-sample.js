import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportMixamoCleanupFbx } from "../src/index.js";
import { deflateArrayBytes } from "../src/node-array-compressor.js";
import { checkerTga } from "./sample-texture.js";
import { validateFbxFileReport } from "./fbx-validation-report.js";
import {
  createMixamoRoundTripFixture,
  mixamoFixtureTextureResolver
} from "./mixamo-round-trip-fixture.js";

function includesAll(actual, expected) {
  for (const value of expected) {
    assert.ok(actual.includes(value), `${JSON.stringify(actual)} does not include ${value}`);
  }
}

function includesAllNameFragments(actual, expected) {
  for (const value of expected) {
    assert.ok(actual.some((candidate) => candidate.includes(value)), `${JSON.stringify(actual)} does not include name fragment ${value}`);
  }
}

function withoutNamespaceSeparators(names) {
  return names.map((name) => name.replace(/:/g, ""));
}

function assertHipsMotion(report, expectedRange) {
  const motions = report.fbxLoader.animations
    .map((animation) => animation.hipsMotion)
    .filter(Boolean);
  assert.ok(motions.length > 0, "expected at least one hips position track");
  assert.ok(motions.some((motion) => motion.rangeZ >= expectedRange * 0.9), JSON.stringify(motions));
}

function assertReportMatchesExpectations(report, expectations, { embedded }) {
  assert.equal(report.fbxLoader.skinnedMeshes, expectations.skinnedMeshes);
  includesAll(report.fbxLoader.bones, withoutNamespaceSeparators(expectations.bones));
  includesAll(report.fbxLoader.morphTargets, expectations.morphTargets);
  assert.ok(report.fbxLoader.materials >= expectations.materials);
  assert.ok(report.fbxLoader.textures >= 1);
  includesAll(report.fbxLoader.animations.map((animation) => animation.name), expectations.animations);
  assertHipsMotion(report, expectations.hipsTravelZ);

  assert.equal(report.blender.meshes, expectations.meshes);
  assert.equal(report.blender.armatures, 1);
  includesAll(report.blender.bones, expectations.bones);
  assert.ok(report.blender.materials >= expectations.materials);
  assert.ok(report.blender.images >= 1);
  assert.ok(report.blender.packedImages >= 1);
  includesAllNameFragments(report.blender.actions.map((action) => action.name), expectations.animations);
}

const compressed = process.argv.includes("--compressed");
const embedded = process.argv.some((value) => value === "--embed-textures" || value === "--embedded" || value === "--embed");
const tempDir = await mkdtemp(join(tmpdir(), "fbx-exporter-mixamo-"));
const fbxPath = join(tempDir, "mixamo-round-trip.fbx");
const fixture = createMixamoRoundTripFixture();
const warnings = [];

try {
  if (!embedded) {
    await writeFile(join(tempDir, "checker.tga"), checkerTga());
  }
  const bytes = exportMixamoCleanupFbx({
    object3D: fixture.root,
    animations: fixture.animations,
    frameRate: fixture.frameRate
  }, {
    warnings,
    embedTextures: embedded,
    ...(compressed ? { compressArrayBytes: deflateArrayBytes } : {}),
    ...(embedded ? { resolveTextureContent: mixamoFixtureTextureResolver } : {})
  });
  await writeFile(fbxPath, bytes);
  const report = await validateFbxFileReport(fbxPath);
  assertReportMatchesExpectations(report, fixture.expectations, { embedded });
  console.log(JSON.stringify({
    compressed,
    embedded,
    warnings,
    expectations: fixture.expectations,
    ...report
  }, null, 2));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
