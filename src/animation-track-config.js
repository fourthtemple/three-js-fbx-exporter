// Blender imports FocusDistance curves as value / 1000 * globalScale.
// With FBX UnitScaleFactor 1.0, globalScale is 0.01, so this preserves scene units.
import {
  customMaterialAnimationKind,
  customMaterialFbxProperty,
  customMaterialVectorComponentIndex,
  isCustomMaterialAnimationProperty
} from "./material-custom-properties.js";
import {
  customTextureAnimationKind,
  customTextureFbxProperty,
  customTextureVectorComponentIndex,
  isCustomTextureAnimationProperty
} from "./texture-custom-properties.js";
import { componentValue } from "./component-value.js";
import { createMaterialAnimationTracks } from "./material-animation-track-config.js";
import { customModelTrack } from "./model-custom-animation-track-config.js";
import { createModelAnimationTracks } from "./model-animation-track-config.js";
import { isCustomModelAnimationProperty } from "./model-custom-properties.js";
import { normalizeTextureScalarKeyValue } from "./texture-animation-normalizer.js";
import { textureLayerTrack } from "./texture-layer-animation-track-config.js";
import { isTextureLayerAnimationProperty } from "./texture-layer-animation-normalizer.js";
import { normalizeTextureVideoScalarKeyValue } from "./texture-video-animation-normalizer.js";

const CAMERA_FOCUS_DISTANCE_ANIMATION_SCALE = 100000;
const VECTOR_AXES = ["X", "Y", "Z"];

function textureScalarTrack(property, field, fallback) {
  return {
    property,
    group: property,
    channels: [property],
    defaultValue(record) {
      return record.texture?.[field] ?? fallback;
    },
    value(keyframe) {
      return keyframe.value;
    },
    targetId(record) {
      return record.ids.texture;
    }
  };
}

function textureVectorComponentTrack(property, fbxProperty, field, index, fallback) {
  return {
    property: fbxProperty,
    group: fbxProperty,
    channels: [VECTOR_AXES[index]],
    defaultValue(record) {
      return record.texture?.[field]?.[index] ?? fallback;
    },
    value(keyframe) {
      return componentValue(keyframe.value, index, fallback);
    },
    targetId(record) {
      return record.ids.texture;
    }
  };
}

function textureVectorTrack(property, field, fallback) {
  return {
    property,
    group: property,
    defaultValue(record) {
      return record.texture?.[field] || fallback;
    },
    targetId(record) {
      return record.ids.texture;
    }
  };
}

function textureCropTrack(property, field) {
  return {
    property,
    group: property,
    channels: [property],
    defaultValue(record) {
      return record.texture?.cropping?.[field] ?? 0;
    },
    value(keyframe) {
      return keyframe.value;
    },
    targetId(record) {
      return record.ids.texture;
    }
  };
}

function textureMetadataTrack(property, field, fallback, animationProperty) {
  return {
    property,
    group: property,
    channels: [property],
    defaultValue(record) {
      return normalizeTextureScalarKeyValue(record.texture?.[field] ?? fallback, animationProperty);
    },
    value(keyframe) {
      return keyframe.value;
    },
    targetId(record) {
      return record.ids.texture;
    }
  };
}

function textureVideoTrack(property, field, fallback, animationProperty) {
  return {
    property,
    group: property,
    channels: [property],
    defaultValue(record) {
      return normalizeTextureVideoScalarKeyValue(record.texture?.[field] ?? fallback, animationProperty);
    },
    value(keyframe) {
      return keyframe.value;
    },
    targetId(record) {
      return record.ids.video;
    }
  };
}

function lightScalarTrack(property, field, fallback, scale = 1) {
  return {
    property,
    group: property,
    channels: [property],
    defaultValue(record) {
      return (record[field] ?? fallback) * scale;
    },
    value(keyframe) {
      return keyframe.value * scale;
    },
    targetId(record) {
      return record.ids.attribute;
    }
  };
}

function customMaterialProperty(record, fbxProperty, animationProperty) {
  return (record.material?.customProperties || []).find((property) => {
    return property.name === fbxProperty || property.animationProperty === animationProperty;
  });
}

