# FBX Exporter

Standalone research project for a browser/Node-friendly FBX exporter focused on Mixamo Cleanup round trips. The current priority is exporting edited Three.js character scenes as FBX while preserving:

- hierarchy, cameras, lights, and transforms
- skinned meshes
- bind poses
- deformers/clusters
- baked animation stacks and curves
- embedded/sidecar textures and validation diagnostics

The exporter writes deterministic binary FBX 7400 by default and already covers static meshes, hierarchy, materials/textures, morphs, skeletons, skin clusters, bind poses, and baked transform/bone/morph/material/texture animation curves. Mixamo-style validation now uses both synthetic edited-character fixtures and external FBX probes such as large Mixamo downloads, with Blender and Three.js reports kept separate so importer-specific behavior is visible.

## API

```js
import { exportFbx } from "./src/index.js";

const bytes = exportFbx(threeSceneOrObject);
```

`exportFbx` accepts a Three.js-like `Object3D` tree or the internal scene shape used by `createCubeScene()`.
Mixamo Cleanup integration should use the editor-facing adapter so the editor hands over a finalized object plus baked clips without coupling the exporter to timeline UI internals:

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

`exportMixamoCleanupFbx` defaults to `bakeAnimations: true`, `embedTextures: true`, and `textureTransformMode: "blender"`.
FBX 7400 remains the default output version; pass `version: 7500` or newer when the binary should use 64-bit node records.
Typed array properties are uncompressed by default; pass `compressArrayBytes` to emit FBX Encoding=1 array payloads. Node callers can use the helper in `src/node-array-compressor.js` for zlib-deflated geometry and animation arrays without adding zlib to browser-oriented code paths.
Use `validateFbxBinary(bytes)` or `assertValidFbxBinary(bytes)` as a fast preflight before handing generated files to Blender; it checks binary magic/version, node end offsets, property byte ranges, null records, and array payload lengths so malformed exporter output can fail with a local diagnostic instead of an importer crash. `npm run validate:file -- path/to/file.fbx` runs tolerant external-file preflight, Three.js `FBXLoader`, and Blender import, then emits a stable JSON report. Some real Mixamo FBX files include a footer after the top-level null record; generated exporter fixtures remain strict, while external file validation reports those bytes as warnings.
Pass `resolveTextureContent` when file-backed textures should be embedded into FBX `Video.Content`:

```js
import { readFileSync } from "node:fs";
import { exportFbx } from "./src/index.js";

const bytes = exportFbx(scene, {
  resolveTextureContent: (fileName) => readFileSync(fileName)
});
```

Node callers can also use the helper in `src/node-texture-resolver.js` for base-directory resolution and MIME hints. Packed video data URLs, explicit `{ content, mimeType }` textures, internal/Three.js byte aliases such as `content`, `bytes`, or `data` including matching `texture.userData` aliases, nested `texture.userData.image`, `texture.userData.source`, or `texture.userData.source.data` data URLs/raw pixel buffers, and file-backed video textures keep media MIME hints and extensions such as `mp4`, `webm`, `ogv`, and `mov` when written into FBX `Video.Content`; packed MP4/MOV, WebM, and Ogg Theora payloads can also populate dimensions from their track headers, and MP4/MOV, WebM, and Ogg Theora headers can populate video frame-rate metadata when explicit texture metadata is absent. MP4/MOV sample timing and WebM segment duration can also seed `StopFrame` and `LastFrame` for packed video textures. Common packed image and GPU texture payloads keep extensions such as `avif`, `svg`, `tiff`, `exr`, `dds`, `ktx`, and `ktx2`.

The skinned sample has embedded variants that pack `checker.tga` into `Video.Content`, so the animated armature fixture can be validated without sidecar texture files:

```bash
npm run sample:skinned:embedded
npm run validate:skinned:embedded
```

The character sample combines a skinned mesh, bind pose, morph target, embedded texture, bone animation, morph animation, and texture transform animation in one fixture:

```bash
npm run sample:character:embedded:compressed
npm run validate:character:embedded:compressed
```

The Mixamo round-trip sample is closer to the editor target: Mixamo-style bone names, hips travel, foot/arm curves, loop-blend take, material slots, sidecar/data-url/raw textures, and morph animation:

```bash
npm run sample:mixamo:embedded:compressed
npm run validate:mixamo:embedded:compressed
```

