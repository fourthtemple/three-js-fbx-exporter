import {
  normalizeTextureAtlas,
  textureAtlasFrameTransform
} from "./texture-atlas.js";

const TEXTURE_ATLAS_FRAME_PROPERTIES = Object.freeze({
  textureAtlasFrame: "textureAtlasFrame",
  atlasFrame: "textureAtlasFrame",
  tileIndex: "textureAtlasFrame",
  flipbookFrame: "textureAtlasFrame",
  textureAtlasColumn: "textureAtlasColumn",
  atlasColumn: "textureAtlasColumn",
  tileColumn: "textureAtlasColumn",
  tileX: "textureAtlasColumn",
  column: "textureAtlasColumn",
  col: "textureAtlasColumn",
  textureAtlasRow: "textureAtlasRow",
  atlasRow: "textureAtlasRow",
  tileRow: "textureAtlasRow",
  tileY: "textureAtlasRow",
  row: "textureAtlasRow",
  textureAtlasTile: "textureAtlasTile",
  atlasTile: "textureAtlasTile",
  atlasCell: "textureAtlasTile",
  tile: "textureAtlasTile",
  flipbookTile: "textureAtlasTile"
});

function textureAtlasTargetKey(track) {
  return track.target || track.texture || track.textureName || track.object;
}

function textureAtlasForTrack(track, options = {}) {
  return normalizeTextureAtlas(track) ||
    options.textureAtlasByTarget?.get(textureAtlasTargetKey(track)) ||
    null;
}

function textureAtlasKeyframes(track, atlas, valueKey) {
  return (track.keyframes || track.keys || []).map((keyframe) => ({
    ...keyframe,
    value: textureAtlasFrameTransform(atlas, keyframe, track)[valueKey]
  }));
}

function textureAtlasComponentKeyframes(track, atlas, property) {
  const sourceKey = property === "textureAtlasColumn" ? "atlasColumn" : "atlasRow";
  const axis = property === "textureAtlasColumn" ? 0 : 1;
  return (track.keyframes || track.keys || []).map((keyframe) => {
    const source = keyframe.value && typeof keyframe.value === "object"
      ? { value: keyframe.value }
      : { [sourceKey]: keyframe.value ?? textureAtlasComponentValue(keyframe, property) };
    return {
      ...keyframe,
      value: textureAtlasFrameTransform(atlas, source, track).translation[axis]
    };
  });
}

function textureAtlasComponentValue(keyframe, property) {
  return property === "textureAtlasColumn"
    ? keyframe.atlasColumn ?? keyframe.tileColumn ?? keyframe.tileX ?? keyframe.column ?? keyframe.col
    : keyframe.atlasRow ?? keyframe.tileRow ?? keyframe.tileY ?? keyframe.row;
}

function textureAtlasTrackHasTargetAtlas(track, options) {
  return Boolean(options.textureAtlasByTarget?.has(textureAtlasTargetKey(track)));
}

export function normalizeTextureAtlasAnimationProperty(property) {
  return TEXTURE_ATLAS_FRAME_PROPERTIES[property] || null;
}

export function expandTextureAtlasAnimationTrack(track, options = {}) {
  const property = normalizeTextureAtlasAnimationProperty(track.property || track.channel);
  if (!property) {
    return [track];
  }
  const atlas = textureAtlasForTrack(track, options);
  if (!atlas) {
    throw new Error("Texture atlas frame animation requires atlasColumns and atlasRows on the track or target texture");
  }
  if (property === "textureAtlasColumn" || property === "textureAtlasRow") {
    const tracks = [{
      ...track,
      property: property === "textureAtlasColumn" ? "textureTranslationX" : "textureTranslationY",
      keyframes: textureAtlasComponentKeyframes(track, atlas, property)
    }];
    if (!textureAtlasTrackHasTargetAtlas(track, options)) {
      tracks.push({
        ...track,
        property: "textureScale",
        keyframes: textureAtlasKeyframes(track, atlas, "scale")
      });
    }
    return tracks;
  }
  return [
    {
      ...track,
      property: "textureTranslation",
      keyframes: textureAtlasKeyframes(track, atlas, "translation")
    },
    {
      ...track,
      property: "textureScale",
      keyframes: textureAtlasKeyframes(track, atlas, "scale")
    }
  ];
}
