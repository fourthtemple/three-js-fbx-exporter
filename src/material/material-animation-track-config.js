import {
  MATERIAL_CLIPPING_PLANE_LIMIT,
  materialClippingPlaneConstantField,
  materialClippingPlaneConstantProperty,
  materialClippingPlaneNormalComponentField,
  materialClippingPlaneNormalField,
  materialClippingPlaneNormalProperty
} from "./material-clipping.js";
import { componentValue } from "../core/component-value.js";

const VECTOR_AXES = ["X", "Y", "Z"];

function materialScalarTrack(property, field, fallback) {
  return {
    property,
    group: property,
    channels: [property],
    defaultValue(record) {
      return record.material?.[field] ?? fallback;
    },
    value(keyframe) {
      return keyframe.value;
    },
    targetId(record) {
      return record.id;
    }
  };
}

function materialColorTrack(property, field) {
  return {
    property,
    group: property,
    defaultsFrom: field,
    targetId(record) {
      return record.id;
    }
  };
}

function materialColorComponentTrack(property, field, index) {
  return {
    property,
    group: property,
    channels: [VECTOR_AXES[index]],
    defaultValue(record) {
      return record.material?.[field]?.[index] ?? 0;
    },
    value(keyframe) {
      return componentValue(keyframe.value, index, 0);
    },
    targetId(record) {
      return record.id;
    }
  };
}

function materialClippingPlaneConstantTrack(index) {
  const property = materialClippingPlaneConstantProperty(index);
  return {
    property,
    group: property,
    channels: [property],
    defaultValue(record) {
      return record.material?.clippingPlanes?.[index]?.constant ?? 0;
    },
    value(keyframe) {
      return keyframe.value;
    },
    targetId(record) {
      return record.id;
    }
  };
}

function materialClippingPlaneNormalTrack(index) {
  const property = materialClippingPlaneNormalProperty(index);
  return {
    property,
    group: property,
    defaultValue(record) {
      return record.material?.clippingPlanes?.[index]?.normal ?? [0, 1, 0];
    },
    targetId(record) {
      return record.id;
    }
  };
}

function materialClippingPlaneNormalComponentTrack(index, componentIndex) {
  const property = materialClippingPlaneNormalProperty(index);
  return {
    property,
    group: property,
    channels: [VECTOR_AXES[componentIndex]],
    defaultValue(record) {
      return record.material?.clippingPlanes?.[index]?.normal?.[componentIndex] ?? (componentIndex === 1 ? 1 : 0);
    },
    value(keyframe) {
      return componentValue(keyframe.value, componentIndex, componentIndex === 1 ? 1 : 0);
    },
    targetId(record) {
      return record.id;
    }
  };
}

