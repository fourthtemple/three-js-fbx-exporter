import { attributeComponent, attributeCount } from "./three-buffer-attribute.js";

const EPSILON = 1e-8;

function getAttribute(geometry, name) {
  return geometry?.getAttribute?.(name) || geometry?.attributes?.[name] || null;
}

function lineIndexArray(geometry, count) {
  const source = geometry?.index?.array
    ? Array.from(geometry.index.array)
    : Array.from({ length: count }, (_, index) => index);
  const range = geometry?.drawRange || {};
  const start = Math.max(0, Math.min(source.length, Math.floor(Number(range.start) || 0)));
  const drawCount = Number.isFinite(range.count) ? Math.max(0, Math.floor(range.count)) : source.length - start;
  return {
    indices: source.slice(start, start + Math.min(drawCount, source.length - start)),
    sourceStart: start
  };
}

function firstMaterial(object) {
  return Array.isArray(object?.material) ? object.material.find(Boolean) : object?.material;
}

function lineWidth(object) {
  const material = firstMaterial(object);
  const width = Number(
    object?.userData?.fbxLineWidth ??
    material?.userData?.fbxLineWidth ??
    material?.linewidth ??
    material?.wireframeLinewidth
  );
  return Number.isFinite(width) && width > 0 ? width : 1;
}

function lineMode(object) {
  const type = String(object?.type || "");
  if (object?.isLineSegments || type === "LineSegments") {
    return "segments";
  }
  if (object?.isLineLoop || type === "LineLoop") {
    return "loop";
  }
  return "strip";
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

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(values, scalar) {
  return [values[0] * scalar, values[1] * scalar, values[2] * scalar];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function normalize(values) {
  const length = Math.hypot(values[0], values[1], values[2]);
  return length > EPSILON ? values.map((value) => value / length) : null;
}

function segmentPerpendicular(tangent) {
  for (const reference of [[0, 0, 1], [0, 1, 0], [1, 0, 0]]) {
    const perpendicular = normalize(cross(tangent, reference));
    if (perpendicular) {
      return perpendicular;
    }
  }
  return [0, 1, 0];
}

function segmentMaterialIndex(geometry, sourceOffset) {
  const groups = geometry?.groups || [];
  if (!groups.length) {
    return 0;
  }
  const group = groups.find((candidate) => {
    const start = candidate.start || 0;
    const count = Number.isFinite(candidate.count) ? candidate.count : Infinity;
    return sourceOffset >= start && sourceOffset < start + count;
  });
  return group?.materialIndex || 0;
}

function lineSegments(object, indices, sourceStart) {
  const mode = lineMode(object);
  const segments = [];
  if (mode === "segments") {
    for (let offset = 0; offset + 1 < indices.length; offset += 2) {
      segments.push({ start: indices[offset], end: indices[offset + 1], sourceOffset: sourceStart + offset });
    }
    return segments;
  }

  for (let offset = 0; offset + 1 < indices.length; offset += 1) {
    segments.push({ start: indices[offset], end: indices[offset + 1], sourceOffset: sourceStart + offset });
  }
  if (mode === "loop" && indices.length > 2) {
    segments.push({ start: indices[indices.length - 1], end: indices[0], sourceOffset: sourceStart + indices.length - 1 });
  }
  return segments;
}

function pushSegment(result, geometry, segment, position, color, width) {
  const start = pointPosition(position, segment.start);
  const end = pointPosition(position, segment.end);
  const tangent = normalize(subtract(end, start));
  if (!tangent) {
    return;
  }

  const base = result.vertices.length / 3;
  const perpendicular = segmentPerpendicular(tangent);
  const halfWidth = width / 2;
  const offset = scale(perpendicular, halfWidth);
  const normal = normalize(cross(perpendicular, tangent)) || [0, 0, 1];
  result.vertices.push(
    ...add(start, offset),
    ...add(end, offset),
    ...subtract(end, offset),
    ...subtract(start, offset)
  );
  result.faces.push([base, base + 1, base + 2], [base, base + 2, base + 3]);
  result.normals.push(...normal, ...normal, ...normal, ...normal, ...normal, ...normal);
  result.uvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  const materialIndex = segmentMaterialIndex(geometry, segment.sourceOffset);
  result.materialIndices.push(materialIndex, materialIndex);

  if (color) {
    const startColor = pointColor(color, segment.start);
    const endColor = pointColor(color, segment.end);
    result.colors.push(...startColor, ...endColor, ...endColor, ...startColor, ...endColor, ...startColor);
  }
}

export function isThreeLine(object) {
  const type = String(object?.type || "");
  return Boolean(object?.isLine || object?.isLineSegments || object?.isLineLoop || /^Line/.test(type));
}

export function lineToSceneGeometry(object) {
  const geometry = object?.geometry || {};
  const position = getAttribute(geometry, "position");
  const color = getAttribute(geometry, "color");
  const count = attributeCount(position, 3);
  const { indices, sourceStart } = lineIndexArray(geometry, count);
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
  for (const segment of lineSegments(object, indices, sourceStart)) {
    pushSegment(result, geometry, segment, position, color, lineWidth(object));
  }
  result.uvSets = [{ name: "UVMap", uvs: result.uvs }];
  return result;
}
