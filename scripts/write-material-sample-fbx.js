import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createMaterialScene, exportFbx } from "../src/index.js";

const outputPath = resolve(process.argv[2] || "dist/material-sample.fbx");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, exportFbx(createMaterialScene()));
console.log(outputPath);
