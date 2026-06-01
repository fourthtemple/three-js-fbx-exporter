import assert from "node:assert/strict";
import { test } from "node:test";
import {
  customAnimationScalarKeyframeValue,
  customAnimationVectorKeyframeValue
} from "../src/custom-animation-keyframe-value.js";
import { customMaterialAnimationProperty, customMaterialVectorComponentAnimationProperty } from "../src/material-custom-properties.js";
import { customModelAnimationProperty, customModelVectorComponentAnimationProperty } from "../src/model-custom-properties.js";
import { customTextureAnimationProperty, customTextureVectorComponentAnimationProperty } from "../src/texture-custom-properties.js";

test("extracts texture custom animation values from keyed object payloads", () => {
  assert.equal(
    customAnimationScalarKeyframeValue(
      { value: { "Maya|texture_gain": 0.8 } },
      customTextureAnimationProperty("scalar", "Maya|texture_gain")
    ),
    0.8
  );
  assert.deepEqual(
    customAnimationVectorKeyframeValue(
      { value: { "Maya|texture_tint": { r: 0.1, g: 0.2, b: 0.3 } } },
      customTextureAnimationProperty("color", "Maya|texture_tint")
    ),
    { r: 0.1, g: 0.2, b: 0.3 }
  );
  assert.equal(
    customAnimationScalarKeyframeValue(
      { value: { "Maya|scroll_vector": [1, 2, 3] } },
      customTextureVectorComponentAnimationProperty("Maya|scroll_vector", 1)
    ),
    2
  );
});

test("extracts material and model custom animation values from keyed object payloads", () => {
  assert.equal(
    customAnimationScalarKeyframeValue(
      { value: { "Maya|material_gain": 0.9 } },
      customMaterialAnimationProperty("scalar", "Maya|material_gain")
    ),
    0.9
  );
  assert.equal(
    customAnimationScalarKeyframeValue(
      { value: { "Maya|model_flow": [4, 5, 6] } },
      customModelVectorComponentAnimationProperty("Maya|model_flow", 2)
    ),
    6
  );
  assert.deepEqual(
    customAnimationVectorKeyframeValue(
      { value: { "Maya|model_tint": [0.4, 0.5, 0.6] } },
      customModelAnimationProperty("color", "Maya|model_tint")
    ),
    [0.4, 0.5, 0.6]
  );
  assert.equal(
    customAnimationScalarKeyframeValue(
      { value: { "Maya|flow_vector": [1, 2, 3] } },
      customMaterialVectorComponentAnimationProperty("Maya|flow_vector", 2)
    ),
    3
  );
});

test("extracts custom animation values from nested value wrappers", () => {
  assert.equal(
    customAnimationScalarKeyframeValue(
      { value: { value: { "Maya|texture_gain": { value: 0.95 } } } },
      customTextureAnimationProperty("scalar", "Maya|texture_gain")
    ),
    0.95
  );
  assert.deepEqual(
    customAnimationVectorKeyframeValue(
      { value: { defaultValue: { "Maya|material_tint": { defaultValue: { r: 0.2, g: 0.4, b: 0.6 } } } } },
      customMaterialAnimationProperty("color", "Maya|material_tint")
    ),
    { r: 0.2, g: 0.4, b: 0.6 }
  );
  assert.equal(
    customAnimationScalarKeyframeValue(
      { defaultValue: { value: { "Maya|model_flow": { value: [3, 4, 5] } } } },
      customModelVectorComponentAnimationProperty("Maya|model_flow", 1)
    ),
    4
  );
  assert.deepEqual(
    customAnimationVectorKeyframeValue(
      { value: { value: [0.1, 0.2, 0.3] } },
      customTextureAnimationProperty("vector", "Maya|unkeyed_vector")
    ),
    [0.1, 0.2, 0.3]
  );
});
