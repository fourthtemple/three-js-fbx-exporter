import {
  textureLayerAlphaProperty,
  textureLayerBlendModeProperty
} from "./texture-layer-properties.js";
import {
  textureLayerAnimationIndex,
  textureLayerAnimationKind
} from "./texture-layer-animation-normalizer.js";

function layerTexture(record, index) {
  return record.layer?.textures?.[index]?.texture || {};
}

export function textureLayerTrack(animationProperty) {
  const kind = textureLayerAnimationKind(animationProperty);
  const index = textureLayerAnimationIndex(animationProperty);
  const property = kind === "alpha"
    ? textureLayerAlphaProperty(index)
    : textureLayerBlendModeProperty(index);
  return {
    property,
    group: property,
    channels: [property],
    defaultValue(record) {
      const texture = layerTexture(record, index);
      return kind === "alpha" ? texture.alpha ?? 1 : texture.blendMode ?? 0;
    },
    value(keyframe) {
      return keyframe.value;
    },
    targetId(record) {
      return record.ids.textureLayer;
    }
  };
}