Texture transforms and texture transform animation curves default to the direct values that Three.js `FBXLoader` exposes for offset/repeat. Internal and Three.js static textures can also provide `texture.userData` transform aliases such as `offset`, `repeat`, `rotation`, `center`, `textureTranslation`, and `textureScale`, or a baked Three.js-style `matrix`, `transformMatrix`, or `uvMatrix`, including matching `texture.userData`, `texture.userData.image`, `texture.source`, `texture.source.data`, `texture.userData.source`, `texture.userData.source.data`, `texture.video`, `texture.media`, `texture.element`, `texture.mediaElement`, `texture.userData.video`, `texture.userData.media`, `texture.userData.element`, and `texture.userData.mediaElement` overrides, which are decomposed into FBX translation, rotation, and scaling properties. Animation tracks can also target `textureMatrix` or Three.js-style `material.map.matrix.elements`, `material.map.userData.uvMatrix.elements`, `material.map.userData.image.uvMatrix.elements`, `material.map.source.offset`, `material.map.source.data.offset`, `material.map.media.offset`, `material.map.userData.mediaElement.offset`, or texture-owned `media.offset`, `userData.mediaElement.offset`, and `userData.source.data.uvMatrix.elements`; those tracks expand into FBX texture translation, rotation, and scaling curves, and internal matrix keyframes may wrap the matrix in `value`, `defaultValue`, `matrix`, `transformMatrix`, or `uvMatrix` objects. Single-key animation tracks are preserved as one-key FBX curves, which is useful for keyed pose or texture-state edits. Pass `textureTransformMode: "blender"` when the export target is Blender and texture mapping scale/rotation should round-trip through Blender's FBX importer:

```js
const bytes = exportFbx(scene, { textureTransformMode: "blender" });
```

Three.js texture transform tracks can use either full material paths such as `material.map.offset` or the `PropertyBinding` shorthand `map.offset`; both resolve to the exported diffuse texture target.

When multiple material or texture slots intentionally share the same display `name`, give each one an `animationName` or `animationTarget` and target animation tracks at that unique value. Three.js objects can carry those aliases directly or under `userData`. Ambiguous duplicate material or texture target names are rejected during export instead of being resolved by insertion order.

Three.js objects with duplicate display names are exported with deterministic suffixes such as `Name_2`, and animation tracks that target an object UUID are resolved to that exported name. UUID-targeted transform, material, and texture paths stay connected even when several scene objects share the same visible name. Material and texture UUIDs can also target direct FBX animation paths such as `<materialUuid>.__material.opacity` or `<textureUuid>.__texture.offset`, which is useful when clips are authored outside a mesh path. Unique material, texture, and texture media/source aliases can also use bare local paths such as `MyMaterial.opacity`, `MyTexture.offset`, or `MyVideoImage.currentTime`.

Three.js object names may contain dots, matching `PropertyBinding` names such as `Cat.Body.position` or `Cat.Body.material.map.offset`; those paths resolve against the dotted source object before FBX emission instead of being mistaken for nested properties.

Internal animation tracks can target FBX model transform metadata such as `rotationOffset`, `rotationPivot`, `preRotation`, `postRotation`, `scalingOffset`, `scalingPivot`, `geometricTranslation`, `geometricRotation`, and `geometricScaling`, including `X`/`Y`/`Z` component tracks. Three.js tracks can address the same authored metadata through object `userData`, for example `Cube.userData.rotationPivot` or `Cube.userData.geometricScale[z]`.

Three.js animation targets with namespace or hierarchy separators, such as Mixamo-style `mixamorig:Spine.quaternion` or `Rig/Spine.quaternion`, resolve through unambiguous leaf aliases. This also works for skinned bones that live only in `SkinnedMesh.skeleton.bones` instead of being attached to the exported object tree.

Three.js skeleton bones are exported through FBX `LimbNode` records owned by the skin, not again as generic Null hierarchy nodes. Bone animation can still target either the authored bone name or the bone UUID, which keeps attached Three.js skeletons from producing duplicate imported rig objects.

When a Three.js scene contains separate skeletons that reuse bone display names, the adapter assigns deterministic suffixes such as `Spine_2` to the later skeleton's FBX bone names. Shared Three.js bone objects still export as one shared FBX skeleton, while independent rigs remain independently addressable through bone UUID animation tracks.

Three.js clips authored against the exported root object can use root-relative paths such as `.position`, `.material.opacity`, or `.material.map.offset`; those resolve to the root's exported FBX model, material, and texture targets.

Clips stored directly on an exported object can also use bare local Three.js paths such as `position`, `material.opacity`, or `material.map.offset`. The adapter treats those as root-local to that clip owner, matching the common `AnimationMixer(object)` authoring style.

Option-provided clips can use `rootObject`, `targetObject`, or `rootTarget` to make local tracks relative to an exported Object3D, bone, material, texture, or texture media/source owner. Material roots use local paths such as `opacity` or `color`; texture and media roots use local paths such as `offset`, `repeat`, `currentTime`, or `userData.alpha`.

When an option-provided root resolves to several exported texture lanes, such as one Three.js texture reused by `map` and `alphaMap`, the adapter fans that local clip into one FBX take with curves for each exported texture target.

When a Three.js scene contains `animations` arrays on child objects or their `userData`, the adapter collects those clips too. Root-relative tracks in a child-owned clip resolve against that child object's exported FBX target, which keeps local clips exportable from a full scene. This also applies to exported skeleton bones, including bones that are only present through `SkinnedMesh.skeleton.bones`.

Three.js clips can carry clip-specific timing metadata through `clip.userData.frameRate`, `clip.userData.fps`, `clip.userData.exportFrameRate`, or matching direct clip fields. The adapter keeps that per-clip rate for keyframe frames and FBX take timing while the scene-level frame rate continues to drive global timeline settings. Clip frame windows can also be supplied with `startFrame`, `frameStart`, `endFrame`, `stopFrame`, or the matching `startTime`/`endTime` aliases; exported keyframes are offset and retimed into that authored FBX take window. Clip playback speed aliases such as `timeScale`, `playbackRate`, `playSpeed`, and `speed` retime exported keyframes and the default take stop time, including negative values for reversed playback.

