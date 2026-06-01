import { decomposeTransformMatrix } from "../core/transform-decompose.js";
import { identityMatrix, normalizeMatrix } from "../core/transform-matrix.js";
import { attributeComponent } from "./three-buffer-attribute.js";

function instanceMatrixArray(object) {
  return object?.instanceMatrix?.array || null;
}

function matrixCount(object) {
  const array = instanceMatrixArray(object);
  return array ? Math.floor(array.length / 16) : 0;
}

function instanceCount(object) {
  const count = Math.max(0, Math.floor(Number(object?.count) || 0));
  const available = matrixCount(object);
  return available ? Math.min(count || available, available) : count;
}

function matrixTarget() {
  return {
    elements: identityMatrix(),
    fromArray(array, offset = 0) {
      this.elements = Array.from(array).slice(offset, offset + 16);
      return this;
    }
  };
}

function instanceMatrixElements(object, index) {
  const array = instanceMatrixArray(object);
  if (array) {
    return Array.from(array).slice(index * 16, index * 16 + 16);
  }

  if (typeof object?.getMatrixAt === "function") {
    const target = matrixTarget();
    object.getMatrixAt(index, target);
    return normalizeMatrix(target.elements, identityMatrix());
  }

  return identityMatrix();
}

function instanceName(object, baseName, index, makeName) {
  const authored = object?.userData?.instanceNames?.[index] ?? object?.instanceNames?.[index];
  const name = authored || `${baseName}_${index + 1}`;
  return makeName ? makeName(name) : name;
}

function instanceColor(object, index) {
  const attribute = object?.instanceColor;
  if (attribute) {
    return [
      attributeComponent(attribute, index, 0, 1),
      attributeComponent(attribute, index, 1, 1),
      attributeComponent(attribute, index, 2, 1)
    ];
  }

  if (typeof object?.getColorAt === "function") {
    const target = { r: 1, g: 1, b: 1 };
    try {
      object.getColorAt(index, target);
      return [target.r ?? 1, target.g ?? 1, target.b ?? 1];
    } catch {
      return null;
    }
  }

  return null;
}

function morphTargetCount(object) {
  return Math.max(
    object?.morphTargetInfluences?.length || 0,
    object?.geometry?.morphAttributes?.position?.length || 0,
    object?.geometry?.morphAttributes?.normal?.length || 0
  );
}

function finiteInfluence(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function morphTextureData(object) {
  return object?.morphTexture?.source?.data || object?.morphTexture?.image || null;
}

function instanceMorphTargetInfluences(object, index) {
  const count = morphTargetCount(object);
  if (!count) {
    return null;
  }

  if (object?.morphTexture && typeof object.getMorphAt === "function") {
    const target = { morphTargetInfluences: Array.from({ length: count }, () => 0) };
    object.getMorphAt(index, target);
    return target.morphTargetInfluences.map(finiteInfluence);
  }

  const texture = morphTextureData(object);
  const data = texture?.data;
  const width = Math.floor(Number(texture?.width) || count + 1);
  const start = index * width + 1;
  if (data && data.length >= start + count) {
    return Array.from(data).slice(start, start + count).map(finiteInfluence);
  }

  return null;
}

export function geometryWithInstanceColor(geometry, color) {
  if (!color) {
    return geometry;
  }
  if (geometry.colors?.length) {
    const colors = [];
    for (let offset = 0; offset < geometry.colors.length; offset += 4) {
      colors.push(
        geometry.colors[offset] * color[0],
        geometry.colors[offset + 1] * color[1],
        geometry.colors[offset + 2] * color[2],
        geometry.colors[offset + 3]
      );
    }
    return { ...geometry, colors };
  }

  const cornerCount = geometry.faces.reduce((sum, face) => sum + face.length, 0);
  return {
    ...geometry,
    colors: Array.from({ length: cornerCount }, () => [...color, 1]).flat()
  };
}

export function isThreeInstancedMesh(object) {
  return Boolean(object?.isInstancedMesh || /InstancedMesh$/.test(object?.type || ""));
}

export function instancedMeshInstances(object, baseName, options = {}) {
  const count = instanceCount(object);
  return Array.from({ length: count }, (_, index) => {
    const transform = decomposeTransformMatrix(instanceMatrixElements(object, index), {
      rotationOrder: options.rotationOrder
    }) || { translation: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
    return {
      name: instanceName(object, baseName, index, options.makeName),
      transform,
      color: instanceColor(object, index),
      morphTargetInfluences: instanceMorphTargetInfluences(object, index)
    };
  });
}
