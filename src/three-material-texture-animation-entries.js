import { materialAnimationClipEntries } from "./three-material-animation-clips.js";
import { materialExtraTextureRecords } from "./three-material-extra-textures.js";
import { THREE_MATERIAL_TEXTURE_FIELDS } from "./three-material-texture-fields.js";
import { animationEntryForRootTargets } from "./three-animation-root-entries.js";
import { textureAnimationClipEntries } from "./three-texture-animation-clips.js";

function directAnimationEntry(entry, rootTrackTarget) {
  return rootTrackTarget ? { clip: entry.clip, rootTrackTarget: `${rootTrackTarget}.${entry.rootSuffix}` } : null;
}

function textureAnimationEntry(entry, textureNames) {
  return animationEntryForRootTargets(
    entry.clip,
    textureNames.map((name) => `${name}.${entry.rootSuffix}`),
    { forceClone: entry.rootSuffix !== "__texture" }
  );
}

function extraTextureTargetsBySourceTexture(records, textureTargets) {
  const targetsBySource = new Map();
  for (const record of records) {
    const textureName = textureTargets[record.field];
    if (!record.sourceTexture || !textureName) {
      continue;
    }
    targetsBySource.set(record.sourceTexture, [
      ...(targetsBySource.get(record.sourceTexture) || []),
      textureName
    ]);
  }
  return targetsBySource;
}

export function collectMaterialTextureAnimationEntries(meshes, sourceMaterialsByMesh, materialNamesByMesh, textureNamesByMesh) {
  const entries = [];
  for (const mesh of meshes) {
    const sourceMaterials = sourceMaterialsByMesh.get(mesh.name) || [];
    for (const [materialIndex, material] of sourceMaterials.entries()) {
      const materialName = materialNamesByMesh.get(mesh.name)?.[materialIndex] || "";
      for (const materialClipEntry of materialAnimationClipEntries(material)) {
        const entry = directAnimationEntry(materialClipEntry, materialName);
        if (entry) {
          entries.push(entry);
        }
      }

      const textureTargets = textureNamesByMesh.get(mesh.name)?.[materialIndex] || {};
      const extraTextureRecords = materialExtraTextureRecords(material);
      const extraTargetsBySource = extraTextureTargetsBySourceTexture(extraTextureRecords, textureTargets);
      const animatedTextures = new Set();
      for (const record of extraTextureRecords) {
        const textureName = textureTargets[record.field];
        const animationEntries = textureAnimationClipEntries(record.texture);
        if (!animationEntries.length || !textureName || animatedTextures.has(record.texture)) {
          continue;
        }
        animatedTextures.add(record.texture);
        for (const entry of animationEntries) {
          const animationEntry = textureAnimationEntry(entry, [textureName]);
          if (animationEntry) {
            entries.push(animationEntry);
          }
        }
      }
      for (const [threeField] of THREE_MATERIAL_TEXTURE_FIELDS) {
        const texture = material?.[threeField] ?? material?.userData?.[threeField];
        const textureName = textureTargets[threeField];
        const textureNames = [
          textureName,
          ...(extraTargetsBySource.get(texture) || [])
        ].filter(Boolean);
        const animationEntries = textureAnimationClipEntries(texture);
        if (!animationEntries.length || !textureNames.length || animatedTextures.has(texture)) {
          continue;
        }
        animatedTextures.add(texture);
        for (const animationEntry of animationEntries) {
          const entry = textureAnimationEntry(animationEntry, textureNames);
          if (entry) {
            entries.push(entry);
          }
        }
      }
    }
  }
  return entries;
}
