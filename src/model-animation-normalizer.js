const MODEL_VECTOR_SPECS = Object.freeze({
  translation: { fbxProperty: "Lcl Translation", group: "T", field: "translation", fallback: [0, 0, 0] },
  rotation: { fbxProperty: "Lcl Rotation", group: "R", field: "rotation", fallback: [0, 0, 0] },
  scale: { fbxProperty: "Lcl Scaling", group: "S", field: "scale", fallback: [1, 1, 1] },
  rotationOffset: { fbxProperty: "RotationOffset", field: "rotationOffset", fallback: [0, 0, 0] },
  rotationPivot: { fbxProperty: "RotationPivot", field: "rotationPivot", fallback: [0, 0, 0] },
  preRotation: { fbxProperty: "PreRotation", field: "preRotation", fallback: [0, 0, 0] },
  postRotation: { fbxProperty: "PostRotation", field: "postRotation", fallback: [0, 0, 0] },
  scalingOffset: { fbxProperty: "ScalingOffset", field: "scalingOffset", fallback: [0, 0, 0] },
  scalingPivot: { fbxProperty: "ScalingPivot", field: "scalingPivot", fallback: [0, 0, 0] },
  geometricTranslation: { fbxProperty: "GeometricTranslation", field: "geometricTranslation", fallback: [0, 0, 0] },
  geometricRotation: { fbxProperty: "GeometricRotation", field: "geometricRotation", fallback: [0, 0, 0] },
  geometricScaling: { fbxProperty: "GeometricScaling", field: "geometricScaling", fallback: [1, 1, 1] }
});
const AXES = ["X", "Y", "Z"];

export const MODEL_VECTOR_ANIMATION_PROPERTIES = Object.freeze(Object.keys(MODEL_VECTOR_SPECS));
export const MODEL_VECTOR_ANIMATION_SPECS = MODEL_VECTOR_SPECS;
export const MODEL_COMPONENT_ANIMATION_PROPERTIES = Object.freeze(
  MODEL_VECTOR_ANIMATION_PROPERTIES.flatMap((property) => AXES.map((axis) => `${property}${axis}`))
);

const MODEL_PROPERTY_ALIASES = Object.freeze({
  x: "translationX",
  y: "translationY",
  z: "translationZ",
  position: "translation",
  translate: "translation",
  translation: "translation",
  rotation: "rotation",
  scale: "scale",
  scaling: "scale",
  geometricScale: "geometricScaling",
  geometricScaling: "geometricScaling"
});

const MODEL_COMPONENT_ALIASES = Object.freeze({
  position: "translation",
  translate: "translation",
  scaling: "scale",
  geometricScale: "geometricScaling"
});

function normalizedAxis(axis) {
  return { 0: "X", 1: "Y", 2: "Z", x: "X", y: "Y", z: "Z" }[String(axis).toLowerCase()] || null;
}

function componentProperty(property, axis) {
  const base = MODEL_COMPONENT_ALIASES[property] || property;
  return MODEL_VECTOR_SPECS[base] && axis ? `${base}${axis}` : null;
}

export function normalizeModelAnimationProperty(property) {
  if (MODEL_PROPERTY_ALIASES[property]) {
    return MODEL_PROPERTY_ALIASES[property];
  }
  if (MODEL_VECTOR_SPECS[property] || MODEL_COMPONENT_ANIMATION_PROPERTIES.includes(property)) {
    return property;
  }
  const match = String(property).match(/^([A-Za-z]+)([XYZxyz012])$/);
  return match ? componentProperty(match[1], normalizedAxis(match[2])) : null;
}

export function isModelScalarAnimationProperty(property) {
  return MODEL_COMPONENT_ANIMATION_PROPERTIES.includes(property);
}

export function modelAnimationVectorFallback(property) {
  return MODEL_VECTOR_SPECS[property]?.fallback || [0, 0, 0];
}
