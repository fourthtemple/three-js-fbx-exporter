import { groupedLayerTextureEntries, textureLayerName } from "./texture-layer-properties.js";

const SCENE_TEXTURE_SLOT_FIELDS = Object.freeze([
  "diffuseTexture",
  "gradientTexture",
  "diffuseFactorTexture",
  "normalTexture",
  "bumpTexture",
  "emissiveTexture",
  "emissiveFactorTexture",
  "ambientTexture",
  "ambientFactorTexture",
  "specularTexture",
  "specularFactorTexture",
  "transparentTexture",
  "alphaTexture",
  "transmissionTexture",
  "displacementTexture",
  "vectorDisplacementTexture",
  "aoTexture",
  "roughnessTexture",
  "metalnessTexture",
  "reflectionFactorTexture",
  "reflectionTexture",
  "anisotropyTexture",
  "iridescenceTexture",
  "iridescenceThicknessTexture",
  "thicknessTexture"
]);

function textureKey(texture) {
  return texture?.animationName || texture?.name || "";
}

function sceneMaterialTextures(material) {
  const direct = SCENE_TEXTURE_SLOT_FIELDS.map((field) => material[field]).filter(Boolean);
  const extra = (material.textures || []).map((entry) => entry.texture || entry).filter(Boolean);
  return [...direct, ...extra];
}

function materialLayerTargets(material, textureTargets, byTexture) {
  const result = {};
  for (const group of groupedLayerTextureEntries(sceneMaterialTextures(material))) {
    const layerTarget = textureLayerName(material.animationName || material.name, group.property);
    group.textures.forEach((texture, index) => {
      const target = { target: layerTarget, index };
      const key = textureKey(texture);
      if (key) {
        byTexture.set(key, target);
      }
      for (const [field, textureName] of Object.entries(textureTargets)) {
        if (textureName === key) {
          result[field] = target;
        }
      }
    });
  }
  return result;
}

export function threeTextureLayerTargets(meshes, textureNamesByMesh) {
  const byTexture = new Map();
  const byMesh = new Map(meshes.map((mesh) => [
    mesh.name,
    mesh.materials.map((material, index) => {
      return materialLayerTargets(material, textureNamesByMesh.get(mesh.name)?.[index] || {}, byTexture);
    })
  ]));
  return { byMesh, byTexture };
}
