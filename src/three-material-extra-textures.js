import {
  cubeTextureFaceCustomProperties,
  cubeTextureFaceRecords
} from "./three-cube-texture-adapter.js";
import {
  shaderUniformCustomProperties,
  shaderUniformTextureRecords
} from "./three-shader-uniform-adapter.js";

export function materialExtraTextureRecords(material) {
  return [
    ...shaderUniformTextureRecords(material),
    ...cubeTextureFaceRecords(material)
  ];
}

export function materialExtraCustomProperties(material) {
  return [
    ...shaderUniformCustomProperties(material),
    ...cubeTextureFaceCustomProperties(material)
  ];
}