When a Three.js clip has an explicit `duration` shorter than a source track, exported curve keys are clamped to that duration and an interpolated boundary key is emitted so FBX curves and take timing agree.

Source clips can be trimmed before export with `sourceStartTime`, `sourceEndTime`, `trimStart`, `trimEnd`, or matching `sourceStartFrame`/`sourceEndFrame` aliases. The adapter samples only that source range, rebases it to the exported take, and still honors frame-window and playback-speed metadata. When `bakeAnimations: false` preserves sparse Three.js keys, trim boundaries are still emitted with interpolated values so the exported take starts and ends at the requested source poses.

Curve baking can also be controlled per clip with `clip.userData.bakeFrameRate`, `bakeSampleRate`, `sampleRate`, or `resampleFrameRate`. Individual Three.js tracks can use the same aliases on `track.userData` or direct track fields to override the clip/default bake rate, letting detailed channels export with dense samples while simpler channels stay compact.

Internal vector animation keyframes can carry per-axis spline data with tangent arrays, such as `rightSlope: [x, y, z]`, `nextLeftSlope: [x, y, z]`, `rightWeight: [x, y, z]`, and `nextLeftWeight: [x, y, z]`, or with `tangentDataByChannel`/`channelTangents`. The FBX writer applies those values to the matching X/Y/Z animation curves, including model, material, and texture vector curves.

Three.js `AnimationClip.blendMode` values are mapped onto FBX animation layer blend modes, so additive clips become additive FBX layers even when no explicit `userData.layerBlendMode` is supplied.

Internal animation clips can also supply `layers`, each with its own FBX animation layer settings and track list. The exporter writes one `AnimationStack` for the clip, one `AnimationLayer` per layer, and keeps transform, material, texture, video, morph, camera, light, and bone curves attached to the layer that authored them. Layer-local keys and explicit layer frame bounds participate in the exported stack, take, and global timeline spans.

Three.js clips can author the same structure with `clip.userData.layers` or `clip.layers`. Each layer can provide layer settings plus a `tracks` array containing Three.js `KeyframeTrack` objects or names of tracks already present on the clip, letting one clip export transform curves on one FBX layer and texture/material curves on another.

Three.js materials export to the closest FBXLoader-supported shading model. Phong/PBR-style materials export as `Phong`; Lambert, Basic, Toon, and Matcap-style materials export as `Lambert` so they do not pick up Phong-only specular fields on import.

When several Three.js texture aliases map to the same FBX material lane, the adapter keeps the extra maps as FBX layered textures instead of dropping them. For example, `normalMap` and `clearcoatNormalMap` both export through `NormalMap`, and `roughnessMap` plus `sheenRoughnessMap` both export through `ShininessExponent`. Animation tracks still route to the addressed alias, so `material.clearcoatNormalMap.offset` targets the clearcoat normal texture rather than the base normal texture. Layer controls can be authored from Three.js paths such as `material.clearcoatNormalMap.userData.layerAlpha`, source-owned paths such as `material.clearcoatNormalMap.source.layerAlpha`, or texture-owned local clips such as `userData.layerAlpha` and source-owned local clips such as `layerAlpha`; those resolve to the corresponding `LayeredTexture` node. Internal tracks can also target the layered texture object itself with `textureLayerAlpha:<index>` or `textureLayerBlendMode:<index>`; these animate mirrored `Maya|layer_alpha_<index>` and `Maya|layer_blend_mode_<index>` properties while the FBX `BlendModes` and `Alphas` arrays preserve the static layer state.

When the same Three.js `Texture` object is reused across different material lanes, such as `map` and `alphaMap`, the adapter keeps the display texture names but assigns deterministic lane-specific animation targets. Texture transform tracks for each slot can then export without becoming ambiguous FBX texture curves.

Three.js `MeshMatcapMaterial.matcap` exports as an FBX `DiffuseColor` texture, and `material.matcap.*` texture transform animation targets the exported diffuse texture. FBX does not have a native matcap shading model, so this preserves the texture payload and animation through the closest broadly readable material slot.

Three.js `MeshToonMaterial.gradientMap` exports as a custom `Maya|TEX_gradient_map` texture lane, and `material.gradientMap.*` transform animation targets that texture. FBX does not have a native toon-gradient slot, so this keeps the texture payload and animation addressable without pretending it is a diffuse map.

Three.js physical material specular data maps onto FBX Phong specular fields: `specularColor`/`specularColorMap` export as `SpecularColor`, and `specularIntensity`/`specularIntensityMap` export as `SpecularFactor`.

