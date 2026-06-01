import { normalizeMatrix } from "./transform-matrix.js";

const RAD_TO_DEG = 180 / Math.PI;
const EPSILON = 0.9999999;

function clampUnit(value) {
  return Math.max(-1, Math.min(1, value));
}

function length3(x, y, z) {
  return Math.hypot(x, y, z);
}

function determinant3(elements) {
  return elements[0] * (elements[5] * elements[10] - elements[9] * elements[6]) -
    elements[4] * (elements[1] * elements[10] - elements[9] * elements[2]) +
    elements[8] * (elements[1] * elements[6] - elements[5] * elements[2]);
}

function rotationOrderName(value) {
  const order = String(value || "XYZ").toUpperCase();
  return ["XYZ", "YXZ", "ZXY", "ZYX", "YZX", "XZY"].includes(order) ? order : "XYZ";
}

function normalizedRotationMatrix(elements, scale) {
  const sx = scale[0] || 1;
  const sy = scale[1] || 1;
  const sz = scale[2] || 1;
  return [
    elements[0] / sx, elements[1] / sx, elements[2] / sx, 0,
    elements[4] / sy, elements[5] / sy, elements[6] / sy, 0,
    elements[8] / sz, elements[9] / sz, elements[10] / sz, 0,
    0, 0, 0, 1
  ];
}

function eulerRadiansFromMatrix(elements, order) {
  const m11 = elements[0];
  const m12 = elements[4];
  const m13 = elements[8];
  const m21 = elements[1];
  const m22 = elements[5];
  const m23 = elements[9];
  const m31 = elements[2];
  const m32 = elements[6];
  const m33 = elements[10];
  const rotation = [0, 0, 0];

  if (order === "YXZ") {
    rotation[0] = Math.asin(-clampUnit(m23));
    if (Math.abs(m23) < EPSILON) {
      rotation[1] = Math.atan2(m13, m33);
      rotation[2] = Math.atan2(m21, m22);
    } else {
      rotation[1] = Math.atan2(-m31, m11);
    }
  } else if (order === "ZXY") {
    rotation[0] = Math.asin(clampUnit(m32));
    if (Math.abs(m32) < EPSILON) {
      rotation[1] = Math.atan2(-m31, m33);
      rotation[2] = Math.atan2(-m12, m22);
    } else {
      rotation[2] = Math.atan2(m21, m11);
    }
  } else if (order === "ZYX") {
    rotation[1] = Math.asin(-clampUnit(m31));
    if (Math.abs(m31) < EPSILON) {
      rotation[0] = Math.atan2(m32, m33);
      rotation[2] = Math.atan2(m21, m11);
    } else {
      rotation[2] = Math.atan2(-m12, m22);
    }
  } else if (order === "YZX") {
    rotation[2] = Math.asin(clampUnit(m21));
    if (Math.abs(m21) < EPSILON) {
      rotation[0] = Math.atan2(-m23, m22);
      rotation[1] = Math.atan2(-m31, m11);
    } else {
      rotation[1] = Math.atan2(m13, m33);
    }
  } else if (order === "XZY") {
    rotation[2] = Math.asin(-clampUnit(m12));
    if (Math.abs(m12) < EPSILON) {
      rotation[0] = Math.atan2(m32, m22);
      rotation[1] = Math.atan2(m13, m11);
    } else {
      rotation[0] = Math.atan2(-m23, m33);
    }
  } else {
    rotation[1] = Math.asin(clampUnit(m13));
    if (Math.abs(m13) < EPSILON) {
      rotation[0] = Math.atan2(-m23, m33);
      rotation[2] = Math.atan2(-m12, m11);
    } else {
      rotation[0] = Math.atan2(m32, m22);
    }
  }

  return rotation;
}

export function decomposeTransformMatrix(matrix, { rotationOrder = "XYZ" } = {}) {
  const elements = normalizeMatrix(matrix);
  if (!elements) {
    return null;
  }

  const scale = [
    length3(elements[0], elements[1], elements[2]),
    length3(elements[4], elements[5], elements[6]),
    length3(elements[8], elements[9], elements[10])
  ];
  if (determinant3(elements) < 0) {
    scale[0] = -scale[0];
  }

  const rotationMatrix = normalizedRotationMatrix(elements, scale);
  return {
    translation: [elements[12], elements[13], elements[14]],
    rotation: eulerRadiansFromMatrix(rotationMatrix, rotationOrderName(rotationOrder)).map((value) => value * RAD_TO_DEG),
    scale
  };
}