function customMaterialScalarTrack(animationProperty) {
  const fbxProperty = customMaterialFbxProperty(animationProperty);
  return {
    property: fbxProperty,
    group: fbxProperty,
    channels: [fbxProperty],
    defaultValue(record) {
      return customMaterialProperty(record, fbxProperty, animationProperty)?.value ?? 0;
    },
    value(keyframe) {
      return keyframe.value;
    },
    targetId(record) {
      return record.id;
    }
  };
}

function customMaterialVectorTrack(animationProperty) {
  const fbxProperty = customMaterialFbxProperty(animationProperty);
  return {
    property: fbxProperty,
    group: fbxProperty,
    defaultValue(record) {
      return customMaterialProperty(record, fbxProperty, animationProperty)?.value ?? [0, 0, 0];
    },
    targetId(record) {
      return record.id;
    }
  };
}

function customMaterialVectorComponentTrack(animationProperty) {
  const fbxProperty = customMaterialFbxProperty(animationProperty);
  const componentIndex = customMaterialVectorComponentIndex(animationProperty);
  return {
    property: fbxProperty,
    group: fbxProperty,
    channels: [VECTOR_AXES[componentIndex]],
    defaultValue(record) {
      return customMaterialProperty(record, fbxProperty, animationProperty)?.value?.[componentIndex] ?? 0;
    },
    value(keyframe) {
      return componentValue(keyframe.value, componentIndex, 0);
    },
    targetId(record) {
      return record.id;
    }
  };
}

function customMaterialTrack(animationProperty) {
  const kind = customMaterialAnimationKind(animationProperty);
  return kind === "vector" || kind === "color"
    ? customMaterialVectorTrack(animationProperty)
    : kind === "vectorComponent"
      ? customMaterialVectorComponentTrack(animationProperty)
      : customMaterialScalarTrack(animationProperty);
}

function customTextureProperty(record, fbxProperty, animationProperty) {
  return (record.texture?.customProperties || []).find((property) => {
    return property.name === fbxProperty || property.animationProperty === animationProperty;
  });
}

function customTextureScalarTrack(animationProperty) {
  const fbxProperty = customTextureFbxProperty(animationProperty);
  return {
    property: fbxProperty,
    group: fbxProperty,
    channels: [fbxProperty],
    defaultValue(record) {
      return customTextureProperty(record, fbxProperty, animationProperty)?.value ?? 0;
    },
    value(keyframe) {
      return keyframe.value;
    },
    targetId(record) {
      return record.ids.texture;
    }
  };
}

function customTextureVectorTrack(animationProperty) {
  const fbxProperty = customTextureFbxProperty(animationProperty);
  return {
    property: fbxProperty,
    group: fbxProperty,
    defaultValue(record) {
      return customTextureProperty(record, fbxProperty, animationProperty)?.value ?? [0, 0, 0];
    },
    targetId(record) {
      return record.ids.texture;
    }
  };
}

function customTextureVectorComponentTrack(animationProperty) {
  const fbxProperty = customTextureFbxProperty(animationProperty);
  const componentIndex = customTextureVectorComponentIndex(animationProperty);
  return {
    property: fbxProperty,
    group: fbxProperty,
    channels: [VECTOR_AXES[componentIndex]],
    defaultValue(record) {
      return customTextureProperty(record, fbxProperty, animationProperty)?.value?.[componentIndex] ?? 0;
    },
    value(keyframe) {
      return componentValue(keyframe.value, componentIndex, 0);
    },
    targetId(record) {
      return record.ids.texture;
    }
  };
}

function customTextureTrack(animationProperty) {
  const kind = customTextureAnimationKind(animationProperty);
  return kind === "vector" || kind === "color"
    ? customTextureVectorTrack(animationProperty)
    : kind === "vectorComponent"
      ? customTextureVectorComponentTrack(animationProperty)
      : customTextureScalarTrack(animationProperty);
}

function recordVisibility(record) {
  return record.visibility ??
    record.mesh?.visibility ??
    record.node?.visibility ??
    record.camera?.visibility ??
    record.light?.visibility ??
    1;
}