Three.js environment maps export through FBX reflection fields: `envMapIntensity` maps to `ReflectionFactor`, `envMap` maps to a `ReflectionColor` texture, and material-level `envMapRotation` plus its animation tracks map to that reflection texture's rotation channels. `CubeTexture` env maps use the positive-X face as the primary reflection texture for compatibility, and also export all six face sources as custom `Maya|TEX_cube_*` texture lanes (`px`, `nx`, `py`, `ny`, `pz`, `nz`) so readers that inspect custom texture connections can recover the full cube map. Face arrays can come from Three.js `image`/`images`/`source.data` or matching `texture.userData.image`/`texture.userData.source.data` owners. Those custom cube face lanes preserve the parent texture's offset/repeat/UV-channel metadata and the material `envMapRotation`; CubeTexture-owned texture animation clips fan out to the primary reflection texture and each face lane, while clips attached to a face image route only to that face lane. Data URL cube faces are packed into FBX `Video.Content` instead of being emitted as literal data-URL filenames.

Three.js physical material clearcoat data maps onto FBX Phong-era fields: nonzero `clearcoat` exports as `ReflectionFactor`, `clearcoatMap` exports as a `ReflectionFactor` texture, `clearcoatRoughness`/`clearcoatRoughnessMap` export as `Shininess`/`ShininessExponent`, `clearcoatNormalMap` plus `clearcoatNormalScale` export as `NormalMap`/`BumpFactor`, and the corresponding material and texture animation targets are preserved.

Three.js physical material transmission data maps onto FBX transparency factor fields: nonzero `transmission` exports as `TransparencyFactor`, `transmissionMap` exports as a `TransparencyFactor` texture, and `material.transmission` plus `material.transmissionMap.*` animation targets the same FBX channels.

Three.js physical material sheen data maps onto FBX Phong-era specular fields: nonzero `sheen` exports as `SpecularFactor`, `sheenColor`/`sheenColorMap` export as `SpecularColor`, `sheenRoughness`/`sheenRoughnessMap` export as `Shininess`/`ShininessExponent`, and the corresponding material and texture animation targets are preserved.

Three.js physical extension data without native FBX Phong slots is still preserved through explicit custom lanes: `anisotropy`, `anisotropyRotation`, `iridescence`, `iridescenceIOR`, `iridescenceThicknessRange`, `thickness`, `attenuationColor`, `attenuationDistance`, `ior`, and `dispersion` export as `Maya|*` material properties with animation curves, while `anisotropyMap`, `iridescenceMap`, `iridescenceThicknessMap`, and `thicknessMap` export as `Maya|TEX_*` texture connections with texture transform animation targets.

Three.js `ShaderMaterial` and `RawShaderMaterial` uniforms are preserved when they can be represented safely in FBX. Numeric uniforms export as custom scalar material properties, color/vector uniforms export as custom color/vector material properties, long numeric uniform arrays export as indexed scalar material properties, vector/color uniform arrays export as indexed vector/color material properties, texture uniforms, texture-array uniforms, and plain texture-like uniform records with `src`, relative paths, MIME-backed bytes, or raw image buffers export as custom `Maya|TEX_shader_uniform_*` texture lanes, and tracks such as `material.uniforms.uTime.value`, `material.uniforms.uOffset.value`, `material.uniforms.uWeights.value`, `material.uniforms.uWeights.value[2]`, `material.uniforms.uColorStops.value[1]`, `material.uniforms.uMap.value.offset`, `material.uniforms.uMap.value.userData.uvMatrix.elements`, `material.uniforms.uMap.value.userData.source.data.uvMatrix.elements`, `material.uniforms.uMap.value.source.data.repeat`, `material.uniforms.uMap.value.center`, `material.uniforms.uMap.value.userData.customProperties[Maya|gain].value`, `material.uniforms.uTextureArray.value[1].offset`, `material.uniforms.uTextureArray.value[1].userData.customProperties[Maya|gain].value`, or `material.uniforms.uTextureArray.value[0].image.currentTime` route to the matching custom material or texture animation target. Three.js `FBXLoader` may ignore those custom shader lanes, but the data remains in the FBX for consumers that inspect custom properties.

Plain shader-uniform texture records can also expose their path, bytes, raw image shape, or video metadata through nested source owners such as `userData.source` and `userData.source.data`.

Three.js material records can also carry explicit `customProperties` through direct material fields, `material.fbxCustomProperties`, `material.materialCustomProperties`, or matching `material.userData` aliases. Scalar, boolean, string, vector, and color values are written onto FBX `Material` nodes; scalar, vector, vector-component, and color properties can be animated with `customMaterialScalar:`, `customMaterialVector:`, `customMaterialVectorComponent:`, and `customMaterialColor:` animation property prefixes. Three.js material tracks can target object-map custom properties with paths such as `material.customProperties[Maya|gain].value`, `material.userData.customProperties.Maya|gain.value`, `material.userData.customProperties[Maya|gain].value`, or material-owned local clips on `material.animations`/`material.userData.animations` such as `customProperties[Maya|gain].value`.

