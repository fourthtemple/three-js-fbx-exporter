import {
  dataUrlFromTextureSource,
  extensionForMime,
  safeTextureFileName,
  textureMediaInfoFromPayload,
  texturePayloadFromSource,
} from "./texture-content.js";
import { normalizeTextureCropping } from "./texture-cropping.js";
import { normalizeTextureVideo } from "./texture-video.js";
import { normalizeTextureAtlas } from "./texture-atlas.js";
import { customMaterialPropertyEntries } from "./material-custom-properties.js";
import { textureTransformFromThreeTexture } from "./texture-transform.js";
import { normalizeMaterialClippingPlanes } from "./material-clipping.js";
import { roughnessToFbxShininess } from "./material-normalizer.js";
import {
  materialExtraCustomProperties,
  materialExtraTextureRecords
} from "./three-material-extra-textures.js";
import { threeAnimationTargetName } from "./three-animation-target-name.js";
import { threeColorToFbxColor } from "./three-color-adapter.js";
import {
  threeTextureName,
  threeTexturePath,
  threeTextureRelativePath
} from "./three-texture-source.js";
import { threeTextureSamplerMetadata } from "./three-texture-sampler-metadata.js";
import { firstField, nestedTextureSources } from "./texture-source-fields.js";
import { vector } from "./value-normalizers.js";

