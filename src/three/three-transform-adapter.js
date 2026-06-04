import { decomposeTransformMatrix } from "../core/transform-decompose.js";
import { vector } from "../core/value-normalizers.js";

export const RAD_TO_DEG = 180 / Math.PI;
// FBX stores extrinsic Euler order enums. Three/FBXLoader exposes the matching
// intrinsic Three.js order, so the enum/name table is intentionally reversed.
const ROTATION_ORDER_NAMES = Object.freeze(["ZYX", "YZX", "XZY", "ZXY", "YXZ", "XYZ", "SPHERICXYZ"]);

function rotationOrder(value) {
  if (Number.isInteger(value) && value >= 0 && value <= 6) {
    return value;
  }
  const order = String(value || "").toUpperCase();
  return {
    ZYX: 0,
    YZX: 1,
    XZY: 2,
    ZXY: 3,
    YXZ: 4,
    XYZ: 5,
    SPHERICXYZ: 6,
    SPHERICALXYZ: 6
  }[order] ?? 0;
}

function rotationOrderName(value) {
  if (Number.isInteger(value)) {
    return ROTATION_ORDER_NAMES[value] || "XYZ";
  }
  const order = String(value || "XYZ").toUpperCase();
  return order === "SPHERICALXYZ" ? "SPHERICXYZ" : order;
}

function objectRotationOrderSource(object) {
  return object.userData?.fbxRotationOrder ?? object.userData?.rotationOrder ?? object.rotation?.order;
}

export function objectRotationOrderName(object) {
  return rotationOrderName(objectRotationOrderSource(object));
}

function objectTrsTransform(object) {
  return {
    translation: [
      object.position?.x ?? 0,
      object.position?.y ?? 0,
      object.position?.z ?? 0
    ],
    rotation: [
      (object.rotation?.x ?? 0) * RAD_TO_DEG,
      (object.rotation?.y ?? 0) * RAD_TO_DEG,
      (object.rotation?.z ?? 0) * RAD_TO_DEG
    ],
    scale: [
      object.scale?.x ?? 1,
      object.scale?.y ?? 1,
      object.scale?.z ?? 1
    ]
  };
}

function objectLocalTransform(object) {
  if (object.matrixAutoUpdate === false) {
    return decomposeTransformMatrix(object.matrix, { rotationOrder: objectRotationOrderName(object) }) || objectTrsTransform(object);
  }
  return objectTrsTransform(object);
}

export function objectTransform(object) {
  return {
    ...objectLocalTransform(object),
    rotationOrder: rotationOrder(objectRotationOrderSource(object)),
    rotationOffset: vector(object.userData?.rotationOffset, 3, [0, 0, 0]),
    rotationPivot: vector(object.userData?.rotationPivot ?? object.userData?.pivot, 3, [0, 0, 0]),
    preRotation: vector(object.userData?.preRotation, 3, [0, 0, 0]),
    postRotation: vector(object.userData?.postRotation, 3, [0, 0, 0]),
    scalingOffset: vector(object.userData?.scalingOffset, 3, [0, 0, 0]),
    scalingPivot: vector(object.userData?.scalingPivot ?? object.userData?.pivot, 3, [0, 0, 0]),
    geometricTranslation: vector(object.userData?.geometricTranslation, 3, [0, 0, 0]),
    geometricRotation: vector(object.userData?.geometricRotation, 3, [0, 0, 0]),
    geometricScaling: vector(object.userData?.geometricScaling ?? object.userData?.geometricScale, 3, [1, 1, 1])
  };
}

export function objectVisibility(object) {
  return object.visible === false ? 0 : 1;
}