Scene objects can carry explicit Model custom properties through direct object fields, `object.fbxCustomProperties`, `object.modelCustomProperties`, or matching `object.userData` aliases. Scalar, boolean, string, vector, and color values are written onto FBX `Model` nodes for meshes, nulls, cameras, lights, and skeleton limbs; scalar, vector, vector-component, and color properties can be animated with `customModelScalar:`, `customModelVector:`, `customModelVectorComponent:`, and `customModelColor:` animation property prefixes. Three.js model tracks can target paths such as `object.customProperties[Maya|gain].value`, `object.userData.customProperties[Maya|gain].value`, or object-owned local clips such as `customProperties[Maya|gain].value`.

Three.js texture-adjacent material controls without direct FBX slots are preserved as custom material properties with animation curves: `aoMapIntensity`, `displacementBias`, `alphaTest`, and `normalMapType`.

Three.js material render-state values without direct FBX material slots are preserved as custom material properties with animation curves: `side`, `blending`, blend factors/equations, `blendColor`, `blendAlpha`, `depthFunc`, `depthTest`, `depthWrite`, `colorWrite`, `vertexColors`, `fog`, material visibility, `allowOverride`, `shadowSide`, polygon offset, stencil settings, clipping flags/count, static clipping plane normals/constants, animatable clipping plane normals/constants, `alphaHash`, `alphaToCoverage`, `premultipliedAlpha`, `forceSinglePass`, `toneMapped`, `dithering`, `wireframe`, and `wireframeLinewidth`.

Three.js `lightMap` exports through FBX `AmbientColor` with `UVMap_1` as the default UV set, and `lightMapIntensity` exports as `AmbientFactor` so baked lighting data and its animation have a stable FBX target.

Three.js textures can target a specific exported UV layer with `texture.userData.uvSet`, direct `texture.uvSet`, `uvSetName`, or `uvLayer` aliases, or with `texture.channel` for `UVMap_N` channel addressing.

Three.js texture color, packing, format, and sampler metadata is preserved on custom texture properties: `colorSpace`, legacy `encoding`, `flipY`, `unpackAlignment`, `minFilter`, `magFilter`, texture `anisotropy`, `format`, `type`, `internalFormat`, depth-texture state, compare function, texture dimensionality, array layer/depth counts, data/compressed texture flags, mipmap count, third-axis `wrapR`/`wrapW` state for 3D and array textures, and `matrixAutoUpdate`; internal texture records can supply the same static sampler and cropping fields directly or under `texture.userData`. `colorSpace`, `internalFormat`, texture dimension kind, wrap-W, and depth compare values are written with readable/static metadata plus numeric animation targets, so static exports keep the labels while animation curves can still drive the metadata. Texture source owners such as `texture.source`, `texture.userData.source.data`, or `texture.userData.mediaElement` can also carry sampler fields, dimension kind, depth, layer counts, data/compressed/depth flags, mipmaps, cropping, alpha source, and premultiply-alpha state when that is where the real media object lives. Atlas and flipbook textures can provide `atlasColumns`/`atlasRows` plus `atlasFrame`, `tileIndex`, `flipbookFrame`, direct `atlasColumn`/`atlasRow` cell coordinates, or `atlasTile`/`atlasCell` pairs such as `[column, row]`; those atlas fields can also live on nested image/media/source owners. The exporter writes the atlas metadata and composes the selected cell into texture translation/scaling, including frame animation tracks from internal clips or Three.js paths such as `material.map.userData.atlasFrame`, `material.map.source.atlasTile`, `material.map.userData.atlasColumn`, `material.map.userData.atlasRow`, or `material.map.userData.atlasTile`, internal `atlasTile` tracks with `[column, row]` values, and internal `atlasColumn`/`atlasRow` component tracks for single-axis cell changes. Video-like texture sources, including Three.js `VideoTexture`, byte-backed texture `content`/`bytes`/`data`, and `userData.video`/`userData.media`/`userData.element`/`userData.mediaElement` objects, preserve media paths, `videoWidth`/`videoHeight`, duration-derived frame bounds, browser-style `currentTime` offsets, playback speed, loop state, and FBX video metadata; width/height and playback fields can come from direct texture fields, nested image/media/source objects, or nested `userData.image`/`userData.source`/`userData.source.data`/`userData.video`/`userData.media`/`userData.element`/`userData.mediaElement` objects, and those playback fields can also be animated. Image-sequence frame controls such as `currentFrame`, `sequenceFrame`, and `frameIndex` map to FBX `ImageSequenceOffset` for static textures and animation curves. Internal and Three.js texture source paths can come from direct texture fields such as `src`, `currentSrc`, `url`, or `path`, relative path aliases such as `relativeFileName`, from nested image/media/source objects, or from matching `texture.userData` aliases; source owners can also provide the relative path when the absolute/current source differs from the FBX `RelativeFilename`. Three.js material textures can also be supplied through `material.userData` with either native names such as `roughnessMap` or exporter lane names such as `roughnessTexture`; those texture aliases share the same static export and texture animation targets as direct material slots.

