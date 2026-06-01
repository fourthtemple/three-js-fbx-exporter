import { materialTextureTargetSources } from "./three-material-texture-target-sources.js";
import { threeAnimationTargetName } from "./three-animation-target-name.js";
import { threeTrackTargetName } from "./three-track-path.js";

function addAlias(aliases, collisions, alias, exportName, { overwrite = false } = {}) {
  if (!alias || collisions.has(alias)) {
    return;
  }
  const existing = aliases.get(alias);
  if (existing && existing !== exportName) {
    aliases.delete(alias);
    collisions.add(alias);
    return;
  }
  if (overwrite || !existing) {
    aliases.set(alias, exportName);
  }
}

function addPathLeafAlias(aliases, collisions, name, exportName) {
  const leaf = threeTrackTargetName(name);
  if (leaf && leaf !== name) {
    addAlias(aliases, collisions, leaf, exportName);
  }
}

function addSkeletonTargetAliases(aliases, collisions, meshes) {
  for (const mesh of meshes) {
    for (const bone of mesh.skin?.bones || []) {
      addAlias(aliases, collisions, bone.sourceName, bone.name);
      addAlias(aliases, collisions, bone.name, bone.name);
      addAlias(aliases, collisions, bone.sourceUuid, bone.name);
      addPathLeafAlias(aliases, collisions, bone.name, bone.name);
    }
  }
}

function addSourceTargetAliases(aliases, collisions, source, exportName) {
  if (!source || !exportName) {
    return;
  }
  addAlias(aliases, collisions, exportName, exportName, { overwrite: true });
  addAlias(aliases, collisions, threeAnimationTargetName(source), exportName);
  if (source.uuid) {
    addAlias(aliases, collisions, source.uuid, exportName, { overwrite: true });
  }
  if (source.name) {
    addAlias(aliases, collisions, source.name, exportName);
    addPathLeafAlias(aliases, collisions, source.name, exportName);
  }
}

function addMaterialTextureTargetAliases(
  aliases,
  collisions,
  sourceMaterialsByMesh,
  materialNamesByMesh,
  textureNamesByMesh
) {
  for (const { source, target } of materialTextureTargetSources(
    sourceMaterialsByMesh,
    materialNamesByMesh,
    textureNamesByMesh
  )) {
    addSourceTargetAliases(aliases, collisions, source, target);
  }
}

export function trackTargetAliasesFor({
  objects,
  exportNameByObject,
  meshes = [],
  sourceMaterialsByMesh = new Map(),
  materialNamesByMesh = new Map(),
  textureNamesByMesh = new Map()
}) {
  const aliases = new Map();
  const collisions = new Set();
  for (const object of objects) {
    const exportName = exportNameByObject.get(object);
    if (!exportName) {
      continue;
    }
    addAlias(aliases, collisions, exportName, exportName, { overwrite: true });
    if (object.uuid) {
      addAlias(aliases, collisions, object.uuid, exportName, { overwrite: true });
    }
    if (object.name) {
      addAlias(aliases, collisions, object.name, exportName);
      addPathLeafAlias(aliases, collisions, object.name, exportName);
    }
  }
  addSkeletonTargetAliases(aliases, collisions, meshes);
  addMaterialTextureTargetAliases(
    aliases,
    collisions,
    sourceMaterialsByMesh,
    materialNamesByMesh,
    textureNamesByMesh
  );
  return aliases;
}
