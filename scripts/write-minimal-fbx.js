import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { writeMinimalFbx } from "../src/index.js";

const outputPath = resolve(process.argv[2] || "dist/minimal.fbx");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, writeMinimalFbx());
console.log(outputPath);
