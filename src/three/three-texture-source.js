import { firstField, nestedTextureSources } from "../texture/texture-source-fields.js";

function firstText(...values) {
  return values.find((value) => typeof value === "string" && value.length) || "";
}

const TEXTURE_PATH_KEYS = Object.freeze(["src", "currentSrc", "url", "href", "path", "fileName"]);
const TEXTURE_RELATIVE_PATH_KEYS = Object.freeze(["relativeFileName", "relativePath", "relativeUrl"]);

function firstTextureArrayPath(...values) {
  for (const value of values) {
    if (!Array.isArray(value)) {
      continue;
    }
    const path = firstText(...value.flatMap((source) => [
      source?.src,
      source?.currentSrc,
      source?.url,
      source?.href,
      source?.path,
      source?.fileName,
      source?.relativeFileName,
      source?.relativePath,
      source?.relativeUrl
    ]));
    if (path) {
      return path;
    }
  }
  return "";
}

function isDataUrl(value) {
  return /^data:/i.test(String(value || ""));
}

function nameFromPath(path) {
  if (!path || isDataUrl(path)) {
    return "";
  }
  const withoutQuery = String(path).split(/[?#]/)[0];
  return withoutQuery.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || "";
}

export function threeTexturePath(texture = {}) {
  const nestedPath = firstField(nestedTextureSources(texture), ...TEXTURE_PATH_KEYS);
  const nestedRelativePath = firstField(nestedTextureSources(texture), ...TEXTURE_RELATIVE_PATH_KEYS);
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
    texture.image?.src,
    texture.image?.currentSrc,
    texture.image?.url,
    texture.image?.href,
    texture.source?.src,
    texture.source?.currentSrc,
    texture.source?.url,
    texture.source?.href,
    texture.source?.data?.src,
    texture.source?.data?.currentSrc,
    texture.source?.data?.url,
    texture.source?.data?.href,
    texture.userData?.image?.src,
    texture.userData?.image?.currentSrc,
    texture.userData?.image?.url,
    texture.userData?.image?.href,
    texture.userData?.source?.src,
    texture.userData?.source?.currentSrc,
    texture.userData?.source?.url,
    texture.userData?.source?.href,
    texture.userData?.source?.data?.src,
    texture.userData?.source?.data?.currentSrc,
    texture.userData?.source?.data?.url,
    texture.userData?.source?.data?.href,
    texture.userData?.element?.src,
    texture.userData?.element?.currentSrc,
    texture.userData?.element?.url,
    texture.userData?.element?.href,
    texture.userData?.mediaElement?.src,
    texture.userData?.mediaElement?.currentSrc,
    texture.userData?.mediaElement?.url,
    texture.userData?.mediaElement?.href,
    firstTextureArrayPath(texture.images, texture.image, texture.source, texture.source?.data),
    firstTextureArrayPath(texture.userData?.image, texture.userData?.source, texture.userData?.source?.data),
    texture.video?.src,
    texture.video?.currentSrc,
    texture.video?.url,
    texture.video?.href,
    texture.media?.src,
    texture.media?.currentSrc,
    texture.media?.url,
    texture.media?.href,
    texture.element?.src,
    texture.element?.currentSrc,
    texture.element?.url,
    texture.element?.href,
    texture.mediaElement?.src,
    texture.mediaElement?.currentSrc,
    texture.mediaElement?.url,
    texture.mediaElement?.href,
    nestedPath,
    texture.userData?.video?.src,
    texture.userData?.video?.currentSrc,
    texture.userData?.video?.url,
    texture.userData?.video?.href,
    texture.userData?.media?.src,
    texture.userData?.media?.currentSrc,
    texture.userData?.media?.url,
    texture.userData?.media?.href,
    texture.userData?.relativeFileName,
    texture.userData?.relativePath,
    texture.userData?.relativeUrl,
    texture.relativeFileName,
    texture.relativePath,
    texture.relativeUrl,
    nestedRelativePath
  );
}

export function threeTextureRelativePath(texture = {}) {
  const nestedRelativePath = firstField(nestedTextureSources(texture), ...TEXTURE_RELATIVE_PATH_KEYS);
  return firstText(
    texture.userData?.relativeFileName,
    texture.userData?.relativePath,
    texture.userData?.relativeUrl,
    texture.relativeFileName,
    texture.relativePath,
    texture.relativeUrl,
    nestedRelativePath,
    threeTexturePath(texture)
  );
}

export function threeTextureName(texture = {}, fallback = "Texture") {
  return firstText(
    texture.name,
    texture.image?.name,
    texture.source?.name,
    texture.source?.data?.name,
    texture.userData?.image?.name,
    texture.userData?.source?.name,
    texture.userData?.source?.data?.name,
    texture.userData?.element?.name,
    texture.userData?.mediaElement?.name,
    firstField(nestedTextureSources(texture), "name"),
    texture.userData?.name,
    nameFromPath(threeTexturePath(texture)),
    fallback
  );
}
