# Blender FBX Exporter Reference Map

Reference source:

`/Applications/Blender.app/Contents/Resources/4.5/scripts/addons_core/io_scene_fbx`

Use this only as a behavioral map. Do not copy GPL implementation code into this project.

## Files

- `export_fbx_bin.py`: main binary export pipeline.
- `encode_bin.py`: low-level FBX binary encoder.
- `data_types.py`: binary primitive and array types.
- `fbx_utils.py`: UUID/key generation, object wrappers, animation curve wrappers, matrix conversion, template helpers.
- `parse_fbx.py`: useful for round-trip validation and fixture introspection.

## First-Class Feature Areas

- Binary tree writer:
  - header magic
  - 32-bit node records for FBX 7400
  - property encodings
  - nested child null records
  - final root null record/footer behavior

- Scene graph:
  - `Model` nodes for mesh, null, camera, light, and limb nodes
  - `NodeAttribute` nodes for geometry attributes and skeleton limbs
  - object-to-attribute connections
  - parent-child model connections
  - `RotationOffset`, `RotationPivot`, `ScalingOffset`, and `ScalingPivot` model properties
  - `RotationOrder`, `PreRotation`, `PostRotation`, `GeometricTranslation`, `GeometricRotation`, and `GeometricScaling`
  - `Visibility` model property
  - custom `Model` properties for exporter/editor metadata on meshes, nulls, cameras, lights, and limbs
  - camera `CameraProjectionType` and `OrthoZoom`

- Global settings:
  - axis and unit metadata
  - `TimeMode`
  - `TimeSpanStart`
  - `TimeSpanStop`
  - `CustomFrameRate`

- Definitions:
  - one `ObjectType` per emitted FBX object kind
  - `PropertyTemplate` defaults for models, geometry, materials, textures, videos, layered textures, node attributes, skin/morph deformers, poses, and animation records

- Relations:
  - one top-level `Relations` child for each emitted `Objects` child
  - relation entries carry the same FBX object display name and class label used by models, geometry, materials, textures, videos, deformers, poses, and animation records

- Mesh geometry:
  - `LayerElementNormal`
  - `LayerElementBinormal`
  - `LayerElementTangent`
  - `LayerElementUV`
  - `LayerElementColor`
  - `LayerElementMaterial`

- Texture mapping:
  - `Translation`
  - `Rotation`
  - `Scaling`
  - `TextureRotationPivot`
  - `TextureScalingPivot`
  - `CurrentMappingType`
  - `TextureTypeUse`
  - `TransparentColor` and `TransparencyFactor` texture connections both represent transparency-map lanes.
  - `AlphaSource`
  - `PremultiplyAlpha`
  - `UseMipMap`
  - `UVSwap`
  - `WrapModeU`
  - `WrapModeV`
  - `CroppingLeft`, `CroppingTop`, `CroppingRight`, `CroppingBottom`
  - Blender-compatible mapping uses inverse FBX `Scaling` and negated FBX `Rotation`.
  - Blender maps roughness textures from `ShininessExponent` and metallic textures from `ReflectionFactor`/`ReflectionColor`.
  - Vector displacement uses `VectorDisplacementColor` texture connections and `VectorDisplacementFactor` material curves.
  - Material factor textures can connect to `DiffuseFactor`, `EmissiveFactor`, `AmbientFactor`, and `SpecularFactor`; ambient color textures use `AmbientColor`.
  - Repeated textures on one material property can be represented with `LayeredTexture`, `BlendModes`, and `Alphas`; exporter-authored `Maya|layer_alpha_<index>` and `Maya|layer_blend_mode_<index>` scalar mirrors keep those layer controls animatable.
  - Texture nodes can carry exporter-authored custom scalar, string, boolean, vector, and color properties.

- Texture media:
  - `Video` carries `Width`, `Height`, `Path`, and `AccessMode` properties.
  - Embedded image/video dimensions are extracted from PNG, JPEG, TGA, BMP, GIF, WebP, TIFF, EXR, HDR/Radiance, AVIF/HEIC/HEIF, MP4/MOV, WebM, Ogg Theora, DDS, KTX, and KTX2 headers when available.
  - Packed MP4/MOV sample timing, WebM default-duration metadata, and Ogg Theora frame-rate headers can populate `Video.FrameRate` when explicit texture metadata is absent.
  - Packed MP4/MOV sample counts and WebM segment duration plus default frame duration can seed `Video.StopFrame` and `Video.LastFrame` when explicit texture metadata is absent.
  - Raw one/two/RGB/RGBA-channel image buffers are converted to uncompressed RGB/RGBA TGA before being packed into `Video.Content`.
  - `Video` image sequence metadata uses `StartFrame`, `StopFrame`, `Offset`, `PlaySpeed`, `FreeRunning`, `Loop`, `InterlaceMode`, `ImageSequence`, `ImageSequenceOffset`, `FrameRate`, and `LastFrame`.
  - Embedded texture bytes use `Video.Content`; file-backed textures remain disk access unless an explicit access mode is supplied. Common video, image, and GPU texture MIME payloads keep media extensions such as `mp4`, `webm`, `ogv`, `mov`, `avif`, `svg`, `tiff`, `exr`, `dds`, `ktx`, and `ktx2` when packed.

