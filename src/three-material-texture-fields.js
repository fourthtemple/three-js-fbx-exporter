const THREE_NATIVE_MATERIAL_TEXTURE_FIELDS = Object.freeze([
  ["map", "diffuseTexture"],
  ["matcap", "diffuseTexture"],
  ["gradientMap", "gradientTexture"],
  ["diffuseFactorMap", "diffuseFactorTexture"],
  ["normalMap", "normalTexture"],
  ["clearcoatNormalMap", "normalTexture"],
  ["bumpMap", "bumpTexture"],
  ["emissiveMap", "emissiveTexture"],
  ["emissiveFactorMap", "emissiveFactorTexture"],
  ["lightMap", "ambientTexture"],
  ["ambientMap", "ambientTexture"],
  ["ambientFactorMap", "ambientFactorTexture"],
  ["specularMap", "specularTexture"],
  ["specularColorMap", "specularTexture"],
  ["sheenColorMap", "specularTexture"],
  ["specularFactorMap", "specularFactorTexture"],
  ["specularIntensityMap", "specularFactorTexture"],
  ["transparentMap", "transparentTexture"],
  ["alphaMap", "alphaTexture"],
  ["transmissionMap", "transmissionTexture"],
  ["displacementMap", "displacementTexture"],
  ["vectorDisplacementMap", "vectorDisplacementTexture"],
  ["aoMap", "aoTexture"],
  ["roughnessMap", "roughnessTexture"],
  ["clearcoatRoughnessMap", "roughnessTexture"],
  ["sheenRoughnessMap", "roughnessTexture"],
  ["metalnessMap", "metalnessTexture"],
  ["clearcoatMap", "reflectionFactorTexture"],
  ["envMap", "reflectionTexture"],
  ["anisotropyMap", "anisotropyTexture"],
  ["iridescenceMap", "iridescenceTexture"],
  ["iridescenceThicknessMap", "iridescenceThicknessTexture"],
  ["thicknessMap", "thicknessTexture"]
]);

const THREE_INTERNAL_MATERIAL_TEXTURE_FIELDS = Array.from(
  new Set(THREE_NATIVE_MATERIAL_TEXTURE_FIELDS.map(([, field]) => field)),
  (field) => [field, field]
);

export const THREE_MATERIAL_TEXTURE_FIELDS = Object.freeze([
  ...THREE_NATIVE_MATERIAL_TEXTURE_FIELDS,
  ...THREE_INTERNAL_MATERIAL_TEXTURE_FIELDS
]);

export const THREE_MATERIAL_TEXTURE_PROPERTY_NAMES = Object.freeze(
  Array.from(new Set(THREE_MATERIAL_TEXTURE_FIELDS.map(([property]) => property)))
);

export const THREE_MATERIAL_TEXTURE_TRACK_PATTERN = THREE_MATERIAL_TEXTURE_PROPERTY_NAMES.join("|");
