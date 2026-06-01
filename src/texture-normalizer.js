import {
  dataUrlFromTextureSource,
  extensionForMime,
  safeTextureFileName,
  textureMediaInfoFromPayload,
  texturePayloadFromSource
} from "./texture-content.js";
import { emitExportWarning } from "./export-options.js";
import {
  normalizeTextureAlpha,
  normalizeTextureAlphaSource
} from "./texture-alpha.js";
import { normalizeTextureCropping } from "./texture-cropping.js";
import { normalizeCustomTextureProperties } from "./texture-custom-properties.js";
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
  normalizeTexturePositiveInteger,
  normalizeTextureMappingType,
  normalizeTextureType,
  normalizeTextureTypeUse,
  normalizeTextureUnpackAlignment,
  normalizeTextureWrapMode,
  textureDimensionKindLabel
} from "./texture-metadata-normalizer.js";
import { normalizeTextureVideo } from "./texture-video.js";
import { firstField, nestedTextureSources, textureFieldWithSources } from "./texture-source-fields.js";
import { normalizeTextureTransform, transformMode } from "./texture-transform.js";
import {
  normalizeTextureAtlas,
  textureTransformWithAtlasFrame
} from "./texture-atlas.js";
import { vector } from "./value-normalizers.js";

const MATERIAL_TEXTURE_SLOTS = Object.freeze([
  ["diffuseTexture", "DiffuseColor", "Diffuse"],
  ["gradientTexture", "Maya|TEX_gradient_map", "Gradient"],
  ["diffuseFactorTexture", "DiffuseFactor", "DiffuseFactor"],
  ["normalTexture", "NormalMap", "Normal"],
  ["bumpTexture", "Bump", "Bump"],
  ["emissiveTexture", "EmissiveColor", "Emissive"],
  ["emissiveFactorTexture", "EmissiveFactor", "EmissiveFactor"],
  ["ambientTexture", "AmbientColor", "Ambient"],
  ["ambientFactorTexture", "AmbientFactor", "AmbientFactor"],
  ["specularTexture", "SpecularColor", "Specular"],
  ["specularFactorTexture", "SpecularFactor", "SpecularFactor"],
  ["transparentTexture", "TransparentColor", "Transparent"],
  ["alphaTexture", "TransparencyFactor", "Alpha"],
  ["transmissionTexture", "TransparencyFactor", "Transmission"],
  ["displacementTexture", "DisplacementColor", "Displacement"],
  ["vectorDisplacementTexture", "VectorDisplacementColor", "VectorDisplacement"],
  ["aoTexture", "Maya|TEX_ao_map", "AmbientOcclusion"],
  ["roughnessTexture", "ShininessExponent", "Roughness"],
  ["metalnessTexture", "ReflectionFactor", "Metalness"],
  ["reflectionFactorTexture", "ReflectionFactor", "ReflectionFactor"],
  ["reflectionTexture", "ReflectionColor", "Reflection"],
  ["anisotropyTexture", "Maya|TEX_anisotropy_map", "Anisotropy"],
  ["iridescenceTexture", "Maya|TEX_iridescence_map", "Iridescence"],
  ["iridescenceThicknessTexture", "Maya|TEX_iridescence_thickness_map", "IridescenceThickness"],
  ["thicknessTexture", "Maya|TEX_thickness_map", "Thickness"]
]);

export function normalizeMaterialTextures(material, materialName, options = {}) {
  const textures = [];
  const diffuseFallback = material.diffuseTexture ?? material.texture ?? material.map;
  for (const [field, property, label] of MATERIAL_TEXTURE_SLOTS) {
    const source = field === "diffuseTexture" ? diffuseFallback : material[field];
    const texture = normalizeTexture(source, property, label, options);
    if (texture) {
      textures.push({
        ...texture,
        name: texture.name || `${materialName}${label}`,
        property
      });
    }
  }
  for (const textureSource of material.textures || []) {
    const property = textureSource.property || textureSource.fbxProperty || "DiffuseColor";
    const texture = normalizeTexture(textureSource.texture ?? textureSource, property, textureSource.label, options);
    if (texture) {
      const normalized = { ...texture, property };
      if (!textures.some((candidate) => sameTextureBinding(candidate, normalized))) {
        textures.push(normalized);
      }
    }
  }
  return textures;
}

