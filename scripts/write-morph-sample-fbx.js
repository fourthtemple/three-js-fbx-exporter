import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createMorphScene, exportFbx } from "../src/index.js";

const outputPath = resolve(process.argv[2] || "dist/morph-sample.fbx");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, exportFbx(createMorphScene()));
console.log(outputPath);
