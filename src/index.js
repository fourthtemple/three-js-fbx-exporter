export { FbxBinaryWriter, FbxNode, makeNode } from "./binary-writer.js";
export {
  createMixamoCleanupExportOptions,
  emitExportWarning,
  normalizeExportOptions
} from "./export-options.js";
export { assertValidFbxBinary, validateFbxBinary } from "./fbx-binary-validator.js";
export { exportMixamoCleanupFbx } from "./mixamo-cleanup-export.js";
export { createMinimalFbxDocument, writeMinimalFbx } from "./minimal-document.js";
export {
  createCubeScene,
  createHierarchyScene,
  createMaterialScene,
  createMorphScene,
  createSkinnedMorphScene,
  createSkinnedCubeScene,
  createVertexColorScene,
  normalizeFbxScene
} from "./scene.js";
export { fromThreeObject, isThreeObjectLike } from "./three-adapter.js";
export {
  textureLayerAlphaAnimationProperty,
  textureLayerBlendModeAnimationProperty
} from "./texture-layer-animation-normalizer.js";
export { createStaticMeshFbxDocument, writeStaticMeshFbx } from "./static-document.js";

import { fromThreeObject, isThreeObjectLike } from "./three-adapter.js";
import { normalizeExportOptions } from "./export-options.js";
import { writeStaticMeshFbx } from "./static-document.js";

export function exportFbx(source, options = {}) {
  const exportOptions = normalizeExportOptions(options);
  const sceneOrObject = isThreeObjectLike(source) && !source.meshes
    ? fromThreeObject(source, exportOptions)
    : source;
  return writeStaticMeshFbx(sceneOrObject, exportOptions);
}
