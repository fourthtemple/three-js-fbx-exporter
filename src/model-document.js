import {
  addBoolProperty,
  addDoubleProperty,
  addIntProperty,
  addStringProperty,
  addVectorProperty,
  int32
} from "./fbx-values.js";

function addCustomModelProperty(properties, property) {
  if (property.kind === "color") {
    addVectorProperty(properties, property.name, "Color", property.value);
  } else if (property.kind === "vector") {
    addVectorProperty(properties, property.name, "Vector3D", property.value);
  } else if (property.kind === "boolean") {
    addBoolProperty(properties, property.name, Boolean(property.value));
  } else if (property.kind === "string") {
    addStringProperty(properties, property.name, property.value);
  } else {
    addDoubleProperty(properties, property.name, "Number", property.value);
  }
}

export function addModelTransformProperties(properties, transform, { visibility = 1, defaultAttributeIndex = 0, customProperties = [] } = {}) {
  properties.add("P", ["InheritType", "enum", "", "", int32(1)]);
  addIntProperty(properties, "QuaternionInterpolate", "enum", transform.quaternionInterpolate ?? 0);
  addVectorProperty(properties, "RotationOffset", "Vector3D", transform.rotationOffset || [0, 0, 0]);
  addVectorProperty(properties, "RotationPivot", "Vector3D", transform.rotationPivot || [0, 0, 0]);
  addVectorProperty(properties, "ScalingOffset", "Vector3D", transform.scalingOffset || [0, 0, 0]);
  addVectorProperty(properties, "ScalingPivot", "Vector3D", transform.scalingPivot || [0, 0, 0]);
  addIntProperty(properties, "RotationOrder", "enum", transform.rotationOrder ?? 0);
  addVectorProperty(properties, "PreRotation", "Vector3D", transform.preRotation || [0, 0, 0]);
  addVectorProperty(properties, "PostRotation", "Vector3D", transform.postRotation || [0, 0, 0]);
  addBoolProperty(properties, "RotationActive", Boolean(transform.rotationActive));
  addVectorProperty(properties, "GeometricTranslation", "Vector3D", transform.geometricTranslation || [0, 0, 0]);
  addVectorProperty(properties, "GeometricRotation", "Vector3D", transform.geometricRotation || [0, 0, 0]);
  addVectorProperty(properties, "GeometricScaling", "Vector3D", transform.geometricScaling || [1, 1, 1]);
  addVectorProperty(properties, "Lcl Translation", "Lcl Translation", transform.translation);
  addVectorProperty(properties, "Lcl Rotation", "Lcl Rotation", transform.rotation);
  addVectorProperty(properties, "Lcl Scaling", "Lcl Scaling", transform.scale);
  addDoubleProperty(properties, "Visibility", "Visibility", visibility);
  addIntProperty(properties, "DefaultAttributeIndex", "int", defaultAttributeIndex);
  for (const property of customProperties || []) {
    addCustomModelProperty(properties, property);
  }
}
