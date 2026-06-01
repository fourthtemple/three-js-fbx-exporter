import {
  addBoolProperty,
  addDoubleProperty,
  addIntProperty,
  addProperties70,
  addStringProperty,
  addTimeProperty,
  addVectorProperty
} from "../core/fbx-values.js";

function addTemplate(objectType, templateName) {
  return addProperties70(objectType.add("PropertyTemplate", [templateName]));
}

function addModelTemplate(objectType) {
  const properties = addTemplate(objectType, "FbxNode");
  addIntProperty(properties, "InheritType", "enum", 1);
  addIntProperty(properties, "QuaternionInterpolate", "enum", 0);
  addVectorProperty(properties, "Lcl Translation", "Lcl Translation", [0, 0, 0]);
  addVectorProperty(properties, "Lcl Rotation", "Lcl Rotation", [0, 0, 0]);
  addVectorProperty(properties, "Lcl Scaling", "Lcl Scaling", [1, 1, 1]);
  addDoubleProperty(properties, "Visibility", "Visibility", 1);
  addIntProperty(properties, "RotationOrder", "enum", 0);
  addVectorProperty(properties, "PreRotation", "Vector3D", [0, 0, 0]);
  addVectorProperty(properties, "PostRotation", "Vector3D", [0, 0, 0]);
  addVectorProperty(properties, "RotationOffset", "Vector3D", [0, 0, 0]);
  addVectorProperty(properties, "RotationPivot", "Vector3D", [0, 0, 0]);
  addVectorProperty(properties, "ScalingOffset", "Vector3D", [0, 0, 0]);
  addVectorProperty(properties, "ScalingPivot", "Vector3D", [0, 0, 0]);
  addVectorProperty(properties, "GeometricTranslation", "Vector3D", [0, 0, 0]);
  addVectorProperty(properties, "GeometricRotation", "Vector3D", [0, 0, 0]);
  addVectorProperty(properties, "GeometricScaling", "Vector3D", [1, 1, 1]);
}

function addGeometryTemplate(objectType) {
  const properties = addTemplate(objectType, "FbxMesh");
  addVectorProperty(properties, "Color", "ColorRGB", [0.8, 0.8, 0.8]);
  addVectorProperty(properties, "BBoxMin", "Vector3D", [0, 0, 0]);
  addVectorProperty(properties, "BBoxMax", "Vector3D", [0, 0, 0]);
  addBoolProperty(properties, "Primary Visibility", true);
  addBoolProperty(properties, "Casts Shadows", true);
  addBoolProperty(properties, "Receive Shadows", true);
}

function addMaterialTemplate(objectType) {
  const properties = addTemplate(objectType, "FbxSurfacePhong");
  addStringProperty(properties, "ShadingModel", "Phong");
  addVectorProperty(properties, "EmissiveColor", "Color", [0, 0, 0]);
  addDoubleProperty(properties, "EmissiveFactor", "Number", 1);
  addVectorProperty(properties, "AmbientColor", "Color", [0.2, 0.2, 0.2]);
  addDoubleProperty(properties, "AmbientFactor", "Number", 1);
  addVectorProperty(properties, "DiffuseColor", "Color", [0.8, 0.8, 0.8]);
  addDoubleProperty(properties, "DiffuseFactor", "Number", 1);
  addDoubleProperty(properties, "BumpFactor", "Number", 1);
  addDoubleProperty(properties, "TransparencyFactor", "Number", 0);
  addDoubleProperty(properties, "Opacity", "Number", 1);
}

