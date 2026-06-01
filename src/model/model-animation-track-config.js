import {
  MODEL_COMPONENT_ANIMATION_PROPERTIES,
  MODEL_VECTOR_ANIMATION_PROPERTIES,
  MODEL_VECTOR_ANIMATION_SPECS
} from "./model-animation-normalizer.js";
import { componentValue } from "../core/component-value.js";

const VECTOR_AXES = ["X", "Y", "Z"];

function targetTransform(record) {
  return record.transform || record.mesh?.transform;
}

function modelVectorTrack(spec) {
  return {
    property: spec.fbxProperty,
    group: spec.group || spec.fbxProperty,
    defaultValue(record) {
      return targetTransform(record)?.[spec.field] || spec.fallback;
    }
  };
}

function modelVectorComponentTrack(property) {
  const baseProperty = MODEL_VECTOR_ANIMATION_PROPERTIES
    .filter((candidate) => property.startsWith(candidate))
    .sort((a, b) => b.length - a.length)[0];
  const axis = property.slice(baseProperty.length);
  const index = VECTOR_AXES.indexOf(axis);
  const spec = MODEL_VECTOR_ANIMATION_SPECS[baseProperty];
  return {
    property: spec.fbxProperty,
    group: spec.group || spec.fbxProperty,
    channels: [axis],
    defaultValue(record) {
      return targetTransform(record)?.[spec.field]?.[index] ?? spec.fallback[index];
    },
    value(keyframe) {
      return componentValue(keyframe.value, index, spec.fallback[index]);
    }
  };
}

export function createModelAnimationTracks() {
  return Object.fromEntries([
    ...MODEL_VECTOR_ANIMATION_PROPERTIES.map((property) => [
      property,
      modelVectorTrack(MODEL_VECTOR_ANIMATION_SPECS[property])
    ]),
    ...MODEL_COMPONENT_ANIMATION_PROPERTIES.map((property) => [
      property,
      modelVectorComponentTrack(property)
    ])
  ]);
}