export function normalizeTexture(texture, property = "DiffuseColor", label = "Texture", options = {}) {
  if (!texture) {
    return null;
  }
  const payload = texturePayloadFromSource(texture);
  if (typeof texture === "string") {
    const name = payload ? label : textureNameFromPath(texture);
    const fileName = payload ? safeTextureFileName(name, payload.extension) : texture;
    const resolved = resolveTexturePayload(fileName, {
      texture,
      name,
      property,
      label,
      fileName,
      relativeFileName: fileName
    }, options);
    const content = payload?.content || resolved?.content || null;
    const dimensions = textureMediaDimensions(null, payload, resolved, content);
    const video = textureVideoMetadata(null, payload, resolved, content, Boolean(content));
    return {
      name,
      animationName: null,
      property,
      label,
      fileName,
      relativeFileName: fileName,
      wrapU: "clamp",
      wrapV: "clamp",
      wrapW: "clamp",
      uvSet: "",
      mappingType: 0,
      uvSwap: false,
      textureTypeUse: 0,
      useMipMap: false,
      colorSpace: "",
      colorSpaceId: 0,
      encoding: 0,
      flipY: false,
      unpackAlignment: 4,
      minFilter: 1008,
      magFilter: 1006,
      anisotropy: 1,
      format: 1023,
      type: 1009,
      internalFormat: "",
      internalFormatId: 0,
      isDepthTexture: false,
      compareFunction: 0,
      textureDimension: "2d",
      textureDimensionId: 0,
      textureDepth: 1,
      textureLayers: 1,
      isDataTexture: false,
      isCompressedTexture: false,
      isTextureArray: false,
      mipmapCount: 0,
      matrixAutoUpdate: true,
      alphaSource: 0,
      width: dimensions.width,
      height: dimensions.height,
      ...video,
      cropping: normalizeTextureCropping(),
      customProperties: [],
      blendMode: 0,
      alpha: 1,
      rotationPivot: [0, 0, 0],
      scalingPivot: [0, 0, 0],
      mimeType: payload?.mimeType || resolved?.mimeType || "",
      content
    };
  }
  const fileName = textureSourcePath(texture);
  const hasDataUrlPath = Boolean(dataUrlFromTextureSource(fileName));
  const baseName = texture.name ||
    texture.userData?.name ||
    texture.image?.name ||
    firstField(nestedTextureSources(texture), "name") ||
    textureNameFromPath(hasDataUrlPath ? label : fileName);
  const explicitContent = normalizeBytes(textureField(texture, "content", "data", "bytes"));
  const explicitMimeType = textureField(texture, "mimeType", "mediaType", "contentType") || payload?.mimeType || "";
  const generatedExtension = payload?.extension || (explicitContent && explicitMimeType ? extensionForMime(explicitMimeType) : null);
  const exportFileName = hasDataUrlPath || (!fileName && payload)
    ? safeTextureFileName(baseName, generatedExtension)
    : !fileName && generatedExtension
      ? safeTextureFileName(baseName, generatedExtension)
    : fileName;
  const relativeFileName = textureRelativePath(texture, exportFileName);
  const atlas = normalizeTextureAtlas(texture);
  const transform = atlas
    ? transformMode(textureTransformWithAtlasFrame(
        normalizeTextureTransform(texture, { ...options, textureTransformMode: "direct" }),
        atlas
      ), options)
    : normalizeTextureTransform(texture, options);
  const pivotFallback = transform.fromMatrix
    ? null
    : texture.pivot ?? texture.center ?? texture.userData?.pivot ?? texture.userData?.center ?? firstField(nestedTextureSources(texture), "center");
  const resolved = explicitContent || payload?.content
    ? null
    : resolveTexturePayload(exportFileName, {
      texture,
      name: baseName,
      property,
      label,
      fileName: exportFileName,
      relativeFileName
    }, options);
  const content = explicitContent || payload?.content || resolved?.content || null;
  const dimensions = textureMediaDimensions(texture, payload, resolved, content);
  const video = textureVideoMetadata(texture, payload, resolved, content, Boolean(content));
  const dimensionId = textureDimensionKind(texture);
  const textureDepth = textureDepthValue(texture, dimensionId);
  const textureLayers = textureLayerCount(texture, dimensionId, textureDepth);
  return {
    name: baseName,
    animationName: texture.animationName ?? texture.animationTarget ?? texture.targetName ?? null,
    property: texture.property || texture.fbxProperty || property,
    label: texture.label || label,
    fileName: exportFileName,
    relativeFileName: dataUrlFromTextureSource(relativeFileName) ? exportFileName : relativeFileName,
    wrapU: normalizeTextureWrapMode(textureFieldWithSources(texture, "wrapU", "wrapS"), "clamp"),
    wrapV: normalizeTextureWrapMode(textureFieldWithSources(texture, "wrapV", "wrapT"), "clamp"),
    wrapW: normalizeTextureWrapMode(textureFieldWithSources(texture, "wrapW", "wrapR"), "clamp"),
    uvSet: textureFieldWithSources(texture, "uvSet", "uvSetName", "uvLayer") || "",
    mappingType: normalizeTextureMappingType(textureFieldWithSources(texture, "mappingType", "currentMappingType", "mapping")),
    uvSwap: Boolean(textureFieldWithSources(texture, "uvSwap", "swapUV")),
    textureTypeUse: normalizeTextureTypeUse(textureFieldWithSources(texture, "textureTypeUse", "currentTextureTypeUse", "typeUse")),
    useMipMap: Boolean(textureFieldWithSources(texture, "useMipMap", "useMipMaps", "useMipmaps", "generateMipmaps")),
    colorSpace: textureFieldWithSources(texture, "colorSpace", "colourSpace") ?? "",
    colorSpaceId: normalizeTextureColorSpace(textureFieldWithSources(texture, "colorSpace", "colourSpace", "colorSpaceId")),
    encoding: normalizeTextureEncoding(textureFieldWithSources(texture, "encoding")),
    flipY: Boolean(textureFieldWithSources(texture, "flipY")),
    unpackAlignment: normalizeTextureUnpackAlignment(textureFieldWithSources(texture, "unpackAlignment")),
    minFilter: normalizeTextureFilter(textureFieldWithSources(texture, "minFilter"), 1008),
    magFilter: normalizeTextureFilter(textureFieldWithSources(texture, "magFilter"), 1006),
    anisotropy: normalizeTextureAnisotropy(textureFieldWithSources(texture, "anisotropy")),
    format: normalizeTextureFormat(textureFieldWithSources(texture, "format")),
    type: normalizeTextureType(textureFieldWithSources(texture, "type")),
    internalFormat: textureFieldWithSources(texture, "internalFormat", "internalFormatName") ?? "",
    internalFormatId: normalizeTextureInternalFormatId(textureFieldWithSources(texture, "internalFormatId", "internalFormat")),
    isDepthTexture: Boolean(textureFieldWithSources(texture, "isDepthTexture", "depthTexture", "isDepthMap")),
    compareFunction: normalizeTextureCompareFunction(
      textureFieldWithSources(texture, "compareFunction", "compare", "depthCompareFunction")
    ),
    textureDimension: textureField(texture, "textureDimension", "textureDimensionKind", "dimensionKind") ??
      firstField(nestedTextureSources(texture), "textureDimension", "textureDimensionKind", "dimensionKind") ??
      textureDimensionKindLabel(dimensionId),
    textureDimensionId: dimensionId,
    textureDepth,
    textureLayers,
    isDataTexture: Boolean(textureFieldWithSources(texture, "isDataTexture", "isData3DTexture", "isDataArrayTexture", "dataTexture")),
    isCompressedTexture: Boolean(textureFieldWithSources(texture, "isCompressedTexture", "isCompressedArrayTexture", "compressedTexture")),
    isTextureArray: Boolean(textureFieldWithSources(texture, "isTextureArray", "isDataArrayTexture", "isCompressedArrayTexture", "isDepthArrayTexture")),
    mipmapCount: normalizeTexturePositiveInteger(textureFieldWithSources(texture, "mipmapCount") ?? texture.mipmaps?.length, 0),
    matrixAutoUpdate: Boolean(textureFieldWithSources(texture, "matrixAutoUpdate") ?? true),
    atlasColumns: atlas?.columns ?? 0,
    atlasRows: atlas?.rows ?? 0,
    atlasFrameCount: atlas?.frameCount ?? 0,
    atlasFrame: atlas?.frame ?? 0,
    atlasColumn: atlas?.column ?? 0,
    atlasRow: atlas?.row ?? 0,
    atlasOrigin: atlas?.origin ?? "",
    width: dimensions.width,
    height: dimensions.height,
    ...video,
    cropping: normalizeTextureCropping(texture),
    blendMode: normalizeTextureBlendMode(textureFieldWithSources(
      texture,
      "blendMode",
      "currentTextureBlendMode",
      "layerBlendMode",
      "textureLayerBlendMode"
    )),
    alpha: normalizeTextureAlpha(textureFieldWithSources(
      texture,
      "textureAlpha",
      "blendAlpha",
      "alpha",
      "opacity",
      "layerAlpha",
      "textureLayerAlpha",
      "layerOpacity",
      "textureLayerOpacity"
    )),
    alphaSource: normalizeTextureAlphaSource(textureFieldWithSources(texture, "alphaSource", "textureAlphaSource", "currentAlphaSource")),
    premultiplyAlpha: Boolean(textureFieldWithSources(texture, "premultiplyAlpha", "preMultiplyAlpha", "premultipliedAlpha")),
    translation: transform.translation,
    rotation: transform.rotation,
    scale: transform.scale,
    rotationPivot: normalizeTexturePivot(
      texture.rotationPivot ??
      texture.textureRotationPivot ??
      texture.userData?.rotationPivot ??
      texture.userData?.textureRotationPivot ?? firstField(nestedTextureSources(texture), "rotationPivot", "textureRotationPivot") ??
      pivotFallback
    ),
    scalingPivot: normalizeTexturePivot(
      texture.scalingPivot ??
      texture.textureScalingPivot ??
      texture.userData?.scalingPivot ??
      texture.userData?.textureScalingPivot ?? firstField(nestedTextureSources(texture), "scalingPivot", "textureScalingPivot") ??
      pivotFallback
    ),
    customProperties: normalizeCustomTextureProperties(textureCustomProperties(texture)),
    mimeType: explicitMimeType || resolved?.mimeType || "",
    content
  };
}

