import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createCubeScene, exportFbx } from "../src/index.js";
import { deflateArrayBytes } from "../src/node/node-array-compressor.js";

function checkerTga() {
  return Uint8Array.from([
    0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    2, 0, 2, 0, 24, 0,
    255, 255, 255, 0, 0, 0,
    0, 0, 0, 255, 255, 255
  ]);
}

function args() {
  const values = process.argv.slice(2);
  const compressed = values.includes("--compressed");
  const output = values.find((value) => value !== "--compressed");
  return { compressed, output };
}

const { compressed, output } = args();
const outputPath = resolve(output || (compressed ? "dist/feature-sample-compressed.fbx" : "dist/feature-sample.fbx"));
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(resolve(dirname(outputPath), "checker.tga"), checkerTga());
await writeFile(outputPath, exportFbx(createCubeScene({ animated: true, textured: true }), compressed
  ? { compressArrayBytes: deflateArrayBytes }
  : {}));
console.log(outputPath);
