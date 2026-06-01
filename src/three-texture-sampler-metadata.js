import { normalizeTextureAlphaSource } from "./texture-alpha.js";
import {
  normalizeTextureAnisotropy,
  normalizeTextureBlendMode,
  normalizeTextureColorSpace,
  normalizeTextureCompareFunction,
  normalizeTextureDimensionKind,
  normalizeTextureEncoding,
  normalizeTextureFilter,
  normalizeTextureFormat,
  normalizeTextureInternalFormatId,
  normalizeTextureMappingType,
  normalizeTexturePositiveInteger,
  normalizeTextureType,
  normalizeTextureTypeUse,
  normalizeTextureUnpackAlignment,
  normalizeTextureWrapMode,
  textureDimensionKindLabel
} from "./texture-metadata-normalizer.js";
import { firstField, nestedTextureSources } from "./texture-source-fields.js";

function textureUvSet(texture, fallback = "") {
  const explicit = textureSamplerField(texture, "uvSet", "uvSetName", "uvLayer");
  if (explicit) {
    return explicit;
  }
  const channel = Number(texture.channel);
  if (Number.isInteger(channel) && channel > 0) {
    return `UVMap_${channel}`;
  }
  return fallback;
}

function positiveInteger(...values) {
  for (const value of values) {
    const number = normalizeTexturePositiveInteger(value, -1);
    if (number >= 0) {
      return number;
    }
  }
  return 0;
}

function textureSamplerSources(texture) {
  return [texture?.userData, ...nestedTextureSources(texture), texture];
}

function textureSamplerField(texture, ...keys) {
  return firstField(textureSamplerSources(texture), ...keys);
}

function textureSamplerFlag(texture, ...keys) {
  return textureSamplerSources(texture).some((source) => keys.some((key) => source?.[key]));
}

function textureDimensionKind(texture) {
  const explicit = normalizeTextureDimensionKind(
    textureSamplerField(texture, "textureDimensionId", "textureDimension", "textureDimensionKind", "dimensionKind", "dimension"),
    null
  );
  if (explicit != null) {
    return explicit;
  }
  if (texture.isData3DTexture) {
    return 2;
  }
  if (texture.isDataArrayTexture || texture.isCompressedArrayTexture || texture.isDepthArrayTexture || texture.isTextureArray) {
    return 3;
  }
  if (texture.isCubeTexture || texture.isCompressedCubeTexture) {
    return 1;
  }
  return 0;
}

function textureDepth(texture, dimensionId) {
  return positiveInteger(
    texture.userData?.textureDepth,
    texture.userData?.depth,
    firstField(nestedTextureSources(texture), "textureDepth", "depth"),
    dimensionId === 0 || dimensionId === 1 ? 1 : undefined
  );
}

function textureLayers(texture, dimensionId, depth) {
  return positiveInteger(
    texture.userData?.textureLayers,
    texture.userData?.layers,
    texture.userData?.layerCount,
    firstField(nestedTextureSources(texture), "textureLayers", "layers", "layerCount"),
    dimensionId === 3 ? depth : 1
  );
}

function textureDimensionLabel(texture, dimensionId) {
  return textureSamplerField(texture, "textureDimension", "textureDimensionKind", "dimensionKind") ??
    textureDimensionKindLabel(dimensionId);
}

export function threeTextureSamplerMetadata(texture, { uvSet = "" } = {}) {
  const dimensionId = textureDimensionKind(texture);
  const depth = textureDepth(texture, dimensionId);
  return {
    wrapU: normalizeTextureWrapMode(textureSamplerField(texture, "wrapU", "wrapS")),
    wrapV: normalizeTextureWrapMode(textureSamplerField(texture, "wrapV", "wrapT")),
    wrapW: normalizeTextureWrapMode(textureSamplerField(texture, "wrapW", "wrapR")),
    uvSet: textureUvSet(texture, uvSet),
    mappingType: normalizeTextureMappingType(textureSamplerField(texture, "mappingType", "currentMappingType", "mapping")),
    uvSwap: Boolean(textureSamplerField(texture, "uvSwap", "swapUV")),
    textureTypeUse: normalizeTextureTypeUse(textureSamplerField(texture, "textureTypeUse", "currentTextureTypeUse", "typeUse")),
    useMipMap: Boolean(textureSamplerField(texture, "useMipMap", "useMipMaps", "useMipmaps", "generateMipmaps")),
    colorSpace: textureSamplerField(texture, "colorSpace", "colourSpace") ?? "",
    colorSpaceId: normalizeTextureColorSpace(
      textureSamplerField(texture, "colorSpace", "colourSpace", "colorSpaceId")
    ),
    encoding: normalizeTextureEncoding(textureSamplerField(texture, "encoding")),
    flipY: Boolean(textureSamplerField(texture, "flipY")),
    unpackAlignment: normalizeTextureUnpackAlignment(textureSamplerField(texture, "unpackAlignment")),
    minFilter: normalizeTextureFilter(textureSamplerField(texture, "minFilter"), 1008),
    magFilter: normalizeTextureFilter(textureSamplerField(texture, "magFilter"), 1006),
    anisotropy: normalizeTextureAnisotropy(textureSamplerField(texture, "anisotropy")),
    format: normalizeTextureFormat(textureSamplerField(texture, "format")),
    type: normalizeTextureType(textureSamplerField(texture, "type")),
    internalFormat: textureSamplerField(texture, "internalFormat") ?? "",
    internalFormatId: normalizeTextureInternalFormatId(textureSamplerField(texture, "internalFormatId", "internalFormat")),
    isDepthTexture: textureSamplerFlag(texture, "isDepthTexture", "depthTexture", "isDepthMap"),
    compareFunction: normalizeTextureCompareFunction(
      textureSamplerField(texture, "compareFunction", "compare", "depthCompareFunction")
    ),
    textureDimension: textureDimensionLabel(texture, dimensionId),
    textureDimensionId: dimensionId,
    textureDepth: depth,
    textureLayers: textureLayers(texture, dimensionId, depth),
    isDataTexture: textureSamplerFlag(texture, "isDataTexture", "isData3DTexture", "isDataArrayTexture", "dataTexture"),
    isCompressedTexture: textureSamplerFlag(texture, "isCompressedTexture", "isCompressedArrayTexture", "compressedTexture"),
    isTextureArray: textureSamplerFlag(texture, "isTextureArray", "isDataArrayTexture", "isCompressedArrayTexture", "isDepthArrayTexture"),
    mipmapCount: positiveInteger(textureSamplerField(texture, "mipmapCount"), texture.mipmaps?.length),
    matrixAutoUpdate: textureSamplerField(texture, "matrixAutoUpdate") ?? true,
    blendMode: normalizeTextureBlendMode(textureSamplerField(
      texture,
      "blendMode",
      "currentTextureBlendMode",
      "layerBlendMode",
      "textureLayerBlendMode"
    )),
    alphaSource: normalizeTextureAlphaSource(
      textureSamplerField(texture, "alphaSource", "textureAlphaSource", "currentAlphaSource")
    ),
    premultiplyAlpha: Boolean(
      textureSamplerField(texture, "premultiplyAlpha", "preMultiplyAlpha", "premultipliedAlpha")
    ),
    alpha: textureSamplerField(
      texture,
      "textureAlpha",
      "alpha",
      "opacity",
      "layerAlpha",
      "textureLayerAlpha",
      "layerOpacity",
      "textureLayerOpacity"
    ) ?? 1
  };
}