function firstText(...values) {
  return values.find((value) => typeof value === "string" && value.length) || "";
}

function textureField(texture, ...keys) {
  for (const source of [texture, texture?.userData]) {
    for (const key of keys) {
      if (source?.[key] != null) {
        return source[key];
      }
    }
  }
  return undefined;
}

function textureFlag(texture, ...keys) {
  for (const source of [texture, texture?.userData]) {
    if (keys.some((key) => source?.[key])) {
      return true;
    }
  }
  return false;
}

function textureSourcePath(texture) {
  const nestedPath = firstField(nestedTextureSources(texture), "src", "currentSrc", "url", "href", "path", "fileName");
  const nestedRelativePath = firstField(nestedTextureSources(texture), "relativeFileName", "relativePath", "relativeUrl");
  return firstText(
    texture.userData?.src,
    texture.userData?.currentSrc,
    texture.userData?.url,
    texture.userData?.href,
    texture.userData?.path,
    texture.userData?.fileName,
    texture.src,
    texture.currentSrc,
    texture.url,
    texture.href,
    texture.fileName,
    texture.path,
    nestedPath,
    texture.userData?.relativeFileName,
    texture.userData?.relativePath,
    texture.userData?.relativeUrl,
    texture.relativeFileName,
    texture.relativePath,
    texture.relativeUrl,
    nestedRelativePath
  );
}

