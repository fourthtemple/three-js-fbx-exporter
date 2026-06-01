import {
  textureDimensionsFromPayload,
  textureMediaInfoFromPayload
} from "./texture-dimensions.js";
import { nestedTextureSources } from "./texture-source-fields.js";
import { rawImageToTgaPayload } from "./texture-raw-image.js";

export {
  textureDimensionsFromPayload,
  textureMediaInfoFromPayload
} from "./texture-dimensions.js";

const MIME_EXTENSIONS = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
  ["image/bmp", "bmp"],
  ["image/heic", "heic"],
  ["image/heif", "heif"],
  ["image/ktx", "ktx"],
  ["image/ktx2", "ktx2"],
  ["image/hdr", "hdr"],
  ["image/radiance", "hdr"],
  ["image/svg+xml", "svg"],
  ["image/tga", "tga"],
  ["image/tiff", "tiff"],
  ["image/exr", "exr"],
  ["image/openexr", "exr"],
  ["image/x-tga", "tga"],
  ["image/x-exr", "exr"],
  ["image/x-hdr", "hdr"],
  ["image/vnd.radiance", "hdr"],
  ["image/vnd-ms.dds", "dds"],
  ["application/octet-stream+dds", "dds"],
  ["application/octet-stream+ktx2", "ktx2"],
  ["video/mp4", "mp4"],
  ["video/mpeg", "mpeg"],
  ["application/ogg", "ogv"],
  ["video/ogg", "ogv"],
  ["video/quicktime", "mov"],
  ["video/webm", "webm"]
]);

export function isDataUrl(value) {
  return typeof value === "string" && /^data:/i.test(value);
}

export function extensionForMime(mimeType) {
  const normalized = String(mimeType || "").toLowerCase();
  return MIME_EXTENSIONS.get(normalized) || "bin";
}

function decodeBase64(base64) {
  const clean = String(base64).replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (typeof globalThis.atob === "function") {
    const binary = globalThis.atob(clean);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(clean, "base64"));
  }

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const output = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean.replace(/=+$/, "")) {
    const value = chars.indexOf(char);
    if (value < 0) {
      continue;
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(output);
}

function decodeTextPayload(payload) {
  const decoded = decodeURIComponent(String(payload).replace(/\+/g, "%20"));
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(decoded);
  }
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

export function dataUrlToTexturePayload(url) {
  if (!isDataUrl(url)) {
    return null;
  }

  const match = String(url).match(/^data:([^,]*?),(.*)$/is);
  if (!match) {
    return null;
  }

  const metadata = match[1] || "";
  const payload = match[2] || "";
  const parts = metadata.split(";").filter(Boolean);
  const mimeType = parts[0]?.includes("/") ? parts[0].toLowerCase() : "application/octet-stream";
  const isBase64 = parts.some((part) => part.toLowerCase() === "base64");
  const content = isBase64 ? decodeBase64(payload) : decodeTextPayload(payload);

  return {
    mimeType,
    extension: extensionForMime(mimeType),
    content,
    ...textureMediaInfoFromPayload(mimeType, content)
  };
}

const TEXTURE_SOURCE_FIELDS = Object.freeze([
  "src",
  "currentSrc",
  "fileName",
  "path",
  "url",
  "href",
  "relativeFileName",
  "relativePath",
  "relativeUrl"
]);

function dataUrlFromObject(source) {
  if (!source) {
    return null;
  }
  for (const field of TEXTURE_SOURCE_FIELDS) {
    if (isDataUrl(source[field])) {
      return source[field];
    }
  }
  return null;
}

function dataUrlFromArray(sources) {
  if (!Array.isArray(sources)) {
    return null;
  }
  for (const source of sources) {
    const dataUrl = dataUrlFromObject(source) ||
      dataUrlFromObject(source?.userData) ||
      (typeof source?.toDataURL === "function" ? source.toDataURL() : null);
    if (dataUrl) {
      return dataUrl;
    }
  }
  return null;
}

function dataUrlFromToDataUrlSource(source) {
  return typeof source?.toDataURL === "function" ? source.toDataURL() : null;
}

function bytesFromValue(value) {
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

function mimeTypeFromObject(source) {
  const value = source?.mimeType ?? source?.mediaType ?? source?.contentType ?? source?.type;
  const text = typeof value === "string" ? value.toLowerCase() : "";
  return text.includes("/") ? text : "";
}

function bytePayloadFromObject(source) {
  const mimeType = mimeTypeFromObject(source);
  if (!mimeType) {
    return null;
  }
  for (const field of ["content", "bytes", "data"]) {
    const content = bytesFromValue(source?.[field]);
    if (content) {
      return {
        mimeType,
        extension: extensionForMime(mimeType),
        content,
        ...textureMediaInfoFromPayload(mimeType, content)
      };
    }
  }
  return null;
}

function bytePayloadFromTextureSource(source) {
  if (!source) {
    return null;
  }
  for (const candidate of [
    source.userData,
    source.userData?.image,
    source.userData?.source,
    source.userData?.source?.data,
    source.userData?.video,
    source.userData?.media,
    source.userData?.element,
    source.userData?.mediaElement,
    source,
    source.image,
    source.source,
    source.source?.data,
    source.video,
    source.media,
    source.element,
    source.mediaElement
  ]) {
    const payload = bytePayloadFromObject(candidate);
    if (payload) {
      return payload;
    }
  }
  return null;
}

export function dataUrlFromTextureSource(source) {
  if (!source) {
    return null;
  }
  if (isDataUrl(source)) {
    return source;
  }
  const dataUrl = dataUrlFromObject(source) ||
    dataUrlFromObject(source.userData) ||
    dataUrlFromObject(source.image) ||
    dataUrlFromObject(source.source) ||
    dataUrlFromObject(source.source?.data) ||
    dataUrlFromObject(source.video) ||
    dataUrlFromObject(source.media) ||
    dataUrlFromObject(source.element) ||
    dataUrlFromObject(source.mediaElement) ||
    dataUrlFromObject(source.userData?.image) ||
    dataUrlFromObject(source.userData?.source) ||
    dataUrlFromObject(source.userData?.source?.data) ||
    dataUrlFromObject(source.userData?.video) ||
    dataUrlFromObject(source.userData?.media) ||
    dataUrlFromObject(source.userData?.element) ||
    dataUrlFromObject(source.userData?.mediaElement) ||
    dataUrlFromArray(source.images) ||
    dataUrlFromArray(source.image) ||
    dataUrlFromArray(source.source) ||
    dataUrlFromArray(source.source?.data) ||
    dataUrlFromArray(source.userData?.image) ||
    dataUrlFromArray(source.userData?.source) ||
    dataUrlFromArray(source.userData?.source?.data);
  if (dataUrl) {
    return dataUrl;
  }
  return [
    source,
    source.userData,
    ...nestedTextureSources(source)
  ].map(dataUrlFromToDataUrlSource).find(Boolean) || null;
}

export function texturePayloadFromSource(source) {
  return dataUrlToTexturePayload(dataUrlFromTextureSource(source)) ||
    bytePayloadFromTextureSource(source) ||
    rawImageToTgaPayload(source);
}

export function safeTextureFileName(name, extension = "bin") {
  const base = String(name || "Texture")
    .replace(/\.[^.\\/]+$/, "")
    .replace(/[\\/:*?"<>|#]+/g, "_")
    .trim() || "Texture";
  return `${base}.${extension || "bin"}`;
}