function texturePivot(texture, fallback, ...keys) {
  const explicit = firstField([texture.userData, ...nestedTextureSources(texture)], ...keys);
  return vector(explicit ?? fallback, 3, [0, 0, 0]);
}
function textureDimension(texture, key, naturalKey, payload) {
  const userVideo = texture.userData?.video ?? texture.userData?.media;
  const number = Number(
    texture.userData?.[key] ??
    texture.userData?.[videoDimensionKey(key)] ??
    userVideo?.[key] ??
    userVideo?.[naturalKey] ??
    userVideo?.[videoDimensionKey(key)] ??
    texture[videoDimensionKey(key)] ??
    firstField(nestedTextureSources(texture), key, naturalKey, videoDimensionKey(key)) ??
    payload?.[key]
  );
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function videoDimensionKey(key) {
  return key === "width" ? "videoWidth" : "videoHeight";
}

function materialShadingModel(material) {
  const explicit = material?.userData?.shadingModel ?? material?.shadingModel;
  if (explicit) {
    return explicit;
  }
  const type = String(material?.type || "");
  return /Lambert|Basic|Toon|Matcap|Line|Points|Sprite/.test(type) ? "Lambert" : "Phong";
}

function materialReflectionFactor(material) {
  if (material?.reflectionFactor != null) {
    return material.reflectionFactor;
  }
  if (material?.clearcoat != null && material.clearcoat !== 0) {
    return material.clearcoat;
  }
  if (material?.reflectivity != null) {
    return material.reflectivity;
  }
  if (material?.envMap && material?.envMapIntensity != null) {
    return material.envMapIntensity;
  }
  return material?.metalness ?? 0;
}

function hasMaterialSheen(material) {
  return material?.sheen != null && material.sheen !== 0;
}

function hasMaterialClearcoat(material) {
  return material?.clearcoat != null && material.clearcoat !== 0;
}

function materialSpecularColor(material) {
  if (hasMaterialSheen(material) && material?.sheenColor) {
    return material.sheenColor;
  }
  return material?.specular ?? material?.specularColor;
}

function materialSpecularFactor(material) {
  if (material?.specularFactor != null) {
    return material.specularFactor;
  }
  if (hasMaterialSheen(material)) {
    return material.sheen;
  }
  return material?.specularIntensity ?? 0.25;
}

function materialShininess(material) {
  if (material?.shininess != null) {
    return material.shininess;
  }
  if (hasMaterialSheen(material) && material?.sheenRoughness != null) {
    return roughnessToFbxShininess(material.sheenRoughness);
  }
  if (hasMaterialClearcoat(material) && material?.clearcoatRoughness != null) {
    return roughnessToFbxShininess(material.clearcoatRoughness);
  }
  return material?.roughness == null ? 20 : roughnessToFbxShininess(material.roughness);
}

function vectorScalarX(value) {
  return Array.isArray(value) ? value[0] : value?.x;
}

function materialBumpFactor(material) {
  const normalScale = vectorScalarX(material?.normalScale);
  const clearcoatNormalScale = vectorScalarX(material?.clearcoatNormalScale);
  return (material?.bumpMap && material?.bumpScale != null ? material.bumpScale : undefined) ??
    (material?.normalMap ? normalScale : undefined) ??
    (material?.clearcoatNormalMap ? clearcoatNormalScale : undefined) ??
    (material?.bumpScale != null && material.bumpScale !== 1 ? material.bumpScale : undefined) ??
    normalScale ??
    clearcoatNormalScale ??
    1;
}

function materialTextureCandidates(material, ...specs) {
  const candidates = [];
  const seen = new Set();
  for (const spec of specs) {
    const entry = typeof spec === "string" ? { key: spec } : spec;
    const texture = material?.[entry.key] ?? material?.userData?.[entry.key];
    if (!texture || seen.has(texture)) {
      continue;
    }
    seen.add(texture);
    candidates.push({ ...entry, texture });
  }
  return candidates;
}

function sceneTextureEntry(candidate, property, label) {
  return {
    property,
    label,
    texture: {
      ...textureToSceneTexture(candidate.texture, {
        uvSet: candidate.uvSet,
        rotation: candidate.rotation
      }),
      property,
      label
    }
  };
}

function materialTextureField(material, property, label, ...specs) {
  const candidates = materialTextureCandidates(material, ...specs);
  const entries = candidates.map((candidate) => sceneTextureEntry(candidate, property, label));
  return {
    texture: entries[0]?.texture || null,
    extras: entries.slice(1)
  };
}

function safeAnimationNamePart(value, fallback) {
  return String(value || fallback)
    .replace(/[\\/:*?"<>|#.[\]\s]+/g, "_")
    .replace(/^_+|_+$/g, "") || fallback;
}

function uniqueAnimationName(baseName, used) {
  let name = baseName;
  let index = 2;
  while (used.has(name)) {
    name = `${baseName}_${index}`;
    index += 1;
  }
  used.add(name);
  return name;
}

function textureFieldRecords(textureFields) {
  return Object.entries(textureFields).flatMap(([field, entry]) => {
    const records = [];
    if (entry.texture) {
      records.push({ field, texture: entry.texture });
    }
    for (const extra of entry.extras) {
      if (extra.texture) {
        records.push({ field, texture: extra.texture });
      }
    }
    return records;
  });
}

function textureAnimationKey(texture) {
  return texture?.animationName || texture?.name || "";
}

function disambiguateTextureAnimationTargets(materialName, textureFields) {
  const records = textureFieldRecords(textureFields);
  const counts = new Map();
  for (const { texture } of records) {
    const key = textureAnimationKey(texture);
    if (key) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  const used = new Set(records.flatMap(({ texture }) => [
    texture.name,
    texture.animationName
  ].filter(Boolean)));

  for (const { field, texture } of records) {
    const key = textureAnimationKey(texture);
    if (!key || counts.get(key) <= 1 || texture.animationName) {
      continue;
    }
    const baseName = [
      safeAnimationNamePart(materialName, "Material"),
      safeAnimationNamePart(texture.label || field, "Texture"),
      safeAnimationNamePart(texture.name, "Texture")
    ].join("_");
    texture.animationName = uniqueAnimationName(baseName, used);
  }
}

function materialIridescenceThickness(material, index, fallback) {
  const range = material?.iridescenceThicknessRange;
  return Array.isArray(range) || ArrayBuffer.isView(range) ? range[index] ?? fallback : fallback;
}

function materialFlag(value, fallback = 0) {
  return value == null ? fallback : value ? 1 : 0;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function positiveInteger(value) {
  const number = positiveNumber(value);
  return number > 0 ? Math.round(number) : 0;
}

function videoWithMediaInfo(video, mediaInfo) {
  const frameRate = positiveNumber(video.frameRate) || positiveNumber(mediaInfo.frameRate);
  const duration = positiveNumber(video.duration) || positiveNumber(mediaInfo.duration);
  const derivedFrameCount = duration > 0 && frameRate > 0 ? Math.round(duration * frameRate) : 0;
  const frameCount = positiveInteger(video.frameCount) || positiveInteger(mediaInfo.frameCount) || derivedFrameCount;
  return {
    ...video,
    frameRate,
    ...(duration > 0 ? { duration } : {}),
    stopFrame: positiveInteger(video.stopFrame) || positiveInteger(mediaInfo.stopFrame) || frameCount,
    lastFrame: positiveInteger(video.lastFrame) || positiveInteger(mediaInfo.lastFrame) || frameCount,
    ...(frameCount > 0 ? { frameCount } : {})
  };
}

function normalizeTextureContent(value) {
  if (value == null || value === "") {
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
  return value;
}

function textureContentFromSource(texture, payload) {
  const candidates = [
    texture.userData?.content,
    texture.userData?.bytes,
    texture.userData?.data,
    texture.content,
    texture.bytes,
    texture.data,
    payload?.content
  ];
  for (const candidate of candidates) {
    const content = normalizeTextureContent(candidate);
    if (content) {
      return content;
    }
  }
  return null;
}

function textureMimeType(texture, payload) {
  return payload?.mimeType ??
    texture.userData?.mimeType ??
    texture.userData?.mediaType ??
    texture.userData?.contentType ??
    texture.mimeType ??
    texture.mediaType ??
    texture.contentType ??
    "";
}

function textureCustomProperties(texture) {
  return firstField(
    [texture?.userData, texture, ...nestedTextureSources(texture)],
    "customProperties",
    "fbxCustomProperties",
    "textureCustomProperties"
  );
}

function textureAlpha(texture) {
  return firstField([
    texture?.userData,
    ...nestedTextureSources(texture),
    texture
  ], "layerAlpha", "textureLayerAlpha", "layerOpacity", "textureLayerOpacity", "textureAlpha", "blendAlpha", "alpha", "opacity");
}

function materialCustomProperties(material) {
  const authored = material?.userData?.customProperties ??
    material?.userData?.fbxCustomProperties ??
    material?.userData?.materialCustomProperties ??
    material?.customProperties ??
    material?.fbxCustomProperties ??
    material?.materialCustomProperties;
  return [
    ...customMaterialPropertyEntries(authored),
    ...materialExtraCustomProperties(material)
  ];
}

export function textureToSceneTexture(texture, { uvSet = "", rotation = null } = {}) {
  const dataUrl = dataUrlFromTextureSource(texture);
  const payload = texturePayloadFromSource(texture);
  const name = threeTextureName(texture);
  const sourcePath = threeTexturePath(texture);
  const content = textureContentFromSource(texture, payload);
  const mimeType = textureMimeType(texture, payload);
  const mediaInfo = textureMediaInfoFromPayload(mimeType, content);
  const contentExtension = content && mimeType ? extensionForMime(mimeType) : null;
  const fileName = dataUrl
    ? safeTextureFileName(name, payload?.extension)
    : sourcePath || (payload ? safeTextureFileName(name, payload.extension) : contentExtension ? safeTextureFileName(name, contentExtension) : "");
  const video = videoWithMediaInfo(normalizeTextureVideo(texture, Boolean(content)), mediaInfo);
  const transform = textureTransformFromThreeTexture(texture);
  const atlas = normalizeTextureAtlas(texture);
  const textureRotation = rotation == null ? transform.rotation : vector(rotation, 3, [0, 0, 0]);
  const pivotFallback = transform.fromMatrix ? null : texture.center ?? texture.userData?.center ?? texture.userData?.image?.center ?? texture.userData?.source?.center ?? texture.userData?.source?.data?.center ?? texture.image?.center ?? texture.source?.center ?? texture.source?.data?.center;
  return {
    name,
    animationName: threeAnimationTargetName(texture) || null,
    fileName,
    relativeFileName: dataUrl || !sourcePath ? fileName : threeTextureRelativePath(texture),
    content,
    mimeType,
    ...threeTextureSamplerMetadata(texture, { uvSet }),
    ...(atlas ? {
      atlasColumns: atlas.columns,
      atlasRows: atlas.rows,
      atlasFrameCount: atlas.frameCount,
      atlasFrame: atlas.frame,
      atlasColumn: atlas.column,
      atlasRow: atlas.row,
      atlasOrigin: atlas.origin
    } : {}),
    alpha: textureAlpha(texture),
    width: textureDimension(texture, "width", "naturalWidth", payload) || mediaInfo.width || 0,
    height: textureDimension(texture, "height", "naturalHeight", payload) || mediaInfo.height || 0,
    ...video,
    cropping: normalizeTextureCropping(texture),
    translation: transform.translation,
    rotation: textureRotation,
    scale: transform.scale,
    rotationPivot: texturePivot(texture, pivotFallback, "textureRotationPivot", "rotationPivot", "pivot", "center"),
    scalingPivot: texturePivot(texture, pivotFallback, "textureScalingPivot", "scalingPivot", "pivot", "center"),
    customProperties: textureCustomProperties(texture)
  };
}

export function materialToSceneMaterial(material, index) {
  const extraTextureFields = Object.fromEntries(materialExtraTextureRecords(material).map((record) => [
    record.field,
    {
      texture: {
        ...sceneTextureEntry(record, record.property, record.label).texture,
        sourceTextureField: record.field,
        sourceUniformName: record.uniformName
      },
      extras: []
    }
  ]));
  const textureFields = {
    diffuseTexture: materialTextureField(material, "DiffuseColor", "Diffuse", "map", "matcap", "diffuseTexture", "texture"),
    gradientTexture: materialTextureField(material, "Maya|TEX_gradient_map", "Gradient", "gradientMap", "gradientTexture"),
    diffuseFactorTexture: materialTextureField(material, "DiffuseFactor", "DiffuseFactor", "diffuseFactorMap", "diffuseFactorTexture"),
    normalTexture: materialTextureField(material, "NormalMap", "Normal", "normalMap", "clearcoatNormalMap", "normalTexture"),
    bumpTexture: materialTextureField(material, "Bump", "Bump", "bumpMap", "bumpTexture"),
    emissiveTexture: materialTextureField(material, "EmissiveColor", "Emissive", "emissiveMap", "emissiveTexture"),
    emissiveFactorTexture: materialTextureField(material, "EmissiveFactor", "EmissiveFactor", "emissiveFactorMap", "emissiveFactorTexture"),
    ambientTexture: materialTextureField(
      material,
      "AmbientColor",
      "Ambient",
      "ambientMap",
      "ambientTexture",
      { key: "lightMap", uvSet: "UVMap_1" }
    ),
    ambientFactorTexture: materialTextureField(material, "AmbientFactor", "AmbientFactor", "ambientFactorMap", "ambientFactorTexture"),
    specularTexture: materialTextureField(
      material,
      "SpecularColor",
      "Specular",
      "specularMap",
      "specularColorMap",
      "sheenColorMap",
      "specularTexture"
    ),
    specularFactorTexture: materialTextureField(
      material,
      "SpecularFactor",
      "SpecularFactor",
      "specularFactorMap",
      "specularIntensityMap",
      "specularFactorTexture"
    ),
    transparentTexture: materialTextureField(material, "TransparentColor", "Transparent", "transparentMap", "transparentTexture"),
    alphaTexture: materialTextureField(material, "TransparencyFactor", "Alpha", "alphaMap", "alphaTexture"),
    transmissionTexture: materialTextureField(material, "TransparencyFactor", "Transmission", "transmissionMap", "transmissionTexture"),
    displacementTexture: materialTextureField(material, "DisplacementColor", "Displacement", "displacementMap", "displacementTexture"),
    vectorDisplacementTexture: materialTextureField(
      material,
      "VectorDisplacementColor",
      "VectorDisplacement",
      "vectorDisplacementMap",
      "vectorDisplacementTexture"
    ),
    aoTexture: materialTextureField(
      material,
      "Maya|TEX_ao_map",
      "AmbientOcclusion",
      { key: "aoMap", uvSet: "UVMap_1" },
      { key: "aoTexture", uvSet: "UVMap_1" }
    ),
    roughnessTexture: materialTextureField(
      material,
      "ShininessExponent",
      "Roughness",
      "roughnessMap",
      "clearcoatRoughnessMap",
      "sheenRoughnessMap",
      "roughnessTexture"
    ),
    metalnessTexture: materialTextureField(material, "ReflectionFactor", "Metalness", "metalnessMap", "metalnessTexture"),
    reflectionFactorTexture: materialTextureField(material, "ReflectionFactor", "ReflectionFactor", "clearcoatMap", "reflectionFactorTexture"),
    reflectionTexture: materialTextureField(
      material,
      "ReflectionColor",
      "Reflection",
      { key: "envMap", rotation: material?.envMapRotation },
      { key: "reflectionTexture", rotation: material?.envMapRotation }
    ),
    anisotropyTexture: materialTextureField(material, "Maya|TEX_anisotropy_map", "Anisotropy", "anisotropyMap", "anisotropyTexture"),
    iridescenceTexture: materialTextureField(material, "Maya|TEX_iridescence_map", "Iridescence", "iridescenceMap", "iridescenceTexture"),
    iridescenceThicknessTexture: materialTextureField(
      material,
      "Maya|TEX_iridescence_thickness_map",
      "IridescenceThickness",
      "iridescenceThicknessMap",
      "iridescenceThicknessTexture"
    ),
    thicknessTexture: materialTextureField(material, "Maya|TEX_thickness_map", "Thickness", "thicknessMap", "thicknessTexture"),
    ...extraTextureFields
  };
  disambiguateTextureAnimationTargets(material?.name || `Material_${index + 1}`, textureFields);
  const extraTextures = Object.entries(textureFields).flatMap(([field, entry]) => {
    const dynamicTexture = field.includes(":") && entry.texture ? [entry.texture] : [];
    return [...dynamicTexture, ...entry.extras];
  });
  const opacity = material?.transparent ? material.opacity ?? 1 : material?.opacity ?? 1;
  const transparencyFactor = material?.transparencyFactor ??
    material?.transparentFactor ??
    material?.userData?.transparencyFactor ??
    material?.userData?.transparentFactor ??
    (material?.transmission != null && material.transmission !== 0 ? material.transmission : undefined) ??
    1 - opacity;
  return {
    name: material?.name || `Material_${index + 1}`,
    animationName: threeAnimationTargetName(material) || null,
    shadingModel: materialShadingModel(material),
    diffuseColor: threeColorToFbxColor(material?.color),
    emissiveColor: threeColorToFbxColor(material?.emissive, [0, 0, 0]),
    emissiveFactor: material?.emissiveIntensity ?? 1,
    ambientFactor: material?.ambientFactor ?? material?.lightMapIntensity ?? 1,
    specularColor: threeColorToFbxColor(materialSpecularColor(material), [0.2, 0.2, 0.2]),
    specularFactor: materialSpecularFactor(material),
    transparentColor: threeColorToFbxColor(material?.transparentColor ?? material?.userData?.transparentColor, [0, 0, 0]),
    blendColor: threeColorToFbxColor(material?.blendColor, [0, 0, 0]),
    shininess: materialShininess(material),
    bumpFactor: materialBumpFactor(material),
    displacementFactor: material?.displacementScale ?? 1,
    vectorDisplacementFactor: material?.vectorDisplacementScale ?? material?.userData?.vectorDisplacementScale ?? material?.userData?.vectorDisplacementFactor ?? 1,
    reflectionFactor: materialReflectionFactor(material),
    anisotropy: material?.anisotropy ?? 0,
    anisotropyRotation: material?.anisotropyRotation ?? 0,
    iridescence: material?.iridescence ?? 0,
    iridescenceIOR: material?.iridescenceIOR ?? 1.3,
    iridescenceThicknessMinimum: materialIridescenceThickness(material, 0, 100),
    iridescenceThicknessMaximum: materialIridescenceThickness(material, 1, 400),
    thickness: material?.thickness ?? 0,
    attenuationColor: threeColorToFbxColor(material?.attenuationColor, [1, 1, 1]),
    attenuationDistance: material?.attenuationDistance ?? 0,
    ior: material?.ior ?? 1.5,
    dispersion: material?.dispersion ?? 0,
    aoMapIntensity: material?.aoMapIntensity ?? 1,
    displacementBias: material?.displacementBias ?? 0,
    alphaTest: material?.alphaTest ?? 0,
    normalMapType: material?.normalMapType ?? 0,
    side: material?.side ?? 0,
    blending: material?.blending ?? 1,
    blendSrc: material?.blendSrc ?? 204,
    blendDst: material?.blendDst ?? 205,
    blendEquation: material?.blendEquation ?? 100,
    blendSrcAlpha: material?.blendSrcAlpha ?? -1,
    blendDstAlpha: material?.blendDstAlpha ?? -1,
    blendEquationAlpha: material?.blendEquationAlpha ?? -1,
    blendAlpha: material?.blendAlpha ?? 0,
    depthFunc: material?.depthFunc ?? 3,
    depthTest: materialFlag(material?.depthTest, 1),
    depthWrite: materialFlag(material?.depthWrite, 1),
    colorWrite: materialFlag(material?.colorWrite, 1),
    vertexColors: materialFlag(material?.vertexColors, 0),
    fog: materialFlag(material?.fog, 1),
    materialVisible: materialFlag(material?.visible, 1),
    allowOverride: materialFlag(material?.allowOverride, 1),
    shadowSide: material?.shadowSide ?? -1,
    polygonOffset: materialFlag(material?.polygonOffset, 0),
    polygonOffsetFactor: material?.polygonOffsetFactor ?? 0,
    polygonOffsetUnits: material?.polygonOffsetUnits ?? 0,
    stencilWrite: materialFlag(material?.stencilWrite, 0),
    stencilWriteMask: material?.stencilWriteMask ?? 255,
    stencilFunc: material?.stencilFunc ?? 519,
    stencilRef: material?.stencilRef ?? 0,
    stencilFuncMask: material?.stencilFuncMask ?? 255,
    stencilFail: material?.stencilFail ?? 7680,
    stencilZFail: material?.stencilZFail ?? 7680,
    stencilZPass: material?.stencilZPass ?? 7680,
    clipIntersection: materialFlag(material?.clipIntersection, 0),
    clipShadows: materialFlag(material?.clipShadows, 0),
    clippingPlaneCount: material?.clippingPlanes?.length ?? 0,
    alphaHash: materialFlag(material?.alphaHash, 0),
    alphaToCoverage: materialFlag(material?.alphaToCoverage, 0),
    premultipliedAlpha: materialFlag(material?.premultipliedAlpha, 0),
    forceSinglePass: materialFlag(material?.forceSinglePass, 0),
    toneMapped: materialFlag(material?.toneMapped, 1),
    dithering: materialFlag(material?.dithering, 0),
    wireframe: materialFlag(material?.wireframe, 0),
    wireframeLinewidth: material?.wireframeLinewidth ?? material?.linewidth ?? 1,
    clippingPlanes: normalizeMaterialClippingPlanes(material?.clippingPlanes),
    customProperties: materialCustomProperties(material),
    opacity,
    transparencyFactor,
    ...Object.fromEntries(Object.entries(textureFields)
      .filter(([field]) => !field.includes(":"))
      .map(([field, entry]) => [field, entry.texture])),
    textures: extraTextures
  };
}
