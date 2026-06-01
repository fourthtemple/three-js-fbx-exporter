import { vector } from "../core/value-normalizers.js";
import { firstField, nestedTextureSources } from "./texture-source-fields.js";

const TOP_LEFT_ORIGINS = new Set(["top", "top-left", "topleft", "upper-left", "upperleft"]);

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function positiveInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
}

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function nonNegativeIntegerOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : null;
}

function normalizeAtlasOrigin(value) {
  const origin = String(value || "top-left").replace(/[_\s]+/g, "-").toLowerCase();
  return TOP_LEFT_ORIGINS.has(origin) ? "top-left" : "bottom-left";
}

function atlasSources(source = {}) {
  return [source, source.userData, ...nestedTextureSources(source)];
}

function atlasField(source, ...keys) {
  return firstField(atlasSources(source), ...keys);
}

export function normalizeTextureAtlas(source = {}) {
  const columns = positiveInteger(atlasField(
    source,
    "atlasColumns",
    "tileColumns",
    "flipbookColumns",
    "gridColumns",
    "columns",
    "cols"
  ));
  const rows = positiveInteger(atlasField(
    source,
    "atlasRows",
    "tileRows",
    "flipbookRows",
    "gridRows",
    "rows"
  ));
  if (!columns || !rows) {
    return null;
  }
  const origin = normalizeAtlasOrigin(atlasField(source, "atlasOrigin", "tileOrigin", "flipbookOrigin"));
  const frameCount = positiveInteger(
    atlasField(source, "atlasFrameCount", "tileCount", "flipbookFrameCount", "frameCount"),
    columns * rows
  );
  const atlas = { columns, rows, frameCount, origin };
  const cell = textureAtlasCell(atlas, source, 0);
  return {
    ...atlas,
    frame: cell.frame,
    column: cell.column,
    row: cell.row
  };
}

function nestedValue(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || ArrayBuffer.isView(value)) {
    return undefined;
  }
  return value.value ?? value.defaultValue;
}

function scalarValue(value) {
  if (value == null || Array.isArray(value) || ArrayBuffer.isView(value)) {
    return undefined;
  }
  if (typeof value !== "object") {
    return value;
  }
  const nested = nestedValue(value);
  return nested != null && nested !== value ? scalarValue(nested) : undefined;
}

function arrayValue(value, index) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    return value[index];
  }
  const nested = nestedValue(value);
  return nested != null && nested !== value ? arrayValue(nested, index) : undefined;
}

function objectValue(value, ...keys) {
  if (!value || typeof value !== "object" || Array.isArray(value) || ArrayBuffer.isView(value)) {
    return undefined;
  }
  const direct = firstDefined(...keys.map((key) => value[key]));
  if (direct != null) {
    return direct;
  }
  const nested = nestedValue(value);
  return nested != null && nested !== value ? objectValue(nested, ...keys) : undefined;
}

function atlasTileValue(source = {}) {
  return firstDefined(
    objectValue(source.value, "textureAtlasTile", "atlasTile", "atlasCell", "tile", "flipbookTile"),
    atlasField(source, "textureAtlasTile", "atlasTile", "atlasCell", "tile", "flipbookTile")
  );
}

function explicitAtlasFrameValue(source = {}) {
  return nonNegativeIntegerOrNull(firstDefined(
    scalarValue(source.value),
    objectValue(source.value, "frame", "index", "frameIndex", "textureAtlasFrame", "atlasFrame", "tileIndex", "flipbookFrame"),
    atlasField(source, "textureAtlasFrame", "atlasFrame", "tileIndex", "flipbookFrame", "currentTile", "frameIndex")
  ));
}

export function atlasFrameValue(source = {}, fallback = 0) {
  return explicitAtlasFrameValue(source) ?? fallback;
}

function atlasColumnValue(source = {}, fallback = 0) {
  const tile = atlasTileValue(source);
  return nonNegativeInteger(firstDefined(
    arrayValue(source.value, 0),
    arrayValue(tile, 0),
    objectValue(source.value, "column", "col", "x", "textureAtlasColumn", "atlasColumn", "tileColumn", "tileX"),
    objectValue(tile, "column", "col", "x", "textureAtlasColumn", "atlasColumn", "tileColumn", "tileX"),
    atlasField(source, "textureAtlasColumn", "atlasColumn", "tileColumn", "tileX", "column", "col")
  ), fallback);
}

function atlasRowValue(source = {}, fallback = 0) {
  const tile = atlasTileValue(source);
  return nonNegativeInteger(firstDefined(
    arrayValue(source.value, 1),
    arrayValue(tile, 1),
    objectValue(source.value, "row", "y", "textureAtlasRow", "atlasRow", "tileRow", "tileY"),
    objectValue(tile, "row", "y", "textureAtlasRow", "atlasRow", "tileRow", "tileY"),
    atlasField(source, "textureAtlasRow", "atlasRow", "tileRow", "tileY", "row")
  ), fallback);
}

function clampFrame(atlas, frame) {
  const frameCount = atlas.frameCount || atlas.columns * atlas.rows;
  return Math.min(Math.max(0, frame), Math.max(0, frameCount - 1));
}

function cellFromFrame(atlas, frameValue) {
  const frame = clampFrame(atlas, frameValue);
  return {
    frame,
    column: frame % atlas.columns,
    row: Math.floor(frame / atlas.columns)
  };
}

export function textureAtlasCell(atlas, source = {}, fallbackFrame = atlas?.frame ?? 0) {
  const directFrame = explicitAtlasFrameValue(source);
  if (directFrame != null) {
    return cellFromFrame(atlas, directFrame);
  }
  const fallback = cellFromFrame(atlas, fallbackFrame);
  const column = Math.min(atlasColumnValue(source, fallback.column), atlas.columns - 1);
  const row = Math.min(atlasRowValue(source, fallback.row), atlas.rows - 1);
  return cellFromFrame(atlas, row * atlas.columns + column);
}

export function textureAtlasFrameTransform(atlas, frameValue, baseTransform = {}) {
  const source = frameValue && typeof frameValue === "object" && !Array.isArray(frameValue) && !ArrayBuffer.isView(frameValue)
    ? frameValue
    : { value: frameValue };
  const { column, row } = textureAtlasCell(atlas, source, atlas.frame);
  const rowFromBottom = atlas.origin === "top-left" ? atlas.rows - row - 1 : row;
  const baseTranslation = vector(baseTransform.translation, 3, [0, 0, 0]);
  const baseScale = vector(baseTransform.scale, 3, [1, 1, 1]);
  const scale = [
    baseScale[0] / atlas.columns,
    baseScale[1] / atlas.rows,
    baseScale[2]
  ];
  return {
    translation: [
      baseTranslation[0] + column * scale[0],
      baseTranslation[1] + rowFromBottom * scale[1],
      baseTranslation[2]
    ],
    scale
  };
}

export function textureTransformWithAtlasFrame(transform, atlas, frameValue = atlas?.frame) {
  if (!atlas) {
    return transform;
  }
  const frameTransform = textureAtlasFrameTransform(atlas, frameValue, transform);
  return {
    ...transform,
    translation: frameTransform.translation,
    scale: frameTransform.scale
  };
}
