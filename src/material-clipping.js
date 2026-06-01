import { finiteNumber, vector } from "./value-normalizers.js";

export const MATERIAL_CLIPPING_PLANE_LIMIT = 4;
const VECTOR_AXES = ["X", "Y", "Z"];

export function materialClippingPlaneNormalField(index) {
  return `clippingPlane${index}Normal`;
}

export function materialClippingPlaneNormalComponentField(index, componentIndex) {
  return `${materialClippingPlaneNormalField(index)}${VECTOR_AXES[componentIndex]}`;
}

export function materialClippingPlaneConstantField(index) {
  return `clippingPlane${index}Constant`;
}

export function materialClippingPlaneNormalProperty(index) {
  return `Maya|clipping_plane_${index}_normal`;
}

export function materialClippingPlaneConstantProperty(index) {
  return `Maya|clipping_plane_${index}_constant`;
}

export function normalizeMaterialClippingPlanes(planes) {
  if (!planes || typeof planes[Symbol.iterator] !== "function") {
    return [];
  }
  return Array.from(planes)
    .slice(0, MATERIAL_CLIPPING_PLANE_LIMIT)
    .map(normalizeMaterialClippingPlane)
    .filter(Boolean);
}

function normalizeMaterialClippingPlane(plane) {
  if (!plane) {
    return null;
  }
  if (Array.isArray(plane) || ArrayBuffer.isView(plane)) {
    return {
      normal: vector(plane, 3, [0, 1, 0]),
      constant: finiteNumber(plane[3], 0)
    };
  }
  return {
    normal: vector(plane.normal ?? plane, 3, [0, 1, 0]),
    constant: finiteNumber(plane.constant ?? plane.w ?? plane.distance, 0)
  };
}