function textureRelativePath(texture, fallback) {
  const nestedRelativePath = firstField(nestedTextureSources(texture), "relativeFileName", "relativePath", "relativeUrl");
  return firstText(
    texture.userData?.relativeFileName,
    texture.userData?.relativePath,
    texture.userData?.relativeUrl,
    texture.relativeFileName,
    texture.relativePath,
    texture.relativeUrl,
    nestedRelativePath,
    fallback
  );
}

function textureCustomProperties(texture) {
  return firstField(
    [texture, texture?.userData, ...nestedTextureSources(texture)],
    "customProperties",
    "fbxCustomProperties",
    "textureCustomProperties"
  );
}

function textureNameFromPath(path) {
  if (dataUrlFromTextureSource(path)) {
    return "Texture";
  }
  return String(path || "Texture").split(/[\\/]/).pop().replace(/\.[^.]+$/, "") || "Texture";
}

function sameTextureBinding(a, b) {
  return a.property === b.property &&
    a.name === b.name &&
    a.fileName === b.fileName &&
    a.relativeFileName === b.relativeFileName;
}

function normalizeBytes(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

function resolveTexturePayload(fileName, context, options) {
  const resolver = options.resolveTextureContent || options.textureContentResolver;
  if (!resolver || !fileName || dataUrlFromTextureSource(fileName)) {
    warnUnresolvedEmbeddedTexture(fileName, context, options);
    return null;
  }
  const result = resolver(fileName, context);
  if (result && typeof result.then === "function") {
    throw new Error("resolveTextureContent must be synchronous because exportFbx returns Uint8Array synchronously");
  }
  const payload = normalizeResolvedTexturePayload(result);
  if (!payload) {
    warnUnresolvedEmbeddedTexture(fileName, context, options);
  }
  return payload;
}

function warnUnresolvedEmbeddedTexture(fileName, context, options) {
  if (!options.embedTextures || !fileName || dataUrlFromTextureSource(fileName)) {
    return;
  }
  emitExportWarning(options, {
    code: "texture.embed.unresolved",
    message: `Texture "${fileName}" was not embedded because no synchronous content resolver returned bytes.`,
    fileName,
    textureName: context?.name || "",
    property: context?.property || ""
  });
}

function normalizeResolvedTexturePayload(value) {
  if (!value) {
    return null;
  }
  const bytes = normalizeBytes(value.content ?? value.data ?? value.bytes ?? value);
  if (!bytes) {
    return null;
  }
  return {
    content: bytes,
    mimeType: value.mimeType || "",
    ...textureMediaInfoFromPayload(value.mimeType, bytes)
  };
}

function normalizeTextureDimension(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function firstPositiveDimension(...values) {
  for (const value of values) {
    const dimension = normalizeTextureDimension(value);
    if (dimension > 0) {
      return dimension;
    }
  }
  return 0;
}

function textureDimensionKind(texture = {}) {
  const dimension = textureField(texture, "textureDimensionId", "textureDimension", "textureDimensionKind", "dimensionKind", "dimension") ??
    firstField(nestedTextureSources(texture), "textureDimensionId", "textureDimension", "textureDimensionKind", "dimensionKind", "dimension");
  const explicit = normalizeTextureDimensionKind(
    dimension,
    null
  );
  if (explicit != null) {
    return explicit;
  }
  if (textureFlag(texture, "isData3DTexture", "texture3D", "volumeTexture")) {
    return 2;
  }
  if (textureFlag(texture, "isTextureArray", "isDataArrayTexture", "isCompressedArrayTexture", "isDepthArrayTexture")) {
    return 3;
  }
  if (textureFlag(texture, "isCubeTexture", "isCompressedCubeTexture", "cubeTexture")) {
    return 1;
  }
  return 0;
}

function textureDepthValue(texture = {}, dimensionId = 0) {
  return firstPositiveDimension(
    textureField(texture, "textureDepth", "depth"),
    firstField(nestedTextureSources(texture), "textureDepth", "depth"),
    dimensionId === 0 || dimensionId === 1 ? 1 : undefined
  );
}

function textureLayerCount(texture = {}, dimensionId = 0, textureDepth = 1) {
  return firstPositiveDimension(
    textureField(texture, "textureLayers", "layers", "layerCount"),
    firstField(nestedTextureSources(texture), "textureLayers", "layers", "layerCount"),
    dimensionId === 3 ? textureDepth : 1
  );
}

function firstPositiveNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) {
      return number;
    }
  }
  return 0;
}

