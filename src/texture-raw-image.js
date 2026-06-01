import { nestedTextureSources } from "./texture-source-fields.js";

function positiveInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function imageDataCandidate(source) {
  const candidates = [
    source,
    source?.userData,
    ...nestedTextureSources(source)
  ];
  return candidates.find((candidate) => {
    return candidate?.data && positiveInteger(candidate.width) && positiveInteger(candidate.height);
  }) || null;
}

function byteValue(value, shouldScale) {
  const number = Number(value);
  const scaled = shouldScale ? number * 255 : number;
  return Math.max(0, Math.min(255, Math.round(Number.isFinite(scaled) ? scaled : 0)));
}

function channelCount(image, pixelCount) {
  const explicit = positiveInteger(image.channels ?? image.components ?? image.componentCount);
  if (explicit >= 1 && explicit <= 4) {
    return explicit;
  }
  const inferred = Math.floor((image.data?.length || 0) / pixelCount);
  return inferred >= 4 ? 4 : inferred >= 1 ? inferred : 0;
}

function shouldScaleFloatData(data) {
  if (!data.BYTES_PER_ELEMENT || data.BYTES_PER_ELEMENT <= 1) {
    return false;
  }
  const sample = Array.from(data.slice ? data.slice(0, 16) : Array.from(data).slice(0, 16));
  return sample.length > 0 && sample.every((value) => {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 1;
  });
}

export function rawImageToTgaPayload(source) {
  const image = imageDataCandidate(source);
  if (!image) {
    return null;
  }
  const width = positiveInteger(image.width);
  const height = positiveInteger(image.height);
  const pixelCount = width * height;
  const channels = channelCount(image, pixelCount);
  if (!channels) {
    return null;
  }
  const data = image.data;
  const bytesPerPixel = channels === 2 || channels >= 4 ? 4 : 3;
  const output = new Uint8Array(18 + pixelCount * bytesPerPixel);
  output[2] = 2; // Uncompressed true-color image.
  output[12] = width & 0xff;
  output[13] = (width >> 8) & 0xff;
  output[14] = height & 0xff;
  output[15] = (height >> 8) & 0xff;
  output[16] = bytesPerPixel * 8;
  output[17] = bytesPerPixel === 4 ? 0x28 : 0x20; // Top-left origin, plus 8 alpha bits for RGBA.

  const scale = shouldScaleFloatData(data);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const sourceOffset = pixel * channels;
    const targetOffset = 18 + pixel * bytesPerPixel;
    const red = data[sourceOffset];
    const green = channels >= 3 ? data[sourceOffset + 1] : red;
    const blue = channels >= 3 ? data[sourceOffset + 2] : red;
    output[targetOffset] = byteValue(blue, scale);
    output[targetOffset + 1] = byteValue(green, scale);
    output[targetOffset + 2] = byteValue(red, scale);
    if (bytesPerPixel === 4) {
      output[targetOffset + 3] = byteValue(data[sourceOffset + (channels === 2 ? 1 : 3)] ?? 255, scale);
    }
  }

  return {
    mimeType: "image/x-tga",
    extension: "tga",
    content: output,
    width,
    height
  };
}
