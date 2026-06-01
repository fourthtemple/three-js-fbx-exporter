const DEG_TO_RAD = Math.PI / 180;

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function identityMatrix() {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
}

export function normalizeMatrix(value, fallback = null) {
  if (!value) {
    return fallback ? [...fallback] : null;
  }
  const source = value.elements || (typeof value.toArray === "function" ? value.toArray() : value);
  if (!Array.isArray(source) && !ArrayBuffer.isView(source)) {
    return fallback ? [...fallback] : null;
  }
  const matrix = Array.from(source, (entry) => {
    const number = Number(entry);
    return Number.isFinite(number) ? number : 0;
  });
  return matrix.length === 16 ? matrix : (fallback ? [...fallback] : null);
}

export function transformMatrix(transform = {}) {
  const translation = transform.translation || [0, 0, 0];
  const rotation = transform.rotation || [0, 0, 0];
  const scale = transform.scale || [1, 1, 1];
  return composeMatrix(translation, eulerDegreesToQuaternion(rotation), scale);
}

export function matrixFromQuaternion(quaternion = {}, translation = [0, 0, 0], scale = [1, 1, 1]) {
  const source = quaternion || {};
  return composeMatrix(translation, {
    x: finiteNumber(source.x ?? source[0], 0),
    y: finiteNumber(source.y ?? source[1], 0),
    z: finiteNumber(source.z ?? source[2], 0),
    w: finiteNumber(source.w ?? source[3], 1)
  }, scale);
}

export function multiplyMatrices(a, b) {
  const result = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let index = 0; index < 4; index += 1) {
        result[column * 4 + row] += a[index * 4 + row] * b[column * 4 + index];
      }
    }
  }
  return result;
}

export function inverseAffineMatrix(matrix) {
  const a00 = matrix[0];
  const a01 = matrix[4];
  const a02 = matrix[8];
  const a10 = matrix[1];
  const a11 = matrix[5];
  const a12 = matrix[9];
  const a20 = matrix[2];
  const a21 = matrix[6];
  const a22 = matrix[10];
  const determinant =
    a00 * (a11 * a22 - a12 * a21) -
    a01 * (a10 * a22 - a12 * a20) +
    a02 * (a10 * a21 - a11 * a20);

  if (Math.abs(determinant) < Number.EPSILON) {
    throw new Error("Cannot invert a singular transform matrix");
  }

  const invDet = 1 / determinant;
  const b00 = (a11 * a22 - a12 * a21) * invDet;
  const b01 = (a02 * a21 - a01 * a22) * invDet;
  const b02 = (a01 * a12 - a02 * a11) * invDet;
  const b10 = (a12 * a20 - a10 * a22) * invDet;
  const b11 = (a00 * a22 - a02 * a20) * invDet;
  const b12 = (a02 * a10 - a00 * a12) * invDet;
  const b20 = (a10 * a21 - a11 * a20) * invDet;
  const b21 = (a01 * a20 - a00 * a21) * invDet;
  const b22 = (a00 * a11 - a01 * a10) * invDet;
  const tx = matrix[12];
  const ty = matrix[13];
  const tz = matrix[14];

  return [
    b00, b10, b20, 0,
    b01, b11, b21, 0,
    b02, b12, b22, 0,
    -(b00 * tx + b01 * ty + b02 * tz),
    -(b10 * tx + b11 * ty + b12 * tz),
    -(b20 * tx + b21 * ty + b22 * tz),
    1
  ];
}

function eulerDegreesToQuaternion(rotation) {
  const x = (rotation[0] || 0) * DEG_TO_RAD;
  const y = (rotation[1] || 0) * DEG_TO_RAD;
  const z = (rotation[2] || 0) * DEG_TO_RAD;
  const c1 = Math.cos(x / 2);
  const c2 = Math.cos(y / 2);
  const c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2);
  const s2 = Math.sin(y / 2);
  const s3 = Math.sin(z / 2);
  return {
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 + s1 * s2 * c3,
    w: c1 * c2 * c3 - s1 * s2 * s3
  };
}

function composeMatrix(translation, quaternion, scale) {
  const x2 = quaternion.x + quaternion.x;
  const y2 = quaternion.y + quaternion.y;
  const z2 = quaternion.z + quaternion.z;
  const xx = quaternion.x * x2;
  const xy = quaternion.x * y2;
  const xz = quaternion.x * z2;
  const yy = quaternion.y * y2;
  const yz = quaternion.y * z2;
  const zz = quaternion.z * z2;
  const wx = quaternion.w * x2;
  const wy = quaternion.w * y2;
  const wz = quaternion.w * z2;
  const sx = scale[0] ?? 1;
  const sy = scale[1] ?? 1;
  const sz = scale[2] ?? 1;

  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    translation[0] || 0,
    translation[1] || 0,
    translation[2] || 0,
    1
  ];
}
