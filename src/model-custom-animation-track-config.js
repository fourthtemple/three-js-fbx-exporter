import {
  customModelAnimationKind,
  customModelFbxProperty,
  customModelVectorComponentIndex
} from "./model-custom-properties.js";
import { componentValue } from "./component-value.js";

const VECTOR_AXES = ["X", "Y", "Z"];

function customModelProperty(record, fbxProperty, animationProperty) {
  const properties = record.customProperties ||
    record.mesh?.customProperties ||
    record.node?.customProperties ||
    record.camera?.customProperties ||
    record.light?.customProperties ||
    record.bone?.customProperties ||
    [];
  return properties.find((property) => {
    return property.name === fbxProperty || property.animationProperty === animationProperty;
  });
}

function customModelScalarTrack(animationProperty) {
  const fbxProperty = customModelFbxProperty(animationProperty);
  return {
    property: fbxProperty,
    group: fbxProperty,
    channels: [fbxProperty],
    defaultValue(record) {
      return customModelProperty(record, fbxProperty, animationProperty)?.value ?? 0;
    },
    value(keyframe) {
      return keyframe.value;
    },
    targetId(record) {
      return record.ids.model;
    }
  };
}

function customModelVectorTrack(animationProperty) {
  const fbxProperty = customModelFbxProperty(animationProperty);
  return {
    property: fbxProperty,
    group: fbxProperty,
    defaultValue(record) {
      return customModelProperty(record, fbxProperty, animationProperty)?.value ?? [0, 0, 0];
    },
    targetId(record) {
      return record.ids.model;
    }
  };
}

function customModelVectorComponentTrack(animationProperty) {
  const fbxProperty = customModelFbxProperty(animationProperty);
  const componentIndex = customModelVectorComponentIndex(animationProperty);
  return {
    property: fbxProperty,
    group: fbxProperty,
    channels: [VECTOR_AXES[componentIndex]],
    defaultValue(record) {
      return customModelProperty(record, fbxProperty, animationProperty)?.value?.[componentIndex] ?? 0;
    },
    value(keyframe) {
      return componentValue(keyframe.value, componentIndex, 0);
    },
    targetId(record) {
      return record.ids.model;
    }
  };
}

export function customModelTrack(animationProperty) {
  const kind = customModelAnimationKind(animationProperty);
  return kind === "vector" || kind === "color"
    ? customModelVectorTrack(animationProperty)
    : kind === "vectorComponent"
      ? customModelVectorComponentTrack(animationProperty)
      : customModelScalarTrack(animationProperty);
}