Texture records can also carry explicit `customProperties` through direct texture fields, `texture.fbxCustomProperties`, `texture.textureCustomProperties`, matching `texture.userData` aliases, or nested media/source owners such as `texture.source` and `texture.userData.source.data`. Scalar, boolean, string, vector, and color values are written onto FBX `Texture` nodes and mirrored onto the matching `Video` media clip; scalar, vector, vector-component, and color properties can be animated with `customTextureScalar:`, `customTextureVector:`, `customTextureVectorComponent:`, and `customTextureColor:` animation property prefixes. Three.js texture tracks can target object-map custom properties with paths such as `material.map.customProperties[Maya|gain].value`, `material.map.userData.customProperties[Maya|tint].value.r`, `material.map.source.customProperties[Maya|gain].value`, or texture-owned local clips such as `customProperties[Maya|gain].value`.

Texture-owned Three.js clips can live on the `Texture` itself, `texture.userData`, or nested media/source owners such as `texture.image`, `texture.source`, `texture.source.data`, `texture.video`, `texture.media`, `texture.element`, `texture.mediaElement`, or matching `texture.userData` mirrors. Local tracks such as `currentTime`, `data.currentTime`, `playbackRate`, `frameIndex`, `offset`, and `customProperties[Maya|gain].value` route back to the exported FBX texture target.

Three.js `normalScale` animation maps onto FBX `BumpFactor`. Full vector tracks use the X component, and explicit `.x`/`.y` or `[0]`/`[1]` component tracks use the addressed component because FBX exposes this channel as a scalar.

Three.js morph influence animation can target numeric brackets, named brackets, or the whole influence array, such as `morphTargetInfluences[0]`, `morphTargetInfluences[Smile]`, or `morphTargetInfluences`; each resolves to the exported FBX blend-shape channel.

Three.js `Sprite` objects export as textured quad meshes. The adapter bakes the sprite `center` anchor and `SpriteMaterial.rotation` into the quad geometry, preserves the `map`/`alphaMap` material textures, and keeps texture-owned animation clips routed to the exported FBX texture target.

Three.js `Points` objects export as FBX-readable textured quad meshes. The adapter bakes each point into a local XY quad using `PointsMaterial.size`, respects indexed `drawRange`, carries point colors into vertex colors, preserves `map`/`alphaMap` material textures, and keeps texture-owned animation clips routed to the exported FBX texture target.

Three.js `Line`, `LineSegments`, and `LineLoop` objects export as FBX-readable ribbon meshes. The adapter bakes line segments into thin local-space quads using `LineBasicMaterial.linewidth` or `userData.fbxLineWidth`, respects indexed `drawRange` and material groups, carries line vertex colors into FBX vertex colors, and keeps material textures plus texture-owned animation clips routed through the normal material pipeline.

Three.js `BufferGeometry.drawRange` is respected during export. Only the rendered index/vertex range is emitted, and material groups are matched against the original index offsets so subset exports keep the intended material slot. Triangle strip and triangle fan draw modes are converted into normal FBX triangle polygons during adaptation, including deterministic material-index assignment from the original source offsets.

Internal mesh geometry can provide shorthand UV layers as `uvs`, `uv2s`, `uv3s`, through `uv8s`; they normalize to `UVMap`, `UVMap_1`, `UVMap_2`, and so on. Texture `uvSet` values can target those names directly.
Internal normals, tangents, binormals, and vertex colors can be supplied either per vertex or per polygon vertex; the exporter expands them to FBX polygon-vertex layer data.

## Architecture

See `docs/architecture.md` for the layer rules and extension pattern that keep new exporter features from turning into a monolith.

The exporter is split around stable responsibilities:

