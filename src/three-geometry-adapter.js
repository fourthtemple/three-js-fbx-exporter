import { attributeComponent, attributeCount } from "./three-buffer-attribute.js";

const TRIANGLES_DRAW_MODE = 0;
const TRIANGLE_STRIP_DRAW_MODE = 1;
const TRIANGLE_FAN_DRAW_MODE = 2;

function getAttribute(geometry, name) {
  return geometry.getAttribute?.(name) || geometry.attributes?.[name] || null;
}

function vector3FromAttribute(attribute, index) {
  return [
    attributeComponent(attribute, index, 0),
    attributeComponent(attribute, index, 1),
    attributeComponent(attribute, index, 2)
  ];
}

function vector2FromAttribute(attribute, index) {
  return [
    attributeComponent(attribute, index, 0),
    attributeComponent(attribute, index, 1)
  ];
}

function color4FromAttribute(attribute, index) {
  return [
    attributeComponent(attribute, index, 0),
    attributeComponent(attribute, index, 1),
    attributeComponent(attribute, index, 2),
    attribute.itemSize >= 4 ? attributeComponent(attribute, index, 3) : 1
  ];
}

function tangent4FromAttribute(attribute, index) {
  return [
    attributeComponent(attribute, index, 0),
    attributeComponent(attribute, index, 1),
    attributeComponent(attribute, index, 2),
    attribute.itemSize >= 4 ? attributeComponent(attribute, index, 3) : 1
  ];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function normalize(values) {
  const length = Math.hypot(values[0], values[1], values[2]) || 1;
  return [values[0] / length, values[1] / length, values[2] / length];
}

function binormalFromNormalAndTangent(normal, tangent) {
  return normalize(cross(normal, tangent)).map((value) => value * tangent[3]);
}

function drawRange(geometry, totalCount) {
  const range = geometry.drawRange || {};
  const start = Math.max(0, Math.min(totalCount, Math.floor(Number(range.start) || 0)));
  const count = Number.isFinite(range.count) ? Math.max(0, Math.floor(range.count)) : totalCount - start;
  return {
    start,
    count: Math.min(count, totalCount - start)
  };
}

function indexArray(geometry, vertexCount) {
  const source = geometry.index?.array
    ? Array.from(geometry.index.array)
    : Array.from({ length: vertexCount }, (_, index) => index);
  const range = drawRange(geometry, source.length);
  return {
    indices: source.slice(range.start, range.start + range.count),
    sourceStart: range.start
  };
}

function drawModeValue(value) {
  if (value == null) {
    return TRIANGLES_DRAW_MODE;
  }
  if (typeof value === "number") {
    return value;
  }
  const key = String(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (key === "triangles" || key === "trianglesdrawmode") {
    return TRIANGLES_DRAW_MODE;
  }
  if (key === "trianglestrip" || key === "trianglestripdrawmode" || key === "strip") {
    return TRIANGLE_STRIP_DRAW_MODE;
  }
  if (key === "trianglefan" || key === "trianglefandrawmode" || key === "fan") {
    return TRIANGLE_FAN_DRAW_MODE;
  }
  return TRIANGLES_DRAW_MODE;
}

function hasDegenerateVertex(face) {
  return face[0] === face[1] || face[1] === face[2] || face[0] === face[2];
}

function pushTriangle(triangles, face, sourceOffset) {
  if (!hasDegenerateVertex(face)) {
    triangles.push({ face, sourceOffset });
  }
}

function triangulateIndices(indices, sourceStart = 0, drawMode = TRIANGLES_DRAW_MODE) {
  const triangles = [];
  if (drawMode === TRIANGLES_DRAW_MODE) {
    if (indices.length % 3 !== 0) {
      throw new Error("Three.js adapter currently exports complete triangle BufferGeometry primitives only");
    }
    for (let offset = 0; offset < indices.length; offset += 3) {
      pushTriangle(triangles, [
        indices[offset],
        indices[offset + 1],
        indices[offset + 2]
      ], sourceStart + offset);
    }
    return triangles;
  }

  if (indices.length < 3) {
    throw new Error("Three.js triangle strip/fan geometry requires at least three vertices");
  }

  if (drawMode === TRIANGLE_FAN_DRAW_MODE) {
    for (let offset = 1; offset < indices.length - 1; offset += 1) {
      pushTriangle(triangles, [
        indices[0],
        indices[offset],
        indices[offset + 1]
      ], sourceStart + offset - 1);
    }
    return triangles;
  }

  if (drawMode === TRIANGLE_STRIP_DRAW_MODE) {
    for (let offset = 0; offset < indices.length - 2; offset += 1) {
      pushTriangle(triangles, offset % 2 === 0
        ? [indices[offset], indices[offset + 1], indices[offset + 2]]
        : [indices[offset + 2], indices[offset + 1], indices[offset]], sourceStart + offset);
    }
    return triangles;
  }

  throw new Error(`Unsupported Three.js draw mode: ${drawMode}`);
}

function groupMaterialIndices(geometry, triangles) {
  const materialIndices = Array.from({ length: triangles.length }, () => 0);
  const groups = geometry.groups || [];
  if (!groups.length) {
    return materialIndices;
  }

  for (let triangle = 0; triangle < triangles.length; triangle += 1) {
    const sourceOffset = triangles[triangle].sourceOffset;
    const group = groups.find((candidate) => {
      const start = candidate.start || 0;
      const count = Number.isFinite(candidate.count) ? candidate.count : Infinity;
      return sourceOffset >= start && sourceOffset < start + count;
    });
    materialIndices[triangle] = group?.materialIndex || 0;
  }
  return materialIndices;
}

function morphTargetName(attribute, index, options = {}) {
  const dictionary = options.morphTargetDictionary || {};
  const dictionaryName = Object.entries(dictionary).find(([, value]) => value === index)?.[0];
  return attribute.name || dictionaryName || `Morph_${index + 1}`;
}

function geometryMorphTargets(geometry, position, normal, vertexCount, options = {}) {
  const normalTargets = geometry.morphAttributes?.normal || [];
  return (geometry.morphAttributes?.position || []).map((attribute, index) => {
    const vertices = [];
    const normals = [];
    const normalAttribute = normalTargets[index];
    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
      const morphPosition = vector3FromAttribute(attribute, vertexIndex);
      const basePosition = vector3FromAttribute(position, vertexIndex);
      vertices.push(...(geometry.morphTargetsRelative
        ? morphPosition
        : morphPosition.map((value, axis) => value - basePosition[axis])));
      if (normalAttribute) {
        const morphNormal = vector3FromAttribute(normalAttribute, vertexIndex);
        const baseNormal = normal ? vector3FromAttribute(normal, vertexIndex) : [0, 0, 0];
        normals.push(...(geometry.morphTargetsRelative
          ? morphNormal
          : morphNormal.map((value, axis) => value - baseNormal[axis])));
      }
    }
    return {
      name: morphTargetName(attribute, index, options),
      vertices,
      normals,
      relative: true,
      weight: options.morphTargetInfluences?.[index] ?? 0
    };
  });
}

function geometryUvAttributes(geometry) {
  const sets = [];
  const primary = getAttribute(geometry, "uv");
  if (primary) {
    sets.push({ name: "UVMap", attribute: primary });
  }

  const attributeNames = Object.keys(geometry.attributes || {})
    .filter((name) => /^uv\d+$/i.test(name))
    .sort((a, b) => Number(a.slice(2)) - Number(b.slice(2)));
  for (const name of attributeNames) {
    const attribute = getAttribute(geometry, name);
    if (attribute) {
      sets.push({ name: `UVMap_${sets.length}`, attribute });
    }
  }

  return sets;
}

export function geometryToSceneGeometry(geometry, options = {}) {
  const position = getAttribute(geometry, "position");
  const normal = getAttribute(geometry, "normal");
  const tangent = getAttribute(geometry, "tangent");
  const color = getAttribute(geometry, "color");
  const uvAttributes = geometryUvAttributes(geometry);
  const vertexCount = attributeCount(position, 3);
  const { indices, sourceStart } = indexArray(geometry, vertexCount);
  const triangles = triangulateIndices(indices, sourceStart, drawModeValue(options.drawMode ?? geometry.drawMode ?? geometry.mode));

  const vertices = [];
  for (let index = 0; index < vertexCount; index += 1) {
    vertices.push(...vector3FromAttribute(position, index));
  }

  const faces = [];
  const normals = [];
  const tangents = [];
  const binormals = [];
  const colors = [];
  const uvSets = uvAttributes.map((uv) => ({ name: uv.name, uvs: [] }));
  for (const triangle of triangles) {
    const face = triangle.face;
    faces.push(face);
    for (const vertexIndex of face) {
      const normalVector = normal ? vector3FromAttribute(normal, vertexIndex) : null;
      if (normalVector) {
        normals.push(...normalVector);
      }
      if (tangent) {
        const tangentVector = tangent4FromAttribute(tangent, vertexIndex);
        tangents.push(tangentVector[0], tangentVector[1], tangentVector[2]);
        if (normalVector) {
          binormals.push(...binormalFromNormalAndTangent(normalVector, tangentVector));
        }
      }
      if (color) {
        colors.push(...color4FromAttribute(color, vertexIndex));
      }
      uvAttributes.forEach((uv, index) => {
        uvSets[index].uvs.push(...vector2FromAttribute(uv.attribute, vertexIndex));
      });
    }
  }

  return {
    vertices,
    faces,
    normals,
    tangents,
    binormals,
    uvs: uvSets[0]?.uvs || [],
    uvSets,
    colors,
    morphTargets: geometryMorphTargets(geometry, position, normal, vertexCount, options),
    materialIndices: groupMaterialIndices(geometry, triangles)
  };
}
