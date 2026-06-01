import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createSkinnedCubeScene, exportFbx } from "../src/index.js";
import { deflateArrayBytes } from "../src/node-array-compressor.js";
import { checkerTextureResolver, checkerTga } from "./sample-texture.js";

function args() {
  const values = process.argv.slice(2);
  const compressed = values.includes("--compressed");
  const embedded = values.some((value) => value === "--embed-textures" || value === "--embedded" || value === "--embed");
  const output = values.find((value) => !value.startsWith("--"));
  return { compressed, embedded, output };
}

function defaultOutputPath({ compressed, embedded }) {
  if (embedded && compressed) {
    return "dist/skinned-sample-embedded-compressed.fbx";
  }
  if (embedded) {
    return "dist/skinned-sample-embedded.fbx";
  }
  return compressed ? "dist/skinned-sample-compressed.fbx" : "dist/skinned-sample.fbx";
}

function exportOptions({ compressed, embedded }) {
  return {
    ...(compressed ? { compressArrayBytes: deflateArrayBytes } : {}),
    ...(embedded ? { resolveTextureContent: checkerTextureResolver } : {})
  };
}

const { compressed, embedded, output } = args();
const outputPath = resolve(output || defaultOutputPath({ compressed, embedded }));
await mkdir(dirname(outputPath), { recursive: true });
if (!embedded) {
  await writeFile(resolve(dirname(outputPath), "checker.tga"), checkerTga());
}
await writeFile(outputPath, exportFbx(createSkinnedCubeScene({ animated: true, textured: true }), exportOptions({ compressed, embedded })));
console.log(outputPath);
