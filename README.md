# FBX Exporter

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![FBX](https://img.shields.io/badge/FBX-binary%207400%20%2F%207500-444.svg)](#fbx-exporter)
[![Target](https://img.shields.io/badge/target-Three.js%20%2B%20Blender%20%2B%20web-0b7285.svg)](#validation)

A from-scratch, MIT-friendly binary FBX exporter for browser and Node character pipelines.

It exports Three.js-style scenes to FBX while preserving meshes, hierarchy, skeletons, skinning, morphs, materials, textures, and baked animation curves well enough to round-trip through Blender and Three.js `FBXLoader`.

## Why This Exists

FBX export is awkward in browser and Node projects. Blender's exporter is useful as a behavioral reference, but its GPL source cannot be copied into an MIT project. Autodesk's SDK is not browser-friendly. This project keeps the implementation original, modular, and testable.

The exporter is packaged as a standalone ESM module with no runtime dependencies. It is designed for web tools that need direct FBX output from Three.js-style scenes.

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
| Character workflow | High-level character export helper and animated character fixtures are in place |

## Quickstart

```js
import { exportFbx } from "@fourthtemple/fbx-exporter";

const bytes = exportFbx(threeSceneOrObject);
```

Save the returned `Uint8Array` as a binary `.fbx` file.

```js
import { writeFileSync } from "node:fs";
import { exportFbx } from "@fourthtemple/fbx-exporter";

writeFileSync("character.fbx", exportFbx(scene));
```

## Character Export

Use `exportCharacterFbx` when exporting a rigged character with explicit baked animation clips. Pass the final Three.js object tree plus animation clips, and receive a binary FBX file as a `Uint8Array`.

```js
import { exportCharacterFbx } from "@fourthtemple/fbx-exporter";

const bytes = exportCharacterFbx({
  object3D: characterRoot,
  animations: bakedClips,
  frameRate: timelineFrameRate
}, {
  resolveTextureContent,
  onWarning: (warning) => console.warn(warning)
});
```

`exportCharacterFbx` defaults to:

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
- a normalized scene model for custom pipelines

Returns a `Uint8Array`.

### `exportCharacterFbx(input, options?)`

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

Generate and validate an animated character round-trip fixture:

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

Some third-party FBX files contain footer bytes after the top-level null record. Generated exporter output remains strict; external validation reports those bytes as warnings so Blender and Three.js can still be tested.

## Samples

| Command | Output |
| --- | --- |
| `npm run sample:static` | Static cube mesh |
| `npm run sample:skinned:embedded` | Skinned animated mesh with packed texture |
| `npm run sample:character:embedded:compressed` | Skinned character fixture with morph and texture animation |
| `npm run sample:mixamo:embedded:compressed` | Animated character round-trip fixture |

Matching `validate:*` scripts run binary preflight plus importer checks where applicable.

## Feature Coverage

| Three.js / scene input | FBX output |
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

The validator is designed to run against real character files, not only synthetic fixtures. Those probes expose useful hardening targets:

- FBX 7700 with a small trailing footer
- embedded images
- large mesh and high bone count
- 79-frame animation
- source vertices with more than four skin weights, which Three.js trims on import

Those details help guide compatibility work across real-world importers.

## Architecture

The project is intentionally split into small domain folders:

| Directory | Purpose |
| --- | --- |
| `src/three/` | Three.js adapters and Three.js-specific extraction |
| `src/scene/` | normalized scene model and sample scenes |
| `src/geometry/`, `src/skeleton/`, `src/morph/` | mesh, skinning, and blend-shape data |
| `src/material/`, `src/texture/`, `src/light/`, `src/camera/` | render-facing FBX features |
| `src/animation/` | shared animation timing, key, and track helpers |
| `src/document/` | FBX object/connection/definition assembly |
| `src/core/`, `src/node/` | binary writer and low-level FBX node utilities |
| `src/export/`, `src/validation/` | public export adapters and validation support |

Low-level code never imports Three.js adapters, and adapters do not write FBX nodes directly. The architecture guard test keeps production files under a line budget and enforces layer boundaries.

See [docs/architecture.md](docs/architecture.md) for the full extension pattern.

## Roadmap

1. Build a broader fixture corpus from real edited characters.
2. Harden skin-weight export/import behavior around assets with more than four influences per vertex.
3. Improve animation fidelity for root/hips travel, loop blends, pre/post rotations, bind pose, and edited key ranges.
4. Expand texture/material compatibility with Blender, Three.js, Unity, and Unreal importers.
5. Add side-by-side benchmark tests against other MIT exporters such as `@comfyorg/fbx-exporter-three`.

## License

MIT. Blender's FBX exporter is treated as behavioral reference only; no GPL source is copied into this project.
