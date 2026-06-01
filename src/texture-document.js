import { FbxNode } from "./binary-writer.js";
import {
  addBoolProperty,
  addDoubleProperty,
  addIntProperty,
  addProperties70,
  addStringProperty,
  addTimeProperty,
  addVectorProperty,
  fbxName,
  int32,
  int64,
  rawBytes
} from "./fbx-values.js";
import { layeredTextureIds } from "./texture-layer-document.js";
import { cropValues } from "./texture-cropping.js";

const TEXTURE_VERSION = 202;

function textureName(material, texture) {
  return texture.name || `${material.name}${texture.label || "Texture"}`;
}

function textureFileName(texture) {
  return texture.fileName || texture.path || texture.relativeFileName || "";
}

function textureRelativeName(texture) {
  return texture.relativeFileName || texture.fileName || texture.path || "";
}

function addCustomTextureProperties(properties, texture) {
  for (const property of texture.customProperties || []) {
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
}

export function countTextureObjects(records) {
  return records.reduce((count, record) => {
    return count + record.materials.reduce((sum, materialRecord) => {
      return sum + materialRecord.textures.length;
    }, 0);
  }, 0);
}

export function buildTexture(record, materialRecord, textureRecord) {
  const { material } = materialRecord;
  const { texture } = textureRecord;
  const name = textureName(material, texture);
  const fileName = textureFileName(texture);
  const relativeName = textureRelativeName(texture);
  const node = new FbxNode("Texture", [int64(textureRecord.textureId), fbxName("Texture", name), ""]);
  node.add("Type", ["TextureVideoClip"]);
  node.add("Version", [TEXTURE_VERSION]);
  node.add("TextureName", [fbxName("Texture", name)]);
  node.add("Media", [fbxName("Video", name)]);
  node.add("FileName", [fileName]);
  node.add("RelativeFilename", [relativeName]);

  const properties = addProperties70(node);
  const [cropLeft, cropTop, cropRight, cropBottom] = cropValues(texture.cropping);
  addIntProperty(properties, "TextureTypeUse", "enum", texture.textureTypeUse ?? 0);
  addIntProperty(properties, "AlphaSource", "enum", texture.alphaSource ?? 0);
  addDoubleProperty(properties, "Texture alpha", "Number", texture.alpha ?? 1);
  addBoolProperty(properties, "PremultiplyAlpha", Boolean(texture.premultiplyAlpha));
  addStringProperty(properties, "Maya|color_space", texture.colorSpace ?? "");
  addIntProperty(properties, "Maya|color_space_id", "enum", texture.colorSpaceId ?? 0);
  addIntProperty(properties, "Maya|encoding", "enum", texture.encoding ?? 0);
  addBoolProperty(properties, "Maya|flip_y", Boolean(texture.flipY));
  addIntProperty(properties, "Maya|unpack_alignment", "int", texture.unpackAlignment ?? 4);
  addIntProperty(properties, "Maya|min_filter", "enum", texture.minFilter ?? 1008);
  addIntProperty(properties, "Maya|mag_filter", "enum", texture.magFilter ?? 1006);
  addDoubleProperty(properties, "Maya|anisotropy", "Number", texture.anisotropy ?? 1);
  addIntProperty(properties, "Maya|format", "enum", texture.format ?? 1023);
  addIntProperty(properties, "Maya|type", "enum", texture.type ?? 1009);
  addStringProperty(properties, "Maya|internal_format", texture.internalFormat ?? "");
  addIntProperty(properties, "Maya|internal_format_id", "enum", texture.internalFormatId ?? 0);
  addBoolProperty(properties, "Maya|is_depth_texture", Boolean(texture.isDepthTexture));
  addIntProperty(properties, "Maya|compare_function", "enum", texture.compareFunction ?? 0);
  addStringProperty(properties, "Maya|texture_dimension", texture.textureDimension ?? "");
  addIntProperty(properties, "Maya|texture_dimension_id", "enum", texture.textureDimensionId ?? 0);
  addIntProperty(properties, "Maya|texture_depth", "int", texture.textureDepth ?? 1);
  addIntProperty(properties, "Maya|texture_layers", "int", texture.textureLayers ?? 1);
  addBoolProperty(properties, "Maya|is_data_texture", Boolean(texture.isDataTexture));
  addBoolProperty(properties, "Maya|is_compressed_texture", Boolean(texture.isCompressedTexture));
  addBoolProperty(properties, "Maya|is_texture_array", Boolean(texture.isTextureArray));
  addIntProperty(properties, "Maya|mipmap_count", "int", texture.mipmapCount ?? 0);
  addBoolProperty(properties, "Maya|matrix_auto_update", texture.matrixAutoUpdate ?? true);
  addIntProperty(properties, "Maya|atlas_columns", "int", texture.atlasColumns ?? 0);
  addIntProperty(properties, "Maya|atlas_rows", "int", texture.atlasRows ?? 0);
  addIntProperty(properties, "Maya|atlas_frame_count", "int", texture.atlasFrameCount ?? 0);
  addIntProperty(properties, "Maya|atlas_frame", "int", texture.atlasFrame ?? 0);
  addIntProperty(properties, "Maya|atlas_column", "int", texture.atlasColumn ?? 0);
  addIntProperty(properties, "Maya|atlas_row", "int", texture.atlasRow ?? 0);
  addStringProperty(properties, "Maya|atlas_origin", texture.atlasOrigin ?? "");
  addIntProperty(properties, "CurrentTextureBlendMode", "enum", texture.blendMode ?? 0);
  addIntProperty(properties, "CurrentMappingType", "enum", texture.mappingType ?? 0);
  if (texture.uvSet) {
    properties.add("P", ["UVSet", "KString", "", "", texture.uvSet]);
  }
  addIntProperty(properties, "WrapModeU", "enum", texture.wrapU === "repeat" ? 0 : 1);
  addIntProperty(properties, "WrapModeV", "enum", texture.wrapV === "repeat" ? 0 : 1);
  addIntProperty(properties, "Maya|wrap_mode_w", "enum", texture.wrapW === "repeat" ? 0 : 1);
  addBoolProperty(properties, "UVSwap", Boolean(texture.uvSwap));
  addIntProperty(properties, "CroppingLeft", "int", cropLeft);
  addIntProperty(properties, "CroppingTop", "int", cropTop);
  addIntProperty(properties, "CroppingRight", "int", cropRight);
  addIntProperty(properties, "CroppingBottom", "int", cropBottom);
  addVectorProperty(properties, "Translation", "Vector3D", texture.translation || [0, 0, 0]);
  addVectorProperty(properties, "Rotation", "Vector3D", texture.rotation || [0, 0, 0]);
  addVectorProperty(properties, "Scaling", "Vector3D", texture.scale || [1, 1, 1]);
  addVectorProperty(properties, "TextureRotationPivot", "Vector3D", texture.rotationPivot || [0, 0, 0]);
  addVectorProperty(properties, "TextureScalingPivot", "Vector3D", texture.scalingPivot || [0, 0, 0]);
  addBoolProperty(properties, "UseMaterial", true);
  addBoolProperty(properties, "UseMipMap", Boolean(texture.useMipMap));
  addCustomTextureProperties(properties, texture);
  return node;
}

export function buildVideo(record, materialRecord, textureRecord) {
  const { material } = materialRecord;
  const { texture } = textureRecord;
  const name = textureName(material, texture);
  const fileName = textureFileName(texture);
  const relativeName = textureRelativeName(texture);
  const node = new FbxNode("Video", [int64(textureRecord.videoId), fbxName("Video", name), "Clip"]);
  node.add("Type", ["Clip"]);
  const properties = addProperties70(node);
  addIntProperty(properties, "Width", "int", texture.width ?? 0);
  addIntProperty(properties, "Height", "int", texture.height ?? 0);
  properties.add("P", ["Path", "KString", "XRefUrl", "", fileName]);
  addIntProperty(properties, "AccessMode", "enum", texture.accessMode ?? (texture.content ? 1 : 0));
  addIntProperty(properties, "StartFrame", "int", texture.startFrame ?? 0);
  addIntProperty(properties, "StopFrame", "int", texture.stopFrame ?? 0);
  addTimeProperty(properties, "Offset", texture.videoOffset ?? 0);
  addDoubleProperty(properties, "PlaySpeed", "Number", texture.playSpeed ?? 0);
  addBoolProperty(properties, "FreeRunning", Boolean(texture.freeRunning));
  addBoolProperty(properties, "Loop", Boolean(texture.loop));
  addIntProperty(properties, "InterlaceMode", "enum", texture.interlaceMode ?? 0);
  addBoolProperty(properties, "ImageSequence", Boolean(texture.imageSequence));
  addIntProperty(properties, "ImageSequenceOffset", "int", texture.imageSequenceOffset ?? 0);
  addDoubleProperty(properties, "FrameRate", "Number", texture.frameRate ?? 0);
  addIntProperty(properties, "LastFrame", "int", texture.lastFrame ?? 0);
  addCustomTextureProperties(properties, texture);
  node.add("UseMipMap", [int32(texture.useMipMap ? 1 : 0)]);
  node.add("Filename", [fileName]);
  node.add("RelativeFilename", [relativeName]);
  if (texture.content) {
    node.add("Content", [rawBytes(texture.content)]);
  }
  return node;
}

export function buildTextureConnections(connections, record, materialRecord) {
  const layeredIds = layeredTextureIds(materialRecord);
  for (const textureRecord of materialRecord.textures) {
    if (!layeredIds.has(textureRecord.textureId)) {
      connections.add("C", [
        "OP",
        int64(textureRecord.textureId),
        int64(materialRecord.id),
        textureRecord.texture.property || "DiffuseColor"
      ]);
    }
    connections.add("C", ["OO", int64(textureRecord.videoId), int64(textureRecord.textureId)]);
  }
}