- Skinning:
  - `Pose` / `BindPose`
  - limb `Model` nodes use the same FBX transform metadata as other models, including pivots and pre/post rotations.
  - explicit mesh bind matrices and inverse bone bind matrices can drive bind pose, `Transform`, and `TransformLink` values.
  - `Deformer` / `Skin`
  - `Deformer` / `Cluster`
  - cluster `Indexes`, `Weights`, `Transform`, `TransformLink`, `TransformAssociateModel`

- Animation:
  - `AnimationStack`
  - `AnimationLayer`
  - one animation stack can own multiple animation layers, each with its own curve-node children
  - custom scalar, vector, vector-component, and color `Model` properties can be animated through normal `AnimationCurveNode` property connections
  - layer properties: `Weight`, `Mute`, `Solo`, `Lock`, `Color`, `BlendMode`, `RotationAccumulationMode`, `ScaleAccumulationMode`
  - `AnimationCurveNode`
  - `AnimationCurve`
  - stack properties: `LocalStart`, `LocalStop`, `ReferenceStart`, `ReferenceStop`
  - `KeyTime`, `KeyValueFloat`, `KeyAttrFlags`, `KeyAttrDataFloat`, `KeyAttrRefCount`
  - interpolation flags: constant, linear, cubic
  - tangent data: right slope, next-left slope, right weight, next-left weight; vector tracks can provide channel-specific tangent values for X/Y/Z curves
  - transform curves: `Lcl Translation`, `Lcl Rotation`, `Lcl Scaling`
  - model transform metadata curves: `RotationOffset`, `RotationPivot`, `PreRotation`, `PostRotation`, `ScalingOffset`, `ScalingPivot`, `GeometricTranslation`, `GeometricRotation`, `GeometricScaling`
  - model curves: `Visibility`
  - material curves: `DiffuseColor`, `EmissiveColor`, `AmbientColor`, `SpecularColor`, `TransparentColor`
  - material scalar curves: `Opacity`, `TransparencyFactor`, `DiffuseFactor`, `EmissiveFactor`, `AmbientFactor`, `SpecularFactor`, `Shininess`, `BumpFactor`, `DisplacementFactor`, `VectorDisplacementFactor`, `ReflectionFactor`
  - texture curves: `Translation`, `Rotation`, `Scaling`, `TextureRotationPivot`, `TextureScalingPivot`, `CroppingLeft`, `CroppingTop`, `CroppingRight`, `CroppingBottom`, `Texture alpha`, `WrapModeU`, `WrapModeV`, `CurrentMappingType`, `CurrentTextureBlendMode`, `TextureTypeUse`, `AlphaSource`, `UseMipMap`, `UVSwap`, `PremultiplyAlpha`
  - custom texture scalar, vector, vector-component, and color properties can be connected as texture animation curve nodes.
  - baked texture matrix animation is decomposed into `Translation`, `Rotation`, and `Scaling` texture curves before FBX emission.
  - video curves: `Width`, `Height`, `AccessMode`, `StartFrame`, `StopFrame`, `Offset`, `PlaySpeed`, `FreeRunning`, `Loop`, `InterlaceMode`, `ImageSequence`, `ImageSequenceOffset`, `FrameRate`, `LastFrame`
  - camera curves: `FocalLength`, `FocusDistance`, `OrthoZoom`
  - light curves: `Color`, `Intensity`, `FarAttenuationEnd`, `InnerAngle`, `OuterAngle`
  - morph curves: `DeformPercent`
  - morph `Shape` geometry can carry sparse `Indexes`, `Vertices`, and `Normals` deltas.

Blender 4.5's FBX importer only maps material animation for `DiffuseColor`; opacity curves are still written as FBX material curves for consumers that support them.
Blender 4.5 imports static orthographic camera `OrthoZoom`, but does not bind `OrthoZoom` animation curves into actions; those curves are emitted for FBX consumers that support them.
Blender and Three.js import light transform animation, but do not currently import light attribute animation; those curves are emitted for FBX consumers that support them.
Blender and Three.js import static texture transforms, but do not currently import texture transform animation; those curves are emitted for FBX consumers that support them.

## Blender Source Anchors

These names are stable entry points to study:

- `fbx_data_bindpose_element`
- `fbx_data_armature_elements`
- `fbx_data_object_elements`
- `fbx_data_animation_elements`
- `AnimationCurveNodeWrapper`
- `ObjectWrapper`
- `get_blender_bindpose_key`
- `get_blender_armature_skin_key`
- `get_blender_bone_cluster_key`
- `get_blender_anim_stack_key`
- `get_blender_anim_layer_key`
- `get_blender_anim_curve_node_key`
- `get_blender_anim_curve_key`

## Milestones

1. Write valid minimal binary FBX sections.
2. Export static hierarchy and transforms.
3. Export static mesh geometry and material connections.
4. Export UVs, vertex colors, and tangent-space layers.
5. Export armature model/limb hierarchy.
6. Export bind poses and skin clusters.
7. Export baked transform animation curves.
8. Validate through Blender import and Three.js `FBXLoader`.
