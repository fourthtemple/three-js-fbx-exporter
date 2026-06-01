import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const MIME_TYPES = new Map([
  ["avif", "image/avif"],
  ["bmp", "image/bmp"],
  ["dds", "image/vnd-ms.dds"],
  ["exr", "image/x-exr"],
  ["gif", "image/gif"],
  ["heic", "image/heic"],
  ["heif", "image/heif"],
  ["hdr", "image/vnd.radiance"],
  ["jpeg", "image/jpeg"],
  ["jpg", "image/jpeg"],
  ["ktx", "image/ktx"],
  ["ktx2", "image/ktx2"],
  ["mov", "video/quicktime"],
  ["mp4", "video/mp4"],
  ["mpeg", "video/mpeg"],
  ["mpg", "video/mpeg"],
  ["ogg", "video/ogg"],
  ["ogv", "video/ogg"],
  ["png", "image/png"],
  ["svg", "image/svg+xml"],
  ["tga", "image/x-tga"],
  ["tif", "image/tiff"],
  ["tiff", "image/tiff"],
  ["webm", "video/webm"],
  ["webp", "image/webp"]
]);

export function createNodeTextureResolver({ baseDir = "." } = {}) {
  return (fileName) => {
    const path = isAbsolute(fileName) ? fileName : resolve(baseDir, fileName);
    return {
      content: readFileSync(path),
      mimeType: mimeTypeForPath(path)
    };
  };
}

function mimeTypeForPath(path) {
  const extension = String(path).split(".").pop()?.toLowerCase() || "";
  return MIME_TYPES.get(extension) || "application/octet-stream";
}
