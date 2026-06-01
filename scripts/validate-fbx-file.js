import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { validateFbxFileReport } from "./fbx-validation-report.js";

const inputPath = process.argv[2];

if (!inputPath) {
  throw new Error("Usage: npm run validate:file -- path/to/file.fbx");
}

const fbxPath = resolve(inputPath);

if (!existsSync(fbxPath)) {
  throw new Error(`FBX file not found: ${fbxPath}`);
}

console.log(JSON.stringify(await validateFbxFileReport(fbxPath, {
  allowTrailingBytes: true
}), null, 2));