function targetTransform(record) {
  return record.transform || record.mesh?.transform || record.material;
}

const TRACKS = {
  ...createModelAnimationTracks(),
  visibility: {
    property: "Visibility",
    group: "Visibility",
    channels: ["Visibility"],
    defaultValue: recordVisibility,
    value(keyframe) {
      return keyframe.value;
    },
    targetId(record) {
      return record.ids.model;
    }
  },
  morph: {
    property: "DeformPercent",
    group: "DeformPercent",
    channels: ["DeformPercent"],
    defaultValue(record) {
      return (record.defaultValue || 0) * 100;
    },
    value(keyframe) {
      return keyframe.value * 100;
    },
    targetId(record) {
      return record.ids.channel;
    }
  },
  ...createMaterialAnimationTracks(),
  cameraFocalLength: {
    property: "FocalLength",
    group: "FocalLength",
    channels: ["FocalLength"],
    defaultValue(record) {
      return record.focalLength ?? 35;
    },
    value(keyframe) {
      return keyframe.value;
    },
    targetId(record) {
      return record.ids.attribute;
    }
  },
  cameraFocusDistance: {
    property: "FocusDistance",
    group: "FocusDistance",
    channels: ["FocusDistance"],
    defaultValue(record) {
      return (record.focusDistance ?? 10) * CAMERA_FOCUS_DISTANCE_ANIMATION_SCALE;
    },
    value(keyframe) {
      return keyframe.value * CAMERA_FOCUS_DISTANCE_ANIMATION_SCALE;
    },
    targetId(record) {
      return record.ids.attribute;
    }
  },
  cameraOrthoZoom: {
    property: "OrthoZoom",
    group: "OrthoZoom",
    channels: ["OrthoZoom"],
    defaultValue(record) {
      return record.orthoZoom ?? 1;
    },
    value(keyframe) {
      return keyframe.value;
    },
    targetId(record) {
      return record.ids.attribute;
    }
  },
  lightColor: {
    property: "Color",
    group: "Color",
    defaultValue(record) {
      return record.color || [1, 1, 1];
    },
    targetId(record) {
      return record.ids.attribute;
    }
  },
  lightIntensity: lightScalarTrack("Intensity", "intensity", 1, 100),
  lightDistance: lightScalarTrack("FarAttenuationEnd", "distance", 0),
  lightInnerAngle: lightScalarTrack("InnerAngle", "innerAngle", 40),
  lightOuterAngle: lightScalarTrack("OuterAngle", "outerAngle", 45),
  textureTranslation: {
    property: "Translation",
    group: "Translation",
    defaultValue(record) {
      return record.texture?.translation || [0, 0, 0];
    },
    targetId(record) {
      return record.ids.texture;
    }
  },
  textureTranslationX: textureVectorComponentTrack("textureTranslationX", "Translation", "translation", 0, 0),
  textureTranslationY: textureVectorComponentTrack("textureTranslationY", "Translation", "translation", 1, 0),
  textureTranslationZ: textureVectorComponentTrack("textureTranslationZ", "Translation", "translation", 2, 0),
  textureRotation: {
    property: "Rotation",
    group: "Rotation",
    defaultValue(record) {
      return record.texture?.rotation || [0, 0, 0];
    },
    targetId(record) {
      return record.ids.texture;
    }
  },
  textureRotationX: textureVectorComponentTrack("textureRotationX", "Rotation", "rotation", 0, 0),
  textureRotationY: textureVectorComponentTrack("textureRotationY", "Rotation", "rotation", 1, 0),
  textureRotationZ: textureVectorComponentTrack("textureRotationZ", "Rotation", "rotation", 2, 0),
  textureScale: {
    property: "Scaling",
    group: "Scaling",
    defaultValue(record) {
      return record.texture?.scale || [1, 1, 1];
    },
    targetId(record) {
      return record.ids.texture;
    }
  },
  textureScaleX: textureVectorComponentTrack("textureScaleX", "Scaling", "scale", 0, 1),
  textureScaleY: textureVectorComponentTrack("textureScaleY", "Scaling", "scale", 1, 1),
  textureScaleZ: textureVectorComponentTrack("textureScaleZ", "Scaling", "scale", 2, 1),
  textureRotationPivot: textureVectorTrack("TextureRotationPivot", "rotationPivot", [0, 0, 0]),
  textureRotationPivotX: textureVectorComponentTrack("textureRotationPivotX", "TextureRotationPivot", "rotationPivot", 0, 0),
  textureRotationPivotY: textureVectorComponentTrack("textureRotationPivotY", "TextureRotationPivot", "rotationPivot", 1, 0),
  textureRotationPivotZ: textureVectorComponentTrack("textureRotationPivotZ", "TextureRotationPivot", "rotationPivot", 2, 0),
  textureScalingPivot: textureVectorTrack("TextureScalingPivot", "scalingPivot", [0, 0, 0]),
  textureScalingPivotX: textureVectorComponentTrack("textureScalingPivotX", "TextureScalingPivot", "scalingPivot", 0, 0),
  textureScalingPivotY: textureVectorComponentTrack("textureScalingPivotY", "TextureScalingPivot", "scalingPivot", 1, 0),
  textureScalingPivotZ: textureVectorComponentTrack("textureScalingPivotZ", "TextureScalingPivot", "scalingPivot", 2, 0),
  textureAlpha: textureScalarTrack("Texture alpha", "alpha", 1),
  textureCropLeft: textureCropTrack("CroppingLeft", "left"),
  textureCropTop: textureCropTrack("CroppingTop", "top"),
  textureCropRight: textureCropTrack("CroppingRight", "right"),
  textureCropBottom: textureCropTrack("CroppingBottom", "bottom"),
  textureWrapU: textureMetadataTrack("WrapModeU", "wrapU", "clamp", "textureWrapU"),
  textureWrapV: textureMetadataTrack("WrapModeV", "wrapV", "clamp", "textureWrapV"),
  textureWrapW: textureMetadataTrack("Maya|wrap_mode_w", "wrapW", "clamp", "textureWrapW"),
  textureMappingType: textureMetadataTrack("CurrentMappingType", "mappingType", 0, "textureMappingType"),
  textureBlendMode: textureMetadataTrack("CurrentTextureBlendMode", "blendMode", 0, "textureBlendMode"),
  textureTypeUse: textureMetadataTrack("TextureTypeUse", "textureTypeUse", 0, "textureTypeUse"),
  textureAlphaSource: textureMetadataTrack("AlphaSource", "alphaSource", 0, "textureAlphaSource"),
  textureUseMipMap: textureMetadataTrack("UseMipMap", "useMipMap", false, "textureUseMipMap"),
  textureUvSwap: textureMetadataTrack("UVSwap", "uvSwap", false, "textureUvSwap"),
  texturePremultiplyAlpha: textureMetadataTrack("PremultiplyAlpha", "premultiplyAlpha", false, "texturePremultiplyAlpha"),
  textureColorSpace: textureMetadataTrack("Maya|color_space_id", "colorSpace", "", "textureColorSpace"),
  textureEncoding: textureMetadataTrack("Maya|encoding", "encoding", 0, "textureEncoding"),
  textureFlipY: textureMetadataTrack("Maya|flip_y", "flipY", false, "textureFlipY"),
  textureUnpackAlignment: textureMetadataTrack("Maya|unpack_alignment", "unpackAlignment", 4, "textureUnpackAlignment"),
  textureMinFilter: textureMetadataTrack("Maya|min_filter", "minFilter", 1008, "textureMinFilter"),
  textureMagFilter: textureMetadataTrack("Maya|mag_filter", "magFilter", 1006, "textureMagFilter"),
  textureAnisotropy: textureMetadataTrack("Maya|anisotropy", "anisotropy", 1, "textureAnisotropy"),
  textureFormat: textureMetadataTrack("Maya|format", "format", 1023, "textureFormat"),
  textureType: textureMetadataTrack("Maya|type", "type", 1009, "textureType"),
  textureInternalFormatId: textureMetadataTrack("Maya|internal_format_id", "internalFormatId", 0, "textureInternalFormatId"),
  textureIsDepthTexture: textureMetadataTrack("Maya|is_depth_texture", "isDepthTexture", false, "textureIsDepthTexture"),
  textureCompareFunction: textureMetadataTrack("Maya|compare_function", "compareFunction", 0, "textureCompareFunction"),
  textureDimensionId: textureMetadataTrack("Maya|texture_dimension_id", "textureDimensionId", 0, "textureDimensionId"),
  textureDepth: textureMetadataTrack("Maya|texture_depth", "textureDepth", 1, "textureDepth"),
  textureLayers: textureMetadataTrack("Maya|texture_layers", "textureLayers", 1, "textureLayers"),
  textureIsDataTexture: textureMetadataTrack("Maya|is_data_texture", "isDataTexture", false, "textureIsDataTexture"),
  textureIsCompressedTexture: textureMetadataTrack("Maya|is_compressed_texture", "isCompressedTexture", false, "textureIsCompressedTexture"),
  textureIsTextureArray: textureMetadataTrack("Maya|is_texture_array", "isTextureArray", false, "textureIsTextureArray"),
  textureMipmapCount: textureMetadataTrack("Maya|mipmap_count", "mipmapCount", 0, "textureMipmapCount"),
  textureMatrixAutoUpdate: textureMetadataTrack("Maya|matrix_auto_update", "matrixAutoUpdate", true, "textureMatrixAutoUpdate"),
  videoWidth: textureVideoTrack("Width", "width", 0, "videoWidth"),
  videoHeight: textureVideoTrack("Height", "height", 0, "videoHeight"),
  videoAccessMode: textureVideoTrack("AccessMode", "accessMode", 0, "videoAccessMode"),
  videoStartFrame: textureVideoTrack("StartFrame", "startFrame", 0, "videoStartFrame"),
  videoStopFrame: textureVideoTrack("StopFrame", "stopFrame", 0, "videoStopFrame"),
  videoOffset: textureVideoTrack("Offset", "videoOffset", 0, "videoOffset"),
  videoCurrentTime: textureVideoTrack("Offset", "videoOffset", 0, "videoOffset"),
  videoPlaySpeed: textureVideoTrack("PlaySpeed", "playSpeed", 0, "videoPlaySpeed"),
  videoFreeRunning: textureVideoTrack("FreeRunning", "freeRunning", false, "videoFreeRunning"),
  videoLoop: textureVideoTrack("Loop", "loop", false, "videoLoop"),
  videoInterlaceMode: textureVideoTrack("InterlaceMode", "interlaceMode", 0, "videoInterlaceMode"),
  videoImageSequence: textureVideoTrack("ImageSequence", "imageSequence", false, "videoImageSequence"),
  videoImageSequenceOffset: textureVideoTrack("ImageSequenceOffset", "imageSequenceOffset", 0, "videoImageSequenceOffset"),
  videoFrameRate: textureVideoTrack("FrameRate", "frameRate", 0, "videoFrameRate"),
  videoLastFrame: textureVideoTrack("LastFrame", "lastFrame", 0, "videoLastFrame")
};

export function animationTrackConfig(track) {
  if (isCustomModelAnimationProperty(track.property)) {
    return customModelTrack(track.property);
  }
  if (isCustomMaterialAnimationProperty(track.property)) {
    return customMaterialTrack(track.property);
  }
  if (isCustomTextureAnimationProperty(track.property)) {
    return customTextureTrack(track.property);
  }
  if (isTextureLayerAnimationProperty(track.property)) {
    return textureLayerTrack(track.property);
  }
  const config = TRACKS[track.property];
  if (!config) {
    throw new Error(`Unsupported FBX animation property: ${track.property}`);
  }
  return config;
}

export function animationTrackChannels(config) {
  return config.channels || ["X", "Y", "Z"];
}

export function animationTrackDefaults(track) {
  const channels = animationTrackChannels(track.config);
  if (track.config.defaultValue) {
    const value = track.config.defaultValue(track.targetRecord);
    return Array.isArray(value) ? value : channels.map(() => value);
  }
  return targetTransform(track.targetRecord)[track.config.defaultsFrom];
}
