import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createCubeScene, exportFbx } from "../src/index.js";

const outputPath = resolve(process.argv[2] || "dist/static-mesh.fbx");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, exportFbx(createCubeScene()));
console.log(outputPath);
