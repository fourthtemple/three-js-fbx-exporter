import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
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
  "scene/scene.js",
  "scene/sample-scenes.js",
  "document/static-document.js"
]);

function isThreeAdapter(file) {
  return modulePath(file).startsWith("three/") && moduleName(file).startsWith("three-");
}

function isNormalizerOrValueModule(file) {
  const name = moduleName(file);
  return (
    name.endsWith("-normalizer.js") ||
    name === "animation-key-attributes.js" ||
    name === "animation-layer-settings.js" ||
    name === "animation-timing.js" ||
    name === "animation-track-config.js" ||
    name === "model-animation-keyframe-value.js" ||
    name === "scene-animation-keyframe-value.js" ||
    name === "material-animation-keyframe-value.js" ||
    name === "material-animation-track-config.js" ||
    name === "material-clipping.js" ||
    name === "texture-alpha.js" ||
    name === "texture-bmff-dimensions.js" ||
    name === "texture-content.js" ||
    name === "texture-cropping.js" ||
    name === "texture-custom-properties.js" ||
    name === "texture-dimensions.js" ||
    name === "texture-ebml-dimensions.js" ||
    name === "texture-layer-animation-track-config.js" ||
    name === "texture-layer-properties.js" ||
    name === "texture-ogg-dimensions.js" ||
    name === "texture-raw-image.js" ||
    name === "texture-transform.js" ||
    name === "texture-video.js" ||
    name === "transform-matrix.js" ||
    name === "value-normalizers.js"
  );
}

function moduleName(file) {
  return basename(file);
}

function modulePath(file) {
  return relative(SOURCE_DIR, file).replaceAll(sep, "/");
}

function isDocumentModule(file) {
  return DOCUMENT_MODULES.has(moduleName(file));
}

function isSerializationModule(file) {
  return isDocumentModule(file) || moduleName(file) === "binary-writer.js";
}

function isOrchestrator(file) {
  return ORCHESTRATORS.has(modulePath(file));
}

async function sourceFiles(dir = SOURCE_DIR) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await sourceFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function importedLocalFiles(source, file) {
  const imports = [];
  const importPattern = /\bfrom\s+["'](\.{1,2}\/[^"']+)["']/g;
  let match;
  while ((match = importPattern.exec(source))) {
    imports.push(resolve(dirname(file), match[1]));
  }
  return imports;
}

test("keeps production modules under the source line budget", async () => {
  const files = await sourceFiles();
  const oversized = [];

  for (const file of files) {
    const text = await readFile(file, "utf8");
    const lines = text.split("\n").length;
    if (lines > SOURCE_LINE_BUDGET) {
      oversized.push(`${modulePath(file)}: ${lines}`);
    }
  }

  assert.deepEqual(oversized, []);
});

test("keeps adapters, normalizers, and document writers in separate layers", async () => {
  const files = await sourceFiles();
  const violations = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const imports = importedLocalFiles(source, file);

    for (const imported of imports) {
      if (isDocumentModule(file) && isThreeAdapter(imported)) {
        violations.push(`${modulePath(file)} imports adapter ${modulePath(imported)}`);
      }

      if (moduleName(file) === "binary-writer.js") {
        violations.push(`${modulePath(file)} imports higher-level module ${modulePath(imported)}`);
      }

      if (isThreeAdapter(file) && isSerializationModule(imported)) {
        violations.push(`${modulePath(file)} imports serialization module ${modulePath(imported)}`);
      }

      if (
        isNormalizerOrValueModule(file) &&
        !isOrchestrator(file) &&
        (isSerializationModule(imported) || isThreeAdapter(imported))
      ) {
        violations.push(`${modulePath(file)} imports higher-level module ${modulePath(imported)}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});