- `binary-writer.js` owns FBX binary encoding only.
- `scene-normalizer.js` converts loose input into the internal scene model and delegates feature-specific coercion.
- `animation-normalizer.js` owns animation target aliases, key coercion, validation, and texture-transform mode conversion before FBX curve records are built.
- `animation-timing.js` owns FBX frame-rate modes, clip spans, scene time spans, and global timeline settings.
- `animation-key-attributes.js` owns FBX animation key interpolation flags, explicit tangent data, tangent-data defaults, and `KeyAttrRefCount` grouping.
- `animation-layer-settings.js` owns FBX animation layer weight, state, color, blend mode, and accumulation mode normalization.
- `material-animation-track-config.js` owns FBX material animation curve-node mappings, including clipping-plane custom channels.
- `geometry-normalizer.js` owns mesh vertices, polygons, normals, tangent space, UV sets, vertex colors, and morph target coercion.
- `light-normalizer.js` owns light kind, color, attenuation, spotlight cone, and light animation alias coercion.
- `material-normalizer.js` owns material color/factor coercion, material animation aliases, and roughness/metalness conversion into FBX's Phong-era fields.
- `material-custom-properties.js` owns custom material property normalization and animation property naming for shader and extension data outside native FBX material slots.
- `material-clipping.js` owns clipping-plane field names and normal/constant coercion shared by material export and animation.
- `model-document.js` owns common FBX `Model` transform, pivot, visibility, and custom properties used by mesh, null, camera, light, and limb writers.
- `value-normalizers.js` owns shared numeric/vector coercion.
- `texture-normalizer.js` owns material texture slots, sampler defaults, embedded texture metadata, mapping/usage/mipmap/media/cropping/alpha-source/image-sequence metadata, and wrap/offset/repeat normalization.
- `texture-custom-properties.js` owns custom texture property normalization and animation property naming for data outside native FBX texture slots.
- `texture-animation-normalizer.js` owns texture animation aliases and value coercion for transforms, pivots, cropping, and alpha.
- `texture-metadata-normalizer.js` owns shared texture enum/boolean coercion for wrap modes, mapping types, color-space/encoding metadata, texture format/type metadata, type-use, blend mode, and metadata animation.
- `texture-video-animation-normalizer.js` owns texture `Video` playback and image-sequence animation aliases and value coercion.
- `texture-alpha.js` owns texture alpha amount and alpha-source enum normalization.
- `texture-cropping.js` owns FBX texture crop alias normalization for left/top/right/bottom pixel crop values.
- `texture-video.js` owns FBX `Video` access mode and image-sequence timing metadata.
- `texture-transform.js` owns texture transform vectors, baked matrix decomposition, and Blender-compatible transform conversion.
- `texture-atlas.js` and `texture-atlas-animation-normalizer.js` own atlas/flipbook frame metadata and expansion into texture transform curves.
- `texture-matrix-animation-normalizer.js` owns expansion of animated texture matrices into FBX texture transform curves.
- `texture-layer-properties.js` owns shared layered texture names and mirrored layer blend/alpha property names.
- `texture-layer-animation-normalizer.js` and `texture-layer-animation-track-config.js` own layer alpha/blend animation property aliases and FBX curve-node mappings.
- `texture-layer-document.js` owns FBX `LayeredTexture` grouping, blend/alpha arrays, mirrored scalar properties, and layered texture connections.
- `sample-scenes.js` keeps fixtures out of production normalization.
- `static-document.js` is the thin export coordinator: it normalizes input, allocates deterministic records, gathers animation targets, and orders the final FBX sections.
- `document-sections.js` owns generic top-level FBX sections such as header metadata, global settings, documents, references, and the root id.
- `definition-document.js` owns `Definitions` aggregation across features, while `definition-templates.js` owns default `PropertyTemplate` records for exported FBX object types.
- `object-document.js` owns `Objects` and `Connections` aggregation across feature document writers.
- `relation-document.js` owns the top-level `Relations` table that mirrors exported object records for readers that inspect FBX object catalogs.
- `hierarchy-document.js`, `mesh-document.js`, `morph-document.js`, `texture-document.js`, `skeleton-document.js`, and `animation-document.js` own their feature-specific FBX nodes and connections.
- `camera-document.js` and `light-document.js` own camera/light FBX attributes, models, connections, and animation targets.
- `texture-content.js` decodes embeddable texture payloads, including browser data URLs and raw image buffers.
- `texture-source-fields.js` centralizes nested texture source/media field lookup so direct `source` and `source.data` owners stay consistent across normalizers and Three.js adapters.
- `texture-raw-image.js` owns raw one/two/RGB/RGBA-channel image buffer conversion into packed TGA payloads.
- `texture-dimensions.js` extracts image/video dimensions and opt-in media metadata from PNG, JPEG, TGA, BMP, GIF, WebP, TIFF, EXR, HDR/Radiance, AVIF/HEIC/HEIF, MP4/MOV, WebM, Ogg Theora, DDS, KTX, and KTX2 headers.
- `texture-bmff-dimensions.js` owns ISO BMFF box walking for AVIF/HEIC/HEIF image extents and MP4/MOV video track dimensions, frame rate, and sample-count metadata.
- `texture-ebml-dimensions.js` owns EBML/Matroska element walking for WebM video track dimensions, default-duration frame-rate metadata, and segment-duration frame counts.
- `texture-ogg-dimensions.js` owns Ogg page lacing and Theora identification header dimensions/frame-rate metadata.
- `node-texture-resolver.js` is an optional Node-only helper for embedding file-backed textures without adding filesystem dependencies to browser paths.
- `node-array-compressor.js` is an optional Node-only helper for zlib-compressing FBX typed array payloads.
- `three-buffer-attribute.js` owns normalized/raw Three.js `BufferAttribute` component reads shared by geometry and skinning adapters.
- `three-color-adapter.js` owns Three.js working-linear color conversion into FBX material color values.
- `three-animation-sampler.js` bakes Three.js interpolated tracks into sampled keys before FBX serialization.
- `three-animation-metadata.js` adapts Three.js clip layer metadata and track interpolation hints.
- `three-animation-key-metadata.js` adapts Three.js per-key tangent, interpolation, and key-attribute metadata onto exported FBX curve keys.
- `three-animation-root-entries.js` clones root-local tracks when one source clip must fan out across several exported FBX targets.
- `three-animation-root-targets.js` resolves option-provided clip roots for Object3D, bone, material, and texture owners.
- `three-animation-target-name.js` owns Three.js `animationName`/`animationTarget` aliases shared by material and texture adapters.
- `three-animation-target-aliases.js` resolves object, bone, material, and texture UUID/name aliases into exported FBX animation target names.
- `three-material-animation-owners.js` and `three-texture-animation-owners.js` list material/texture-adjacent clip owners and their local FBX root suffixes.
- `three-material-texture-target-sources.js` lists source material/texture objects beside their exported animation target names for root and alias resolution.
- `three-light-animation-adapter.js` owns Three.js light attribute track parsing and spotlight cone conversion.
- `three-material-animation-clips.js` owns discovery of material-local animation clips from Three.js material objects and their userData owners.
- `three-material-custom-property-path.js` owns Three.js custom material property path parsing shared by material-path and material-owned animation tracks.
- `three-texture-animation-adapter.js` owns Three.js texture transform, pivot, crop, alpha, metadata, and custom texture property track parsing.
- `three-texture-animation-clips.js` owns discovery of texture-local animation clips from Three.js `Texture` objects and their nested userData/image/source/media owners.
- `three-texture-layer-targets.js` maps Three.js texture aliases back to FBX `LayeredTexture` target names and layer indices.
- `three-texture-custom-property-path.js` owns Three.js custom texture property path parsing shared by material-path and texture-owned animation tracks.
- `three-texture-sampler-metadata.js` owns Three.js texture sampler, color-space, depth/compare, dimensionality, and format metadata adaptation.
- `three-material-texture-fields.js` owns the shared Three.js material texture property-to-internal-field map used by object and animation adapters.
- `three-material-extra-textures.js` aggregates non-native material texture lanes without making the material adapter know each special case.
- `three-shader-uniform-adapter.js` owns Three.js shader uniform conversion into custom material properties, custom texture lanes, and shader uniform animation property names.
- `three-cube-texture-adapter.js` owns Three.js `CubeTexture` face extraction, custom cube texture lane naming, and cube face material slot properties.
- `three-texture-source.js` owns Three.js texture source path aliases, relative path aliases, and fallback name extraction.
- `transform-matrix.js` owns TRS matrix composition/inversion and explicit matrix coercion used by bind poses and skin clusters.
- `three-transform-adapter.js` owns shared Three.js transform and visibility adaptation for object and bone paths.
- `three-adapter.js` walks Three.js object trees and delegates feature-specific adaptation.
- `three-geometry-adapter.js`, `three-material-adapter.js`, `three-light-adapter.js`, `three-skinning-adapter.js`, and `three-animation-adapter.js` translate Three.js feature data into the internal model.
- `three-instancing-adapter.js` expands Three.js `InstancedMesh` objects into individual FBX mesh models, preserving per-instance transforms, colors, and morph weights.
- `three-line-adapter.js` bakes Three.js line objects into FBX-friendly ribbon meshes while preserving line colors, draw ranges, material groups, and texture animation routing.
- `three-sprite-adapter.js` bakes Three.js `Sprite` display geometry into an FBX-friendly textured quad while the main object adapter keeps material and texture animation routing connected.
- `three-points-adapter.js` bakes Three.js `Points` objects into FBX-friendly textured quads while preserving point colors, draw ranges, material textures, and texture animation routing.

