import { finiteNumber } from "./value-normalizers.js";

function vertexAt(vertices, index) {
  const offset = index * 3;
  return [vertices[offset] ?? 0, vertices[offset + 1] ?? 0, vertices[offset + 2] ?? 0];
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
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

function computeFaceNormal(vertices, face) {
  if (face.length < 3) {
    return [0, 1, 0];
  }
  const a = vertexAt(vertices, face[0]);
  const b = vertexAt(vertices, face[1]);
  const c = vertexAt(vertices, face[2]);
  return normalize(cross(subtract(b, a), subtract(c, a)));
}

function normalizeVectorLayer(values, faces, vertexCount, cornerCount, label) {
  if (!values?.length) {
    return [];
  }
  const source = Array.from(values, (value) => finiteNumber(value));

  const cornerStride = source.length / cornerCount;
  if (cornerStride === 3 || cornerStride === 4) {
    const result = [];
    for (let offset = 0; offset < source.length; offset += cornerStride) {
      result.push(source[offset], source[offset + 1], source[offset + 2]);
    }
    return result;
  }

  const vertexStride = source.length / vertexCount;
  if (vertexStride === 3 || vertexStride === 4) {
    const result = [];
    for (const face of faces) {
      for (const vertexIndex of face) {
        const offset = vertexIndex * vertexStride;
        result.push(source[offset], source[offset + 1], source[offset + 2]);
      }
    }
    return result;
  }

  throw new Error(`${label} data must be mapped by vertex or polygon vertex with 3 or 4 values`);
}

function rgbaColor(values, offset, stride) {
  return [
    finiteNumber(values[offset], 1),
    finiteNumber(values[offset + 1], 1),
    finiteNumber(values[offset + 2], 1),
    stride === 4 ? finiteNumber(values[offset + 3], 1) : 1
  ];
}

function normalizeColors(values, faces, vertexCount, cornerCount) {
  if (!values?.length) {
    return [];
  }
  const colors = Array.from(values, (value) => finiteNumber(value, 1));
  const cornerStride = colors.length / cornerCount;
  if (cornerStride === 3 || cornerStride === 4) {
    const result = [];
    for (let offset = 0; offset < colors.length; offset += cornerStride) {
      result.push(...rgbaColor(colors, offset, cornerStride));
    }
    return result;
  }

  const vertexStride = colors.length / vertexCount;
  if (vertexStride === 3 || vertexStride === 4) {
    const result = [];
    for (const face of faces) {
      for (const vertexIndex of face) {
        result.push(...rgbaColor(colors, vertexIndex * vertexStride, vertexStride));
      }
    }
    return result;
  }

  throw new Error("Color data must be mapped by vertex or polygon vertex with RGB/RGBA values");
}

function normalizeUvArray(values, cornerCount, label) {
  const uvs = values?.length
    ? Array.from(values, (value) => finiteNumber(value))
    : Array.from({ length: cornerCount * 2 }, () => 0);
  if (uvs.length !== cornerCount * 2) {
    throw new Error(`${label} data must be mapped by polygon vertex`);
  }
  return uvs;
}

function normalizeUvSets(geometry, cornerCount) {
  const sets = [];
  const addSet = (name, values) => {
    if (!values?.length) {
      return;
    }
    sets.push({
      name: name || `UVMap_${sets.length}`,
      uvs: normalizeUvArray(values, cornerCount, name || "UV")
    });
  };

  if (geometry.uvSets?.length) {
    for (const [index, entry] of geometry.uvSets.entries()) {
      if (Array.isArray(entry) || ArrayBuffer.isView(entry)) {
        addSet(index === 0 ? "UVMap" : `UVMap_${index}`, entry);
      } else {
        addSet(entry.name || (index === 0 ? "UVMap" : `UVMap_${index}`), entry.uvs ?? entry.uv);
      }
    }
  } else {
    addSet(geometry.uvName || "UVMap", geometry.uvs ?? geometry.uv);
    addSet(geometry.uv2Name || `UVMap_${sets.length || 1}`, geometry.uv2s ?? geometry.uv2 ?? geometry.secondaryUvs);
    for (let index = 3; index <= 8; index += 1) {
      addSet(geometry[`uv${index}Name`] || `UVMap_${sets.length || index - 1}`, geometry[`uv${index}s`] ?? geometry[`uv${index}`]);
    }
  }

  if (!sets.length) {
    sets.push({
      name: "UVMap",
      uvs: normalizeUvArray(null, cornerCount, "UV")
    });
  }

  return sets;
}

function vertexNormalsFromCorners(faces, normals, vertexCount) {
  const sums = Array.from({ length: vertexCount }, () => [0, 0, 0]);
  let corner = 0;
  for (const face of faces) {
    for (const vertexIndex of face) {
      const offset = corner * 3;
      sums[vertexIndex][0] += normals[offset] ?? 0;
      sums[vertexIndex][1] += normals[offset + 1] ?? 0;
      sums[vertexIndex][2] += normals[offset + 2] ?? 0;
      corner += 1;
    }
  }
  return sums.flatMap((normal) => normalize(normal));
}

function normalizeMorphNormals(target, indices, relative, baseNormals) {
  const source = target.normals ?? target.normalDeltas ?? target.normal ?? target.morphNormals;
  if (!source?.length) {
    return [];
  }
  const values = Array.from(source, (value) => finiteNumber(value));
  if (values.length !== indices.length * 3) {
    throw new Error(`Morph target '${target.name || "Morph"}' normals must provide 3 values per affected vertex`);
  }

  const normals = [];
  for (let index = 0; index < indices.length; index += 1) {
    const vertexIndex = indices[index];
    const sourceOffset = index * 3;
    const baseOffset = vertexIndex * 3;
    for (let axis = 0; axis < 3; axis += 1) {
      const value = values[sourceOffset + axis];
      normals.push(relative ? value : value - (baseNormals[baseOffset + axis] ?? 0));
    }
  }
  return normals;
}

function zeroVector(values, offset) {
  return Math.abs(values[offset] ?? 0) <= 1e-12 &&
    Math.abs(values[offset + 1] ?? 0) <= 1e-12 &&
    Math.abs(values[offset + 2] ?? 0) <= 1e-12;
}

function sparseMorphTarget(indices, vertices, normals, alreadySparse) {
  if (alreadySparse) {
    return { indices, vertices, normals };
  }

  const keptIndices = [];
  const keptVertices = [];
  const keptNormals = [];
  for (let index = 0; index < indices.length; index += 1) {
    const offset = index * 3;
    const keep = !zeroVector(vertices, offset) || (normals.length && !zeroVector(normals, offset));
    if (!keep) {
      continue;
    }
    keptIndices.push(indices[index]);
    keptVertices.push(vertices[offset], vertices[offset + 1], vertices[offset + 2]);
    if (normals.length) {
      keptNormals.push(normals[offset], normals[offset + 1], normals[offset + 2]);
    }
  }

  return keptIndices.length
    ? { indices: keptIndices, vertices: keptVertices, normals: keptNormals }
    : { indices, vertices, normals };
}

function normalizeMorphTargets(targets, baseVertices, baseNormals = []) {
  return targets.map((target, index) => {
    const name = target.name || `Morph_${index + 1}`;
    const targetIndices = target.indices || target.indexes;
    const source = target.vertices || target.deltas || target.positions || target.values || [];
    const isSparse = targetIndices?.length;
    const indices = isSparse
      ? Array.from(targetIndices, (value) => {
        const vertexIndex = Number(value);
        if (!Number.isInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= baseVertices.length / 3) {
          throw new Error(`Invalid morph target vertex index: ${value}`);
        }
        return vertexIndex;
      })
      : Array.from({ length: baseVertices.length / 3 }, (_, vertexIndex) => vertexIndex);
    const values = Array.from(source, (value) => finiteNumber(value));
    if (values.length !== indices.length * 3) {
      throw new Error(`Morph target '${name}' must provide 3 values per affected vertex`);
    }

    const relative = target.relative !== false;
    const vertices = [];
    for (let index = 0; index < indices.length; index += 1) {
      const vertexIndex = indices[index];
      const sourceOffset = index * 3;
      const baseOffset = vertexIndex * 3;
      for (let axis = 0; axis < 3; axis += 1) {
        const value = values[sourceOffset + axis];
        vertices.push(relative ? value : value - baseVertices[baseOffset + axis]);
      }
    }

    const sparse = sparseMorphTarget(indices, vertices, normalizeMorphNormals(target, indices, relative, baseNormals), Boolean(isSparse));
    return {
      name,
      indices: sparse.indices,
      vertices: sparse.vertices,
      normals: sparse.normals,
      weight: Math.max(0, Math.min(1, finiteNumber(target.weight ?? target.value, 0)))
    };
  });
}

export function normalizeGeometry(geometry) {
  const vertices = Array.from(geometry.vertices || [], (value) => finiteNumber(value));
  if (!vertices.length || vertices.length % 3 !== 0) {
    throw new Error("FBX meshes require a vertices array with 3 values per vertex");
  }

  const faces = (geometry.faces || []).map((face) => Array.from(face, (index) => {
    const vertexIndex = Number(index);
    if (!Number.isInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= vertices.length / 3) {
      throw new Error(`Invalid polygon vertex index: ${index}`);
    }
    return vertexIndex;
  }));
  if (!faces.length) {
    throw new Error("FBX meshes require at least one polygon");
  }

  const cornerCount = faces.reduce((sum, face) => sum + face.length, 0);
  const vertexCount = vertices.length / 3;
  const normals = normalizeVectorLayer(geometry.normals ?? geometry.normal, faces, vertexCount, cornerCount, "Normal");
  if (!normals.length) {
    for (const face of faces) {
      const normal = computeFaceNormal(vertices, face);
      for (let index = 0; index < face.length; index += 1) {
        normals.push(...normal);
      }
    }
  }

  const uvSets = normalizeUvSets(geometry, cornerCount);
  const uvs = uvSets[0].uvs;
  const colors = normalizeColors(geometry.colors ?? geometry.color ?? geometry.vertexColors, faces, vertexCount, cornerCount);
  const tangents = normalizeVectorLayer(geometry.tangents ?? geometry.tangent, faces, vertexCount, cornerCount, "Tangent");
  const binormals = normalizeVectorLayer(
    geometry.binormals ?? geometry.bitangents ?? geometry.bitangent,
    faces,
    vertexCount,
    cornerCount,
    "Binormal"
  );

  const materialIndices = faces.map((_, index) => {
    const value = geometry.materialIndices?.[index] ?? 0;
    return Number.isInteger(value) && value >= 0 ? value : 0;
  });

  const morphTargets = normalizeMorphTargets(
    geometry.morphTargets || geometry.shapes || [],
    vertices,
    vertexNormalsFromCorners(faces, normals, vertexCount)
  );

  return { vertices, faces, normals, uvs, uvSets, colors, tangents, binormals, materialIndices, morphTargets };
}