function addTextureTemplate(objectType) {
  const properties = addTemplate(objectType, "FbxFileTexture");
  addIntProperty(properties, "TextureTypeUse", "enum", 0);
  addIntProperty(properties, "AlphaSource", "enum", 0);
  addDoubleProperty(properties, "Texture alpha", "Number", 1);
  addBoolProperty(properties, "PremultiplyAlpha", false);
  addIntProperty(properties, "CurrentTextureBlendMode", "enum", 0);
  addIntProperty(properties, "CurrentMappingType", "enum", 0);
  addIntProperty(properties, "WrapModeU", "enum", 1);
  addIntProperty(properties, "WrapModeV", "enum", 1);
  addBoolProperty(properties, "UVSwap", false);
  addVectorProperty(properties, "Translation", "Vector3D", [0, 0, 0]);
  addVectorProperty(properties, "Rotation", "Vector3D", [0, 0, 0]);
  addVectorProperty(properties, "Scaling", "Vector3D", [1, 1, 1]);
  addVectorProperty(properties, "TextureRotationPivot", "Vector3D", [0, 0, 0]);
  addVectorProperty(properties, "TextureScalingPivot", "Vector3D", [0, 0, 0]);
  addBoolProperty(properties, "UseMipMap", false);
}

function addVideoTemplate(objectType) {
  const properties = addTemplate(objectType, "FbxVideo");
  addIntProperty(properties, "Width", "int", 0);
  addIntProperty(properties, "Height", "int", 0);
  addStringProperty(properties, "Path", "");
  addIntProperty(properties, "AccessMode", "enum", 0);
  addIntProperty(properties, "StartFrame", "int", 0);
  addIntProperty(properties, "StopFrame", "int", 0);
  addTimeProperty(properties, "Offset", 0);
  addDoubleProperty(properties, "PlaySpeed", "Number", 0);
  addBoolProperty(properties, "Loop", false);
  addDoubleProperty(properties, "FrameRate", "Number", 0);
  addIntProperty(properties, "LastFrame", "int", 0);
}

function addAnimationStackTemplate(objectType) {
  const properties = addTemplate(objectType, "FbxAnimStack");
  addStringProperty(properties, "Description", "");
  addTimeProperty(properties, "LocalStart", 0);
  addTimeProperty(properties, "LocalStop", 0);
  addTimeProperty(properties, "ReferenceStart", 0);
  addTimeProperty(properties, "ReferenceStop", 0);
}

function addAnimationLayerTemplate(objectType) {
  const properties = addTemplate(objectType, "FbxAnimLayer");
  addDoubleProperty(properties, "Weight", "Number", 100);
  addBoolProperty(properties, "Mute", false);
  addBoolProperty(properties, "Solo", false);
  addBoolProperty(properties, "Lock", false);
  addVectorProperty(properties, "Color", "ColorRGB", [0.8, 0.8, 0.8]);
  addIntProperty(properties, "BlendMode", "enum", 0);
  addIntProperty(properties, "RotationAccumulationMode", "enum", 0);
  addIntProperty(properties, "ScaleAccumulationMode", "enum", 0);
}

function addAnimationCurveNodeTemplate(objectType) {
  const properties = addTemplate(objectType, "FbxAnimCurveNode");
  addDoubleProperty(properties, "d|X", "Number", 0);
  addDoubleProperty(properties, "d|Y", "Number", 0);
  addDoubleProperty(properties, "d|Z", "Number", 0);
}

function addNodeAttributeTemplate(objectType) {
  const properties = addTemplate(objectType, "FbxNodeAttribute");
  addVectorProperty(properties, "Color", "ColorRGB", [0.8, 0.8, 0.8]);
  addDoubleProperty(properties, "Size", "double", 100);
}

const DEFINITION_TEMPLATE_BUILDERS = Object.freeze({
  Model: addModelTemplate,
  Geometry: addGeometryTemplate,
  Material: addMaterialTemplate,
  Texture: addTextureTemplate,
  Video: addVideoTemplate,
  LayeredTexture: (objectType) => addTemplate(objectType, "FbxLayeredTexture"),
  NodeAttribute: addNodeAttributeTemplate,
  Pose: (objectType) => addTemplate(objectType, "FbxPose"),
  Deformer: (objectType) => addTemplate(objectType, "FbxDeformer"),
  AnimationStack: addAnimationStackTemplate,
  AnimationLayer: addAnimationLayerTemplate,
  AnimationCurveNode: addAnimationCurveNodeTemplate,
  AnimationCurve: (objectType) => addTemplate(objectType, "FbxAnimCurve")
});

export function addDefinitionPropertyTemplate(objectType, typeName) {
  DEFINITION_TEMPLATE_BUILDERS[typeName]?.(objectType);
}