## Commands

```bash
npm install
npm test
npm run check
npm run sample:static
npm run sample:feature
npm run sample:feature:compressed
npm run sample:hierarchy
npm run sample:material
npm run sample:morph
npm run sample:character
npm run sample:character:compressed
npm run sample:character:embedded
npm run sample:character:embedded:compressed
npm run sample:skinned
npm run sample:skinned:compressed
npm run sample:skinned:embedded
npm run sample:skinned:embedded:compressed
npm run sample:vertex-color
npm run validate:static
npm run validate:feature
npm run validate:feature:compressed
npm run validate:hierarchy
npm run validate:material
npm run validate:morph
npm run validate:character
npm run validate:character:compressed
npm run validate:character:embedded
npm run validate:character:embedded:compressed
npm run validate:skinned
npm run validate:skinned:compressed
npm run validate:skinned:embedded
npm run validate:skinned:embedded:compressed
npm run validate:file -- dist/skinned-sample-embedded-compressed.fbx
npm run validate:vertex-color
```

Blender validations use `--background --factory-startup --disable-autoexec -noaudio --debug-gpu-force-workarounds --python-exit-code 1` and a shared lock in `/tmp` so local test runs do not launch several Blender processes at once. In Codex, run Blender-backed commands with external permissions; the filesystem sandbox can crash or block Blender before FBX import begins. The validator retries transient Blender `SIGSEGV`/status-11 startup crashes twice by default; override this with `BLENDER_VALIDATION_RETRIES` and `BLENDER_VALIDATION_RETRY_DELAY_MS` when debugging Blender itself. `validate:file` imports an exact FBX path, which is useful when a stale `dist` sample or manually exported file behaves differently from the generated fixtures. If Blender crashes after the retry budget, validator errors include the import path, attempt count, exit status or signal, and captured stdout/stderr so GPU-startup crashes can be separated from FBX importer failures. On macOS, crash reports whose stack starts in `supports_barycentric_whitelist`, `MTLBackend::metal_is_supported`, or `GPU_backend_type_selection_detect` are Blender Metal startup crashes before the generated FBX reaches the importer.

## Reference

Blender's built-in exporter is used as a behavioral reference only:

`/Applications/Blender.app/Contents/Resources/4.5/scripts/addons_core/io_scene_fbx`

The implementation here should stay original.
