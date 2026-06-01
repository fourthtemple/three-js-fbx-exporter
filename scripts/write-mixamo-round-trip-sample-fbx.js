import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { exportMixamoCleanupFbx } from "../src/index.js";
import { deflateArrayBytes } from "../src/node-array-compressor.js";
import { checkerTga } from "./sample-texture.js";
import {
  createMixamoRoundTripFixture,
  mixamoFixtureTextureResolver
} from "./mixamo-round-trip-fixture.js";

function args() {
  const values = process.argv.slice(2);
  const compressed = values.includes("--compressed");
  const embedded = values.some((value) => value === "--embed-textures" || value === "--embedded" || value === "--embed");
  const output = values.find((value) => !value.startsWith("--"));
  return { compressed, embedded, output };
}

function defaultOutputPath({ compressed, embedded }) {
  if (embedded && compressed) {
    return "dist/mixamo-round-trip-embedded-compressed.fbx";
  }
  if (embedded) {
    return "dist/mixamo-round-trip-embedded.fbx";
  }
  return compressed ? "dist/mixamo-round-trip-compressed.fbx" : "dist/mixamo-round-trip.fbx";
}

const { compressed, embedded, output } = args();
const outputPath = resolve(output || defaultOutputPath({ compressed, embedded }));
const fixture = createMixamoRoundTripFixture();
await mkdir(dirname(outputPath), { recursive: true });
if (!embedded) {
  await writeFile(resolve(dirname(outputPath), "checker.tga"), checkerTga());
}
await writeFile(outputPath, exportMixamoCleanupFbx({
  object3D: fixture.root,
  animations: fixture.animations,
  frameRate: fixture.frameRate
}, {
  embedTextures: embedded,
  ...(compressed ? { compressArrayBytes: deflateArrayBytes } : {}),
  ...(embedded ? { resolveTextureContent: mixamoFixtureTextureResolver } : {})
}));
console.log(outputPath);