export function createMaterialAnimationTracks() {
  const tracks = {
    diffuseColor: materialColorTrack("DiffuseColor", "diffuseColor"),
    diffuseColorR: materialColorComponentTrack("DiffuseColor", "diffuseColor", 0),
    diffuseColorG: materialColorComponentTrack("DiffuseColor", "diffuseColor", 1),
    diffuseColorB: materialColorComponentTrack("DiffuseColor", "diffuseColor", 2),
    emissiveColor: materialColorTrack("EmissiveColor", "emissiveColor"),
    emissiveColorR: materialColorComponentTrack("EmissiveColor", "emissiveColor", 0),
    emissiveColorG: materialColorComponentTrack("EmissiveColor", "emissiveColor", 1),
    emissiveColorB: materialColorComponentTrack("EmissiveColor", "emissiveColor", 2),
    ambientColor: materialColorTrack("AmbientColor", "ambientColor"),
    ambientColorR: materialColorComponentTrack("AmbientColor", "ambientColor", 0),
    ambientColorG: materialColorComponentTrack("AmbientColor", "ambientColor", 1),
    ambientColorB: materialColorComponentTrack("AmbientColor", "ambientColor", 2),
    specularColor: materialColorTrack("SpecularColor", "specularColor"),
    specularColorR: materialColorComponentTrack("SpecularColor", "specularColor", 0),
    specularColorG: materialColorComponentTrack("SpecularColor", "specularColor", 1),
    specularColorB: materialColorComponentTrack("SpecularColor", "specularColor", 2),
    transparentColor: materialColorTrack("TransparentColor", "transparentColor"),
    transparentColorR: materialColorComponentTrack("TransparentColor", "transparentColor", 0),
    transparentColorG: materialColorComponentTrack("TransparentColor", "transparentColor", 1),
    transparentColorB: materialColorComponentTrack("TransparentColor", "transparentColor", 2),
    blendColor: materialColorTrack("Maya|blend_color", "blendColor"),
    blendColorR: materialColorComponentTrack("Maya|blend_color", "blendColor", 0),
    blendColorG: materialColorComponentTrack("Maya|blend_color", "blendColor", 1),
    blendColorB: materialColorComponentTrack("Maya|blend_color", "blendColor", 2),
    attenuationColor: materialColorTrack("Maya|attenuation_color", "attenuationColor"),
    attenuationColorR: materialColorComponentTrack("Maya|attenuation_color", "attenuationColor", 0),
    attenuationColorG: materialColorComponentTrack("Maya|attenuation_color", "attenuationColor", 1),
    attenuationColorB: materialColorComponentTrack("Maya|attenuation_color", "attenuationColor", 2),
    opacity: materialScalarTrack("Opacity", "opacity", 1),
    transparencyFactor: materialScalarTrack("TransparencyFactor", "transparencyFactor", 0),
    diffuseFactor: materialScalarTrack("DiffuseFactor", "diffuseFactor", 1),
    emissiveFactor: materialScalarTrack("EmissiveFactor", "emissiveFactor", 1),
    ambientFactor: materialScalarTrack("AmbientFactor", "ambientFactor", 1),
    specularFactor: materialScalarTrack("SpecularFactor", "specularFactor", 0.25),
    shininess: materialScalarTrack("Shininess", "shininess", 20),
    bumpFactor: materialScalarTrack("BumpFactor", "bumpFactor", 1),
    displacementFactor: materialScalarTrack("DisplacementFactor", "displacementFactor", 1),
    vectorDisplacementFactor: materialScalarTrack("VectorDisplacementFactor", "vectorDisplacementFactor", 1),
    reflectionFactor: materialScalarTrack("ReflectionFactor", "reflectionFactor", 0),
    anisotropy: materialScalarTrack("Maya|anisotropy", "anisotropy", 0),
    anisotropyRotation: materialScalarTrack("Maya|anisotropy_rotation", "anisotropyRotation", 0),
    iridescence: materialScalarTrack("Maya|iridescence", "iridescence", 0),
    iridescenceIOR: materialScalarTrack("Maya|iridescence_ior", "iridescenceIOR", 1.3),
    iridescenceThicknessMinimum: materialScalarTrack("Maya|iridescence_thickness_minimum", "iridescenceThicknessMinimum", 100),
    iridescenceThicknessMaximum: materialScalarTrack("Maya|iridescence_thickness_maximum", "iridescenceThicknessMaximum", 400),
    thickness: materialScalarTrack("Maya|thickness", "thickness", 0),
    attenuationDistance: materialScalarTrack("Maya|attenuation_distance", "attenuationDistance", 0),
    ior: materialScalarTrack("Maya|ior", "ior", 1.5),
    dispersion: materialScalarTrack("Maya|dispersion", "dispersion", 0),
    aoMapIntensity: materialScalarTrack("Maya|ao_map_intensity", "aoMapIntensity", 1),
    displacementBias: materialScalarTrack("Maya|displacement_bias", "displacementBias", 0),
    alphaTest: materialScalarTrack("Maya|alpha_test", "alphaTest", 0),
    normalMapType: materialScalarTrack("Maya|normal_map_type", "normalMapType", 0),
    side: materialScalarTrack("Maya|side", "side", 0),
    blending: materialScalarTrack("Maya|blending", "blending", 1),
    blendSrc: materialScalarTrack("Maya|blend_src", "blendSrc", 204),
    blendDst: materialScalarTrack("Maya|blend_dst", "blendDst", 205),
    blendEquation: materialScalarTrack("Maya|blend_equation", "blendEquation", 100),
    blendSrcAlpha: materialScalarTrack("Maya|blend_src_alpha", "blendSrcAlpha", -1),
    blendDstAlpha: materialScalarTrack("Maya|blend_dst_alpha", "blendDstAlpha", -1),
    blendEquationAlpha: materialScalarTrack("Maya|blend_equation_alpha", "blendEquationAlpha", -1),
    blendAlpha: materialScalarTrack("Maya|blend_alpha", "blendAlpha", 0),
    depthFunc: materialScalarTrack("Maya|depth_func", "depthFunc", 3),
    depthTest: materialScalarTrack("Maya|depth_test", "depthTest", 1),
    depthWrite: materialScalarTrack("Maya|depth_write", "depthWrite", 1),
    colorWrite: materialScalarTrack("Maya|color_write", "colorWrite", 1),
    vertexColors: materialScalarTrack("Maya|vertex_colors", "vertexColors", 0),
    fog: materialScalarTrack("Maya|fog", "fog", 1),
    materialVisible: materialScalarTrack("Maya|material_visible", "materialVisible", 1),
    allowOverride: materialScalarTrack("Maya|allow_override", "allowOverride", 1),
    shadowSide: materialScalarTrack("Maya|shadow_side", "shadowSide", -1),
    polygonOffset: materialScalarTrack("Maya|polygon_offset", "polygonOffset", 0),
    polygonOffsetFactor: materialScalarTrack("Maya|polygon_offset_factor", "polygonOffsetFactor", 0),
    polygonOffsetUnits: materialScalarTrack("Maya|polygon_offset_units", "polygonOffsetUnits", 0),
    stencilWrite: materialScalarTrack("Maya|stencil_write", "stencilWrite", 0),
    stencilWriteMask: materialScalarTrack("Maya|stencil_write_mask", "stencilWriteMask", 255),
    stencilFunc: materialScalarTrack("Maya|stencil_func", "stencilFunc", 519),
    stencilRef: materialScalarTrack("Maya|stencil_ref", "stencilRef", 0),
    stencilFuncMask: materialScalarTrack("Maya|stencil_func_mask", "stencilFuncMask", 255),
    stencilFail: materialScalarTrack("Maya|stencil_fail", "stencilFail", 7680),
    stencilZFail: materialScalarTrack("Maya|stencil_z_fail", "stencilZFail", 7680),
    stencilZPass: materialScalarTrack("Maya|stencil_z_pass", "stencilZPass", 7680),
    clipIntersection: materialScalarTrack("Maya|clip_intersection", "clipIntersection", 0),
    clipShadows: materialScalarTrack("Maya|clip_shadows", "clipShadows", 0),
    clippingPlaneCount: materialScalarTrack("Maya|clipping_plane_count", "clippingPlaneCount", 0),
    alphaHash: materialScalarTrack("Maya|alpha_hash", "alphaHash", 0),
    alphaToCoverage: materialScalarTrack("Maya|alpha_to_coverage", "alphaToCoverage", 0),
    premultipliedAlpha: materialScalarTrack("Maya|premultiplied_alpha", "premultipliedAlpha", 0),
    forceSinglePass: materialScalarTrack("Maya|force_single_pass", "forceSinglePass", 0),
    toneMapped: materialScalarTrack("Maya|tone_mapped", "toneMapped", 1),
    dithering: materialScalarTrack("Maya|dithering", "dithering", 0),
    wireframe: materialScalarTrack("Maya|wireframe", "wireframe", 0),
    wireframeLinewidth: materialScalarTrack("Maya|wireframe_linewidth", "wireframeLinewidth", 1)
  };

  for (let index = 0; index < MATERIAL_CLIPPING_PLANE_LIMIT; index += 1) {
    tracks[materialClippingPlaneNormalField(index)] = materialClippingPlaneNormalTrack(index);
    tracks[materialClippingPlaneConstantField(index)] = materialClippingPlaneConstantTrack(index);
    for (let componentIndex = 0; componentIndex < VECTOR_AXES.length; componentIndex += 1) {
      tracks[materialClippingPlaneNormalComponentField(index, componentIndex)] = materialClippingPlaneNormalComponentTrack(index, componentIndex);
    }
  }

  return tracks;
}
