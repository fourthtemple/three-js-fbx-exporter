import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { test } from "node:test";

const SOURCE_LINE_BUDGET = 600;
const SOURCE_DIR = fileURLToPath(new URL("../src/", import.meta.url));

const DOCUMENT_MODULES = new Set([
  "animation-document.js",
  "camera-document.js",
  "definition-document.js",
  "definition-templates.js",
  "document-sections.js",
  "hierarchy-document.js",
  "light-document.js",
  "mesh-document.js",
  "minimal-document.js",
  "model-document.js",
  "morph-document.js",
  "object-document.js",
  "relation-document.js",
  "skeleton-document.js",
  "static-document.js",
  "texture-document.js",
  "texture-layer-document.js"
]);

const SERIALIZATION_MODULES = new Set([
  ...DOCUMENT_MODULES,
  "binary-writer.js"
]);

const ORCHESTRATORS = new Set([
  "index.js",
  "scene.js",
  "sample-scenes.js",
  "static-document.js"
]);

function isThreeAdapter(file) {
  return file.startsWith("three-");
}

function isNormalizerOrValueModule(file) {
  return (
    file.endsWith("-normalizer.js") ||
    file === "animation-key-attributes.js" ||
    file === "animation-layer-settings.js" ||
    file === "animation-timing.js" ||
    file === "animation-track-config.js" ||
    file === "model-animation-keyframe-value.js" ||
    file === "scene-animation-keyframe-value.js" ||
    file === "material-animation-keyframe-value.js" ||
    file === "material-animation-track-config.js" ||
    file === "material-clipping.js" ||
    file === "texture-alpha.js" ||
    file === "texture-bmff-dimensions.js" ||
    file === "texture-content.js" ||
    file === "texture-cropping.js" ||
    file === "texture-custom-properties.js" ||
    file === "texture-dimensions.js" ||
    file === "texture-ebml-dimensions.js" ||
    file === "texture-layer-animation-track-config.js" ||
    file === "texture-layer-properties.js" ||
    file === "texture-ogg-dimensions.js" ||
    file === "texture-raw-image.js" ||
    file === "texture-transform.js" ||
    file === "texture-video.js" ||
    file === "transform-matrix.js" ||
    file === "value-normalizers.js"
  );
}

function importedLocalFiles(source) {
  const imports = [];
  const importPattern = /\bfrom\s+["']\.\/([^"']+)["']/g;
  let match;
  while ((match = importPattern.exec(source))) {
    imports.push(match[1]);
  }
  return imports;
}

test("keeps production modules under the source line budget", async () => {
  const files = (await readdir(SOURCE_DIR))
    .filter((file) => file.endsWith(".js"))
    .sort();
  const oversized = [];

  for (const file of files) {
    const text = await readFile(join(SOURCE_DIR, file), "utf8");
    const lines = text.split("\n").length;
    if (lines > SOURCE_LINE_BUDGET) {
      oversized.push(`${file}: ${lines}`);
    }
  }

  assert.deepEqual(oversized, []);
});

test("keeps adapters, normalizers, and document writers in separate layers", async () => {
  const files = (await readdir(SOURCE_DIR))
    .filter((file) => file.endsWith(".js"))
    .sort();
  const violations = [];

  for (const file of files) {
    const source = await readFile(join(SOURCE_DIR, file), "utf8");
    const imports = importedLocalFiles(source);

    for (const imported of imports) {
      if (DOCUMENT_MODULES.has(file) && isThreeAdapter(imported)) {
        violations.push(`${file} imports adapter ${imported}`);
      }

      if (file === "binary-writer.js") {
        violations.push(`${file} imports higher-level module ${imported}`);
      }

      if (isThreeAdapter(file) && SERIALIZATION_MODULES.has(imported)) {
        violations.push(`${file} imports serialization module ${imported}`);
      }

      if (
        isNormalizerOrValueModule(file) &&
        !ORCHESTRATORS.has(file) &&
        (SERIALIZATION_MODULES.has(imported) || isThreeAdapter(imported))
      ) {
        violations.push(`${file} imports higher-level module ${imported}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});
