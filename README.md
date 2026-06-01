# FBX Exporter

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![FBX](https://img.shields.io/badge/FBX-binary%207400%20%2F%207500-444.svg)](#fbx-exporter)
[![Target](https://img.shields.io/badge/target-Three.js%20%2B%20Blender%20%2B%20Mixamo-0b7285.svg)](#validation)

A from-scratch, MIT-friendly binary FBX exporter for Three.js-oriented character pipelines.

The first production target is **Mixamo Cleanup round trip**: export an edited Three.js character scene to FBX while preserving the mesh, skeleton, skinning, morphs, materials, textures, and baked animation curves well enough to import cleanly in Blender and Three.js `FBXLoader`.

## Why This Exists

FBX export is awkward in browser and Node projects. Blender's exporter is useful as a behavioral reference, but its GPL source cannot be copied into an MIT project. Autodesk's SDK is not browser-friendly. This project keeps the implementation original, modular, and testable.

The exporter is currently source-first rather than npm-published. It is meant to be integrated directly into Mixamo Cleanup, then hardened against real-world character files.

## Current Status

| Area | Status |
| --- | --- |
| Binary FBX writer | Deterministic FBX 7400 by default, FBX 7500 wide records supported |
| Static mesh export | Geometry, normals, tangents/binormals, UV sets, vertex colors, material slots |
| Hierarchy | Meshes, nulls, cameras, lights, transforms, pivots, visibility |
| Materials | Lambert/Phong-style output with PBR-to-FBX adaptation and custom lanes |
| Textures | Sidecar files, data URLs, raw image buffers, embedded `Video.Content`, metadata |
| Skinning | Limb nodes, skin deformers, clusters, bind poses, inverse bind matrices |
| Morphs | Blend shape geometry and morph influence animation |
| Animation | Multiple stacks/layers, baked TRS/bone/morph/material/texture curves, key tangents |
| Validation | Binary preflight, Three.js `FBXLoader`, Blender background import reports |
| Mixamo workflow | Editor-facing adapter and Mixamo-style fixture are in place |

## Quickstart

```js
import { exportFbx } from "./src/index.js";

const bytes = exportFbx(threeSceneOrObject);
```

Save the returned `Uint8Array` as a binary `.fbx` file.

```js
import { writeFileSync } from "node:fs";
import { exportFbx } from "./src/index.js";

writeFileSync("character.fbx", exportFbx(scene));
```

## Mixamo Cleanup Export

Use the editor-facing adapter when exporting from Mixamo Cleanup. The editor should hand over the final Three.js object tree plus baked clips; the exporter should not know about timeline UI internals.

```js
import { exportMixamoCleanupFbx } from "./src/index.js";

const bytes = exportMixamoCleanupFbx({
  object3D: characterRoot,
  animations: bakedClips,
  frameRate: timelineFrameRate
}, {
  resolveTextureContent,
  onWarning: (warning) => console.warn(warning)
});
```

`exportMixamoCleanupFbx` defaults to:

| Option | Default | Purpose |
| --- | --- | --- |
| `bakeAnimations` | `true` | Export the final evaluated animation curves |
| `embedTextures` | `true` | Prefer self-contained character exports |
| `textureTransformMode` | `"blender"` | Better Blender texture-transform round trip |
| `frameRate` | `30` | Default timeline rate when the editor does not provide one |

## API

### `exportFbx(source, options?)`

Exports either:

- a Three.js-like `Object3D` / `Scene`
- the internal normalized scene model used by the sample fixtures

Returns a `Uint8Array`.

### `exportMixamoCleanupFbx(input, options?)`

Exports editor-ready character input:

```ts
{
  object3D: THREE.Object3D,
  animations?: THREE.AnimationClip[],
  frameRate?: number
}
```

Returns a `Uint8Array`.

### Common Options

| Option | Type | Notes |
| --- | --- | --- |
| `version` | `7400 \| 7500+` | FBX 7400 uses 32-bit node records; 7500+ uses wide records |
| `frameRate` | `number` | Scene/global frame rate |
| `animations` | `AnimationClip[]` | Explicit clips when they are not attached to the object tree |
| `bakeAnimations` | `boolean` | Bake Three.js interpolated tracks into FBX curve keys |
| `textureTransformMode` | `"direct" \| "blender"` | Choose direct Three.js-style or Blender-compatible texture transforms |
| `resolveTextureContent` | `(fileName, context) => bytes \| { content, mimeType }` | Synchronous texture embedding hook |
| `compressArrayBytes` | `(bytes) => Uint8Array` | Optional FBX Encoding=1 array compression |
| `embedTextures` | `boolean` | Request embedding and emit warnings for unresolved file textures |
| `warnings` | `Array` | Collect structured export warnings |
| `onWarning` | `(warning) => void` | Observe warnings as they are emitted |

## Texture Embedding

File-backed textures can be embedded with a synchronous resolver:

```js
import { readFileSync } from "node:fs";
import { exportFbx } from "./src/index.js";

const bytes = exportFbx(scene, {
  embedTextures: true,
  resolveTextureContent: (fileName) => ({
    content: readFileSync(fileName),
    mimeType: "image/tga"
  })
});
```

The exporter can also pack data URLs, explicit `{ content, mimeType }` texture records, Three.js byte aliases such as `content`, `bytes`, or `data`, and raw one/two/RGB/RGBA image buffers.

## Validation

Install dependencies:

```bash
npm install
```

Run the normal gates:

```bash
npm run check
npm test
```

Generate and validate the Mixamo-style round-trip fixture:

```bash
npm run sample:mixamo:embedded:compressed
npm run validate:mixamo:embedded:compressed
```

Validate any external FBX file:

```bash
npm run validate:file -- /path/to/model.fbx
```

`validate:file` produces a JSON report with:

- binary FBX preflight results
- Three.js `FBXLoader` parse results
- Blender import results
- mesh/material/texture/skeleton/morph/action counts
- importer warnings

Real Mixamo files sometimes contain footer bytes after the top-level null record. Generated exporter output remains strict; external validation reports those bytes as warnings so Blender and Three.js can still be tested.

## Samples

| Command | Output |
| --- | --- |
| `npm run sample:static` | Static cube mesh |
| `npm run sample:skinned:embedded` | Skinned animated mesh with packed texture |
| `npm run sample:character:embedded:compressed` | Skinned character fixture with morph and texture animation |
| `npm run sample:mixamo:embedded:compressed` | Mixamo-style edited character round-trip fixture |

Matching `validate:*` scripts run binary preflight plus importer checks where applicable.

## Feature Coverage

| Three.js / internal input | FBX output |
| --- | --- |
| `Mesh`, `BufferGeometry` | `Geometry`, `Model`, normals, tangents, UV layers, vertex colors |
| `Object3D`, `Scene`, parented nodes | FBX model hierarchy and transforms |
| `MeshStandardMaterial`, `MeshPhongMaterial`, `MeshBasicMaterial` | FBX Lambert/Phong-style materials |
| Material texture slots | `Texture` + `Video`, layered/custom lanes where needed |
| Data URLs and raw image buffers | Packed FBX media content |
| `SkinnedMesh`, `Skeleton`, `Bone` | Limb nodes, skin deformers, clusters, bind pose |
| `AnimationClip` TRS tracks | `AnimationStack`, `AnimationLayer`, curve nodes, curves |
| Bone animation | Baked limb-node transform curves |
| Morph targets | Shape geometry, blend shape deformers, channel curves |
| Cameras and lights | FBX camera/light attributes, models, animation targets |
| Custom model/material/texture properties | User-defined FBX properties and animation curves |

## Real-World Probes

The validator is designed to run against real Mixamo-style character files, not only synthetic fixtures. Those probes expose useful hardening targets:

- FBX 7700 with a small trailing footer
- embedded images
- large mesh and high bone count
- 79-frame animation
- source vertices with more than four skin weights, which Three.js trims on import

Those details are now part of the compatibility roadmap.

## Architecture

The project is intentionally split into small domain folders:

| Directory | Purpose |
| --- | --- |
| `src/three/` | Three.js adapters and Three.js-specific extraction |
| `src/scene/` | internal scene model and sample scenes |
| `src/geometry/`, `src/skeleton/`, `src/morph/` | mesh, skinning, and blend-shape data |
| `src/material/`, `src/texture/`, `src/light/`, `src/camera/` | render-facing FBX features |
| `src/animation/` | shared animation timing, key, and track helpers |
| `src/document/` | FBX object/connection/definition assembly |
| `src/core/`, `src/node/` | binary writer and low-level FBX node utilities |
| `src/export/`, `src/validation/` | public export adapters and validation support |

Low-level code never imports Three.js adapters, and adapters do not write FBX nodes directly. The architecture guard test keeps production files under a line budget and enforces layer boundaries.

See [docs/architecture.md](docs/architecture.md) for the full extension pattern.

## Roadmap

1. Integrate `exportMixamoCleanupFbx` into Mixamo Cleanup as an `Export FBX` action.
2. Build a real fixture corpus from edited Mixamo Cleanup characters.
3. Harden skin-weight export/import behavior around assets with more than four influences per vertex.
4. Improve animation fidelity for root/hips travel, loop blends, pre/post rotations, bind pose, and edited key ranges.
5. Expand texture/material compatibility with Blender, Three.js, Unity, and Unreal importers.
6. Add side-by-side benchmark tests against other MIT exporters such as `@comfyorg/fbx-exporter-three`.
7. Stabilize package exports and publish once the editor integration is proven.

## License

MIT. Blender's FBX exporter is treated as behavioral reference only; no GPL source is copied into this project.
