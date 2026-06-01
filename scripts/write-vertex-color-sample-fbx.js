import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createVertexColorScene, exportFbx } from "../src/index.js";

const outputPath = resolve(process.argv[2] || "dist/vertex-color-sample.fbx");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, exportFbx(createVertexColorScene()));
console.log(outputPath);
