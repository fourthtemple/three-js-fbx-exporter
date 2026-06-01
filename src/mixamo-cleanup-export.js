import { createMixamoCleanupExportOptions } from "./export-options.js";
import { writeStaticMeshFbx } from "./static-document.js";
import { fromThreeObject } from "./three-adapter.js";

function sourceObjectFromInput(input) {
  return input?.object3D || input?.scene || input?.root || input;
}

function exportOptionsFromInput(input = {}, options = {}) {
  return createMixamoCleanupExportOptions({
    ...options,
    ...(input.animations ? { animations: input.animations } : {}),
    ...(input.frameRate ? { frameRate: input.frameRate } : {})
  });
}

export function exportMixamoCleanupFbx(input, options = {}) {
  const source = sourceObjectFromInput(input);
  if (!source) {
    throw new Error("exportMixamoCleanupFbx requires a Three.js Object3D, Scene, or { object3D } input");
  }
  const exportOptions = exportOptionsFromInput(input, options);
  const scene = fromThreeObject(source, exportOptions);
  return writeStaticMeshFbx(scene, exportOptions);
}
