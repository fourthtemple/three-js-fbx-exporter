# Architecture

This exporter is organized as a set of small feature modules around a stable pipeline:

1. Public facade
2. Three.js adapters
3. Internal scene model and normalizers
4. FBX document builders
5. Binary writer

The direction of dependencies should follow that order. Low-level modules should not know about high-level input formats, and format-specific adapters should not write FBX nodes directly.

## Layers

`index.js` is the public facade. It accepts either a Three.js-like object tree or the internal scene model, then delegates to the document coordinator.

`three-*.js` files adapt Three.js concepts into the internal scene model. They may depend on normalizers and value helpers, but not on FBX document builders or the binary writer.

`*-normalizer.js` files and small value modules coerce loose input into deterministic internal data. They should stay free of Three.js traversal and FBX node serialization.

`*-document.js` files build FBX node records and connections. They should depend on normalized internal data, not on Three.js objects.

`binary-writer.js` owns binary FBX encoding only. It should not learn about meshes, animations, materials, or Three.js.

`definition-document.js` is the sole owner of FBX `Definitions` object-type counts. Feature document builders should expose record counts, while `definition-document.js` turns those into one `ObjectType` entry per emitted FBX object kind. `definition-templates.js` owns the default `PropertyTemplate` records for those object types.

`relation-document.js` owns the top-level FBX `Relations` table and mirrors the object records emitted by feature document builders without owning connection semantics.

## Extension Rule

When adding a new FBX feature, prefer this shape:

- add a focused normalizer for the internal data shape
- add a Three.js adapter only if the feature needs Three.js-specific extraction
- add a focused document builder for FBX nodes/connections
- add tests at the layer where the behavior belongs

If a file starts needing unrelated helper functions or knows too much about multiple layers, split the helper into a small module before adding the feature.

When two adapters need the same format-specific lookup table, keep that table in a small adapter-owned module. For example, Three.js material texture property mapping lives outside the object walker and texture-animation parser so a new texture slot can be added once and remain consistent across static export and animated tracks.

When a material feature needs non-native texture lanes, keep the feature extraction separate and aggregate it through `three-material-extra-textures.js`. Shader uniforms and CubeTexture faces follow that pattern: the main material adapter only consumes generic texture records and custom material properties.

When a feature needs arbitrary exporter-authored FBX properties, keep the naming and animation prefixes beside the matching domain normalizer. Model custom properties live in `model-custom-properties.js`; material custom properties live in `material-custom-properties.js`; texture custom properties live in `texture-custom-properties.js`.

When Three.js animation tracks need to address object-map custom properties, keep the path grammar in a focused adapter helper. Model property paths live in `three-model-custom-property-path.js`; material property paths live in `three-material-custom-property-path.js`; texture property paths live in `three-texture-custom-property-path.js`.

When Three.js clips can be owned by adjacent objects such as `userData`, media sources, or material wrappers, collect those owner records through `three-animation-clip-owners.js`. Domain modules such as `three-object-animation-clips.js`, `three-material-animation-clips.js`, and `three-texture-animation-clips.js` decide which owners matter; the shared helper only handles de-duplication and metadata passthrough.

When animation target names need to bridge Three.js object/material/texture identity and exported FBX object names, keep that alias graph in `three-animation-target-aliases.js`. The main adapter should pass it source objects and normalized target maps instead of owning collision behavior directly.

Bare material, texture, and texture media animation paths such as `MaterialName.opacity`, `TextureName.offset`, or `ImageName.currentTime` should stay in `three-material-animation-adapter.js` and `three-texture-animation-adapter.js`. Those parsers may recognize the local property shape, but final identity resolution must still pass through `three-animation-target-aliases.js` so duplicate and user-provided aliases keep one collision policy.

When option-provided clips need a root object, keep material/texture root resolution in `three-animation-root-targets.js` and shared source/target enumeration in `three-material-texture-target-sources.js`. Material- and texture-adjacent owner lists belong in `three-material-animation-owners.js` and `three-texture-animation-owners.js` so discovered clips and option-provided roots share the same suffixes. The main adapter should assemble the maps once and pass them to animation conversion.

When one local clip needs to fan out to multiple exported targets, use `three-animation-root-entries.js` instead of duplicating track-cloning logic in adapters. This keeps discovered material/texture clips and option-provided clips on the same multi-root behavior.

## Guardrails

`test/architecture-boundaries.test.js` enforces two mechanical limits:

- production source files must stay under the line budget
- adapters, normalizers, and document writers must not import across forbidden layer boundaries

These checks are intentionally simple. They are there to make architectural drift loud before a feature becomes difficult to extract.
