import { attributeComponent, attributeCount } from "./three-buffer-attribute.js";

function getAttribute(geometry, name) {
  return geometry?.getAttribute?.(name) || geometry?.attributes?.[name] || null;
}

function pointIndexArray(geometry, count) {
  const source = geometry?.index?.array
    ? Array.from(geometry.index.array)
    : Array.from({ length: count }, (_, index) => index);
  const range = geometry?.drawRange || {};
  const start = Math.max(0, Math.min(source.length, Math.floor(Number(range.start) || 0)));
  const drawCount = Number.isFinite(range.count) ? Math.max(0, Math.floor(range.count)) : source.length - start;
  return source.slice(start, start + Math.min(drawCount, source.length - start));
}

function pointSize(object) {
  const size = Number(object?.material?.size);
  return Number.isFinite(size) && size > 0 ? size : 1;
}

function pointPosition(attribute, index) {
  return [
    attributeComponent(attribute, index, 0),
    attributeComponent(attribute, index, 1),
    attributeComponent(attribute, index, 2)
  ];
}

function pointColor(attribute, index) {
  if (!attribute) {
    return null;
  }
  return [
    attributeComponent(attribute, index, 0, 1),
    attributeComponent(attribute, index, 1, 1),
    attributeComponent(attribute, index, 2, 1),
    attribute.itemSize >= 4 ? attributeComponent(attribute, index, 3, 1) : 1
  ];
}

function pushQuad(result, center, size, color) {
  const base = result.vertices.length / 3;
  const half = size / 2;
  result.vertices.push(
    center[0] - half, center[1] - half, center[2],
    center[0] + half, center[1] - half, center[2],
    center[0] + half, center[1] + half, center[2],
    center[0] - half, center[1] + half, center[2]
  );
  result.faces.push([base, base + 1, base + 2], [base, base + 2, base + 3]);
  result.normals.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1);
  result.uvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  result.materialIndices.push(0, 0);
  if (color) {
    result.colors.push(...color, ...color, ...color, ...color, ...color, ...color);
  }
}

export function isThreePoints(object) {
  return Boolean(object?.isPoints || object?.type === "Points");
}

export function pointsToSceneGeometry(object) {
  const geometry = object?.geometry || {};
  const position = getAttribute(geometry, "position");
  const color = getAttribute(geometry, "color");
  const count = attributeCount(position, 3);
  const indices = pointIndexArray(geometry, count);
  const result = {
    vertices: [],
    faces: [],
    normals: [],
    uvs: [],
    colors: [],
    tangents: [],
    binormals: [],
    morphTargets: [],
    materialIndices: []
  };
  const size = pointSize(object);
  for (const index of indices) {
    pushQuad(result, pointPosition(position, index), size, pointColor(color, index));
  }
  result.uvSets = [{ name: "UVMap", uvs: result.uvs }];
  return result;
}
