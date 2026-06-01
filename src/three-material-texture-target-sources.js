import { materialAnimationOwners } from "./three-material-animation-owners.js";
import { materialExtraTextureRecords } from "./three-material-extra-textures.js";
import { THREE_MATERIAL_TEXTURE_FIELDS } from "./three-material-texture-fields.js";
import { textureAnimationOwners } from "./three-texture-animation-owners.js";

function addOwnerEntry(entries, seenTargetsBySource, kind, source, target, rootSuffix) {
  if (!source || !target) {
    return;
  }
  let seenTargets = seenTargetsBySource.get(source);
  if (!seenTargets) {
    seenTargets = new Set();
    seenTargetsBySource.set(source, seenTargets);
  }
  const seenKey = `${kind}:${target}`;
  if (seenTargets.has(seenKey)) {
    return;
  }
  seenTargets.add(seenKey);
  entries.push({ kind, source, target, rootSuffix });
}

function addOwnerEntries(entries, seenTargetsBySource, kind, source, target, owners) {
  if (!source || !target) {
    return;
  }
  for (const { owner, rootSuffix } of owners(source)) {
    if (owner) {
      addOwnerEntry(entries, seenTargetsBySource, kind, owner, target, rootSuffix);
    }
  }
}

export function materialTextureTargetSources(sourceMaterialsByMesh, materialNamesByMesh, textureNamesByMesh) {
  const entries = [];
  const seenTargetsBySource = new Map();
  for (const [meshName, sourceMaterials] of sourceMaterialsByMesh) {
    const materialNames = materialNamesByMesh.get(meshName) || [];
    const textureNamesByMaterial = textureNamesByMesh.get(meshName) || [];
    for (const [materialIndex, material] of sourceMaterials.entries()) {
      const materialTarget = materialNames[materialIndex];
      addOwnerEntries(entries, seenTargetsBySource, "material", material, materialTarget, materialAnimationOwners);

      const textureTargets = textureNamesByMaterial[materialIndex] || {};
      for (const [threeField] of THREE_MATERIAL_TEXTURE_FIELDS) {
        const texture = material?.[threeField] ?? material?.userData?.[threeField];
        addOwnerEntries(entries, seenTargetsBySource, "texture", texture, textureTargets[threeField], textureAnimationOwners);
      }
      for (const record of materialExtraTextureRecords(material)) {
        addOwnerEntries(entries, seenTargetsBySource, "texture", record.texture, textureTargets[record.field], textureAnimationOwners);
        addOwnerEntries(entries, seenTargetsBySource, "texture", record.sourceTexture, textureTargets[record.field], textureAnimationOwners);
      }
    }
  }
  return entries;
}
