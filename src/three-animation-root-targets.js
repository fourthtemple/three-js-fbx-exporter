import { materialTextureTargetSources } from "./three-material-texture-target-sources.js";

function addRootTarget(map, source, target, rootSuffix) {
  if (!source || !target) {
    return;
  }
  const rootTarget = `${target}.${rootSuffix}`;
  const targets = map.get(source) || [];
  if (!targets.includes(rootTarget)) {
    targets.push(rootTarget);
    map.set(source, targets);
  }
}

export function materialTextureAnimationRootTargets(sourceMaterialsByMesh, materialNamesByMesh, textureNamesByMesh) {
  const targetsBySource = new Map();
  for (const { source, target, rootSuffix } of materialTextureTargetSources(
    sourceMaterialsByMesh,
    materialNamesByMesh,
    textureNamesByMesh
  )) {
    addRootTarget(targetsBySource, source, target, rootSuffix);
  }
  return targetsBySource;
}

export function animationRootTargets(target, {
  exportNameByObject,
  skeletonBoneNameByObject,
  materialTextureRootTargets
}) {
  if (!target) {
    return [];
  }
  if (typeof target === "string") {
    return [target];
  }
  const objectTarget = exportNameByObject.get(target) || skeletonBoneNameByObject.get(target);
  if (objectTarget) {
    return [objectTarget];
  }
  return materialTextureRootTargets?.get(target) || [];
}
