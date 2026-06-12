export { FbxAsciiWriter } from "./core/ascii-writer.js";
export { FbxBinaryWriter, FbxNode, makeNode } from "./core/binary-writer.js";
export {
  createCharacterExportOptions,
  emitExportWarning,
  normalizeExportOptions,
  resolveTargetPreset
} from "./export/export-options.js";
export { assertValidFbxBinary, validateFbxBinary } from "./validation/fbx-binary-validator.js";
export { exportCharacterFbx } from "./export/character-export.js";
export { createMinimalFbxDocument, writeMinimalFbx } from "./document/minimal-document.js";
export {
  createCubeScene,
  createHierarchyScene,
  createMaterialScene,
  createMorphScene,
  createSkinnedMorphScene,
  createSkinnedCubeScene,
  createVertexColorScene,
  normalizeFbxScene
} from "./scene/scene.js";
export { fromThreeObject, isThreeObjectLike } from "./three/three-adapter.js";
export {
  textureLayerAlphaAnimationProperty,
  textureLayerBlendModeAnimationProperty
} from "./texture/texture-layer-animation-normalizer.js";
export { createStaticMeshFbxDocument, writeStaticMeshFbx } from "./document/static-document.js";

import { fromThreeObject, isThreeObjectLike } from "./three/three-adapter.js";
import { normalizeExportOptions } from "./export/export-options.js";
import { writeStaticMeshFbx } from "./document/static-document.js";

export function exportFbx(source, options = {}) {
  const exportOptions = normalizeExportOptions(options);
  const sceneOrObject = isThreeObjectLike(source) && !source.meshes
    ? fromThreeObject(source, exportOptions)
    : source;
  return writeStaticMeshFbx(sceneOrObject, exportOptions);
}
