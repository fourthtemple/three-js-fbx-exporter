export function textureLayerSuffix(property) {
  return String(property || "Texture")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "") || "Texture";
}

export function textureLayerName(material, property) {
  const materialName = typeof material === "string" ? material : material?.name;
  return `${materialName || "Material"}${textureLayerSuffix(property)}Layer`;
}

export function textureLayerAlphaProperty(index) {
  return `Maya|layer_alpha_${index}`;
}

export function textureLayerBlendModeProperty(index) {
  return `Maya|layer_blend_mode_${index}`;
}

function textureProperty(entry) {
  return entry?.texture?.property || entry?.property || "DiffuseColor";
}

export function groupedLayerTextureEntries(textureEntries = []) {
  const groups = new Map();
  for (const entry of textureEntries) {
    const property = textureProperty(entry);
    if (!groups.has(property)) {
      groups.set(property, []);
    }
    groups.get(property).push(entry);
  }
  return Array.from(groups.entries())
    .filter(([, textures]) => textures.length > 1)
    .map(([property, textures]) => ({ property, textures }));
}

export function textureLayerTargetNames(meshes = []) {
  return meshes.flatMap((mesh) => {
    return mesh.materials.flatMap((material) => {
      const materialNames = [material.name, material.animationName].filter(Boolean);
      return groupedLayerTextureEntries(material.textures).flatMap((group) => {
        return materialNames.map((name) => textureLayerName(name, group.property));
      });
    });
  });
}
