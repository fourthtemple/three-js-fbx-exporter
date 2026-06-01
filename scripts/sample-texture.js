export function checkerTga() {
  return Uint8Array.from([
    0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    2, 0, 2, 0, 24, 0,
    255, 255, 255, 0, 0, 0,
    0, 0, 0, 255, 255, 255
  ]);
}

export function checkerTextureResolver(fileName) {
  return fileName === "checker.tga"
    ? { content: checkerTga(), mimeType: "image/tga" }
    : null;
}
