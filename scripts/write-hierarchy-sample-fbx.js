import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHierarchyScene, exportFbx } from "../src/index.js";

const outputPath = resolve(process.argv[2] || "dist/hierarchy-sample.fbx");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, exportFbx(createHierarchyScene()));
console.log(outputPath);
