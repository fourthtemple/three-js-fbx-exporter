import { threeTextureName } from "./three-texture-source.js";
import { customMaterialAnimationProperty } from "./material-custom-properties.js";

const CUBE_FACES = Object.freeze([
  ["px", "PositiveX"],
  ["nx", "NegativeX"],
  ["py", "PositiveY"],
  ["ny", "NegativeY"],
  ["pz", "PositiveZ"],
  ["nz", "NegativeZ"]
]);

function safeNamePart(value, fallback) {
  return String(value || fallback)
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "") || fallback;
}

function firstCubeFaceArray(...candidates) {
  return candidates.find((candidate) => Array.isArray(candidate) && candidate.length) || [];
}

function cubeTextureImages(texture) {
  return firstCubeFaceArray(
    texture?.images,
    texture?.image,
    texture?.source,
    texture?.source?.images,
    texture?.source?.data,
    texture?.userData?.images,
    texture?.userData?.image,
    texture?.userData?.source,
    texture?.userData?.source?.images,
    texture?.userData?.source?.data
  );
}

function isCubeTexture(texture) {
  return Boolean(texture?.isCubeTexture || texture?.type === "CubeTexture" || cubeTextureImages(texture).length >= 6);
}

function parentFaceUserData(parent) {
  const {
    animations,
    image,
    source,
    video,
    media,
    element,
    mediaElement,
    ...userData
  } = parent?.userData || {};
  return userData;
}

function imageTextureSource(parent, image, face) {
  const parentName = threeTextureName(parent, "CubeTexture");
  const faceName = `${safeNamePart(parentName, "CubeTexture")}_${face}`;
  const imageObject = typeof image === "string" ? { src: image } : image;
  return {
    name: imageObject?.name || faceName,
    userData: {
      ...parentFaceUserData(parent),
      ...(imageObject?.userData || {}),
      name: imageObject?.name || faceName
    },
    image: imageObject,
    source: { data: imageObject },
    src: imageObject?.src,
    currentSrc: imageObject?.currentSrc,
    url: imageObject?.url,
    href: imageObject?.href,
    path: imageObject?.path,
    fileName: imageObject?.fileName,
    relativeFileName: imageObject?.relativeFileName,
    relativePath: imageObject?.relativePath,
    relativeUrl: imageObject?.relativeUrl,
    animations: imageObject?.animations,
    colorSpace: parent?.colorSpace,
    encoding: parent?.encoding,
    flipY: parent?.flipY,
    format: parent?.format,
    type: parent?.type,
    internalFormat: parent?.internalFormat,
    mapping: parent?.mapping,
    wrapS: parent?.wrapS,
    wrapT: parent?.wrapT,
    offset: parent?.offset,
    repeat: parent?.repeat,
    center: parent?.center,
    rotation: parent?.rotation,
    matrix: parent?.matrix,
    matrixAutoUpdate: parent?.matrixAutoUpdate,
    channel: parent?.channel,
    uvSet: parent?.uvSet,
    uvSetName: parent?.uvSetName,
    uvLayer: parent?.uvLayer,
    magFilter: parent?.magFilter,
    minFilter: parent?.minFilter,
    anisotropy: parent?.anisotropy,
    generateMipmaps: parent?.generateMipmaps
  };
}

function sourceCubeTextureCandidates(material) {
  const candidates = [
    ["envMap", material?.envMap],
    ["reflectionTexture", material?.reflectionTexture],
    ["userData.envMap", material?.userData?.envMap],
    ["userData.reflectionTexture", material?.userData?.reflectionTexture]
  ];
  const seen = new Set();
  return candidates.filter(([, texture]) => {
    if (!isCubeTexture(texture) || seen.has(texture)) {
      return false;
    }
    seen.add(texture);
    return true;
  });
}

export function cubeTextureFaceRecords(material) {
  return sourceCubeTextureCandidates(material).flatMap(([field, texture]) => {
    const faces = cubeTextureImages(texture);
    const baseName = safeNamePart(threeTextureName(texture, "CubeTexture"), "CubeTexture");
    return CUBE_FACES.flatMap(([face, label], index) => {
      const image = faces[index];
      return image ? [{
        uniformName: `${field}.${face}`,
        field: `cubeTexture:${field}:${face}`,
        property: `Maya|TEX_cube_${baseName}_${face}`,
        label: `Cube${label}`,
        rotation: material?.envMapRotation,
        sourceTexture: texture,
        texture: imageTextureSource(texture, image, face)
      }] : [];
    });
  });
}

export function cubeTextureFaceCustomProperties(material) {
  return cubeTextureFaceRecords(material).map((record) => ({
    name: record.property,
    kind: "scalar",
    value: 1,
    animationProperty: customMaterialAnimationProperty("scalar", record.property)
  }));
}
