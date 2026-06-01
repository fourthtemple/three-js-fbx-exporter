import { FbxNode } from "./binary-writer.js";
import {
  addDoubleProperty,
  addIntProperty,
  addProperties70,
  fbxName,
  float64Array,
  int32,
  int32Array,
  int64
} from "./fbx-values.js";
import {
  groupedLayerTextureEntries,
  textureLayerAlphaProperty,
  textureLayerBlendModeProperty,
  textureLayerName
} from "./texture-layer-properties.js";

const LAYERED_TEXTURE_VERSION = 100;

export function textureLayerGroups(materialRecord) {
  return groupedLayerTextureEntries(materialRecord.textures);
}

export function createTextureLayerRecords(materialRecord, nextId) {
  return textureLayerGroups(materialRecord).map((group) => ({
    ...group,
    id: nextId(),
    name: textureLayerName(materialRecord.material, group.property),
    animationName: materialRecord.material.animationName
      ? textureLayerName(materialRecord.material.animationName, group.property)
      : null
  }));
}

export function countTextureLayerObjects(records) {
  return records.reduce((count, record) => {
    return count + record.materials.reduce((sum, materialRecord) => {
      return sum + (materialRecord.layers?.length || 0);
    }, 0);
  }, 0);
}

export function layeredTextureIds(materialRecord) {
  return new Set((materialRecord.layers || []).flatMap((layer) => {
    return layer.textures.map((textureRecord) => textureRecord.textureId);
  }));
}

export function buildTextureLayer(layerRecord) {
  const node = new FbxNode("LayeredTexture", [
    int64(layerRecord.id),
    fbxName("LayeredTexture", layerRecord.name),
    ""
  ]);
  node.add("Type", ["LayeredTexture"]);
  node.add("Version", [int32(LAYERED_TEXTURE_VERSION)]);
  node.add("BlendModes", [int32Array(layerRecord.textures.map((textureRecord) => {
    return textureRecord.texture.blendMode ?? 0;
  }))]);
  node.add("Alphas", [float64Array(layerRecord.textures.map((textureRecord) => {
    return textureRecord.texture.alpha ?? 1;
  }))]);
  const properties = addProperties70(node);
  layerRecord.textures.forEach((textureRecord, index) => {
    addDoubleProperty(properties, textureLayerAlphaProperty(index), "Number", textureRecord.texture.alpha ?? 1);
    addIntProperty(properties, textureLayerBlendModeProperty(index), "int", textureRecord.texture.blendMode ?? 0);
  });
  return node;
}

export function buildTextureLayerConnections(connections, materialRecord) {
  for (const layerRecord of materialRecord.layers || []) {
    connections.add("C", [
      "OP",
      int64(layerRecord.id),
      int64(materialRecord.id),
      layerRecord.property
    ]);
    for (const textureRecord of layerRecord.textures) {
      connections.add("C", ["OO", int64(textureRecord.textureId), int64(layerRecord.id)]);
    }
  }
}
