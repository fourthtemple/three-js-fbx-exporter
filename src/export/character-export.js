import { createCharacterExportOptions } from "./export-options.js";
import { writeStaticMeshFbx } from "../document/static-document.js";
import { fromThreeObject } from "../three/three-adapter.js";

function sourceObjectFromInput(input) {
  return input?.object3D || input?.scene || input?.root || input;
}

function exportOptionsFromInput(input = {}, options = {}) {
  return createCharacterExportOptions({
    ...options,
    ...(input.animations ? { animations: input.animations } : {}),
    ...(input.frameRate ? { frameRate: input.frameRate } : {})
  });
}

export function exportCharacterFbx(input, options = {}) {
  const source = sourceObjectFromInput(input);
  if (!source) {
    throw new Error("exportCharacterFbx requires a Three.js Object3D, Scene, or { object3D } input");
  }
  const exportOptions = exportOptionsFromInput(input, options);
  const scene = fromThreeObject(source, exportOptions);
  return writeStaticMeshFbx(scene, exportOptions);
}
