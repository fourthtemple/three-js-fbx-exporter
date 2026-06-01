import assert from "node:assert/strict";
import { test } from "node:test";
import {
  animationTrackChannels,
  animationTrackConfig,
  animationTrackDefaults
} from "../src/animation-track-config.js";
import {
  textureLayerAlphaAnimationProperty,
  textureLayerBlendModeAnimationProperty
} from "../src/texture-layer-animation-normalizer.js";
import { customTextureVectorComponentAnimationProperty } from "../src/texture-custom-properties.js";

test("keeps vector default values aligned with animation channels", () => {
  const config = animationTrackConfig({ property: "lightColor" });
  const track = {
    config,
    targetRecord: {
      color: [1, 0.8, 0.6],
      ids: { attribute: 1001 }
    }
  };

  assert.deepEqual(animationTrackChannels(config), ["X", "Y", "Z"]);
  assert.deepEqual(animationTrackDefaults(track), [1, 0.8, 0.6]);
});

test("expands scalar default values across single-channel tracks", () => {
  const config = animationTrackConfig({ property: "visibility" });
  const track = {
    config,
    targetRecord: {
      visibility: 0,
      ids: { model: 1002 }
    }
  };

  assert.deepEqual(animationTrackChannels(config), ["Visibility"]);
  assert.deepEqual(animationTrackDefaults(track), [0]);
});

test("uses texture pivot defaults for texture pivot animation nodes", () => {
  const config = animationTrackConfig({ property: "textureRotationPivot" });
  const track = {
    config,
    targetRecord: {
      texture: {
        rotationPivot: [0.5, 0.25, 0]
      },
      ids: { texture: 1003 }
    }
  };

  assert.deepEqual(animationTrackChannels(config), ["X", "Y", "Z"]);
  assert.deepEqual(animationTrackDefaults(track), [0.5, 0.25, 0]);
});

test("uses model transform metadata defaults for model animation nodes", () => {
  const config = animationTrackConfig({ property: "rotationPivot" });
  const track = {
    config,
    targetRecord: {
      transform: {
        rotationPivot: [1, 2, 3]
      },
      ids: { model: 1003 }
    }
  };

  assert.deepEqual(animationTrackChannels(config), ["X", "Y", "Z"]);
  assert.deepEqual(animationTrackDefaults(track), [1, 2, 3]);
});

test("uses model transform metadata defaults for component animation nodes", () => {
  const config = animationTrackConfig({ property: "geometricScalingZ" });
  const track = {
    config,
    targetRecord: {
      transform: {
        geometricScaling: [1.5, 1.25, 0.75]
      },
      ids: { model: 1004 }
    }
  };

  assert.deepEqual(animationTrackChannels(config), ["Z"]);
  assert.deepEqual(animationTrackDefaults(track), [0.75]);
});

test("extracts object and typed-array component animation key values", () => {
  const textureConfig = animationTrackConfig({ property: "textureTranslationY" });
  const modelConfig = animationTrackConfig({ property: "geometricScalingZ" });
  const materialConfig = animationTrackConfig({ property: "diffuseColorB" });
  const customTextureConfig = animationTrackConfig({
    property: customTextureVectorComponentAnimationProperty("Maya|scroll_vector", 1)
  });

  assert.equal(textureConfig.value({ value: { x: 1, y: 2, z: 3 } }), 2);
  assert.equal(modelConfig.value({ value: new Float32Array([4, 5, 6]) }), 6);
  assert.equal(materialConfig.value({ value: { r: 0.25, g: 0.5, b: 0.75 } }), 0.75);
  assert.equal(customTextureConfig.value({ value: { u: 7, v: 8, w: 9 } }), 8);
});

test("uses texture cropping defaults for texture crop animation nodes", () => {
  const config = animationTrackConfig({ property: "textureCropLeft" });
  const track = {
    config,
    targetRecord: {
      texture: {
        cropping: { left: 3, top: 4, right: 5, bottom: 6 }
      },
      ids: { texture: 1005 }
    }
  };

  assert.deepEqual(animationTrackChannels(config), ["CroppingLeft"]);
  assert.deepEqual(animationTrackDefaults(track), [3]);
});

test("normalizes texture metadata defaults for texture metadata animation nodes", () => {
  const config = animationTrackConfig({ property: "textureWrapU" });
  const track = {
    config,
    targetRecord: {
      texture: {
        wrapU: "repeat"
      },
      ids: { texture: 1006 }
    }
  };

  assert.deepEqual(animationTrackChannels(config), ["WrapModeU"]);
  assert.deepEqual(animationTrackDefaults(track), [0]);
});

test("targets video ids for texture video animation nodes", () => {
  const config = animationTrackConfig({ property: "videoWidth" });
  const targetRecord = {
    texture: {
      width: 1920
    },
    ids: { texture: 1007, video: 1008 }
  };
  const track = { config, targetRecord };

  assert.deepEqual(animationTrackChannels(config), ["Width"]);
  assert.deepEqual(animationTrackDefaults(track), [1920]);
  assert.equal(config.targetId(targetRecord), 1008);
});

test("targets layered texture ids for layer alpha and blend animation nodes", () => {
  const targetRecord = {
    ids: { textureLayer: 1010 },
    layer: {
      textures: [
        { texture: { alpha: 1, blendMode: 0 } },
        { texture: { alpha: 0.35, blendMode: 1 } }
      ]
    }
  };
  const alphaConfig = animationTrackConfig({ property: textureLayerAlphaAnimationProperty(1) });
  const blendConfig = animationTrackConfig({ property: textureLayerBlendModeAnimationProperty(1) });

  assert.deepEqual(animationTrackChannels(alphaConfig), ["Maya|layer_alpha_1"]);
  assert.deepEqual(animationTrackDefaults({ config: alphaConfig, targetRecord }), [0.35]);
  assert.equal(alphaConfig.targetId(targetRecord), 1010);
  assert.deepEqual(animationTrackChannels(blendConfig), ["Maya|layer_blend_mode_1"]);
  assert.deepEqual(animationTrackDefaults({ config: blendConfig, targetRecord }), [1]);
  assert.equal(blendConfig.targetId(targetRecord), 1010);
});

test("uses material clipping plane defaults for material animation nodes", () => {
  const config = animationTrackConfig({ property: "clippingPlane0Normal" });
  const targetRecord = {
    id: 1009,
    material: {
      clippingPlanes: [
        { normal: [0.25, 0.5, 0.75], constant: -0.25 }
      ]
    }
  };
  const track = { config, targetRecord };

  assert.deepEqual(animationTrackChannels(config), ["X", "Y", "Z"]);
  assert.deepEqual(animationTrackDefaults(track), [0.25, 0.5, 0.75]);
  assert.equal(config.targetId(targetRecord), 1009);
});