function firstPositiveInteger(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) {
      return Math.round(number);
    }
  }
  return 0;
}

function textureMediaInfo(texture, payload, resolved, content) {
  return textureMediaInfoFromPayload(textureField(texture, "mimeType", "mediaType", "contentType") || payload?.mimeType || resolved?.mimeType, content);
}

function textureVideoMetadata(texture, payload, resolved, content, hasContent) {
  const video = normalizeTextureVideo(texture, hasContent);
  const parsed = textureMediaInfo(texture, payload, resolved, content);
  return {
    ...video,
    frameRate: firstPositiveNumber(video.frameRate, payload?.frameRate, resolved?.frameRate, parsed.frameRate),
    duration: firstPositiveNumber(video.duration, payload?.duration, resolved?.duration, parsed.duration),
    stopFrame: firstPositiveInteger(video.stopFrame, payload?.stopFrame, resolved?.stopFrame, parsed.stopFrame),
    lastFrame: firstPositiveInteger(video.lastFrame, payload?.lastFrame, resolved?.lastFrame, parsed.lastFrame),
    frameCount: firstPositiveInteger(video.frameCount, texture?.frameCount, payload?.frameCount, resolved?.frameCount, parsed.frameCount)
  };
}

function textureMediaDimensions(texture, payload, resolved, content) {
  const parsed = textureMediaInfo(texture, payload, resolved, content);
  return {
    width: firstPositiveDimension(
      textureField(texture, "width", "videoWidth", "naturalWidth"),
      texture?.image?.width,
      texture?.image?.naturalWidth,
      texture?.image?.videoWidth,
      firstField(nestedTextureSources(texture), "width", "naturalWidth", "videoWidth"),
      payload?.width,
      resolved?.width,
      parsed.width
    ),
    height: firstPositiveDimension(
      textureField(texture, "height", "videoHeight", "naturalHeight"),
      texture?.image?.height,
      texture?.image?.naturalHeight,
      texture?.image?.videoHeight,
      firstField(nestedTextureSources(texture), "height", "naturalHeight", "videoHeight"),
      payload?.height,
      resolved?.height,
      parsed.height
    )
  };
}

function normalizeTexturePivot(value) {
  return vector(value, 3, [0, 0, 0]);
}
