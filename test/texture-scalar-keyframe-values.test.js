import assert from "node:assert/strict";
import { test } from "node:test";
import { textureScalarKeyframeValue } from "../src/texture-animation-normalizer.js";

test("normalizes object-valued texture scalar keyframe aliases", () => {
  assert.equal(textureScalarKeyframeValue({ value: { alpha: 0.4 } }, "textureAlpha"), 0.4);
  assert.equal(textureScalarKeyframeValue({ value: { value: { opacity: 0.42 } } }, "textureAlpha"), 0.42);
  assert.equal(textureScalarKeyframeValue({ opacity: 0.35 }, "textureAlpha"), 0.35);
  assert.equal(textureScalarKeyframeValue({ value: { wrapS: "repeat" } }, "textureWrapU"), 0);
  assert.equal(textureScalarKeyframeValue({ value: { defaultValue: { wrapT: "repeat" } } }, "textureWrapV"), 0);
  assert.equal(textureScalarKeyframeValue({ value: { blendMode: "multiply" } }, "textureBlendMode"), 2);
  assert.equal(textureScalarKeyframeValue({ value: { left: 12 } }, "textureCropLeft"), 12);
  assert.equal(textureScalarKeyframeValue({ value: { cropTop: 4 } }, "textureCropTop"), 4);
  assert.equal(textureScalarKeyframeValue({ defaultValue: { cropBottom: 9 } }, "textureCropBottom"), 9);
  assert.equal(textureScalarKeyframeValue({ value: { premultiplyAlpha: "false" } }, "texturePremultiplyAlpha"), 0);
});

test("keeps texture component keyframe object values component-based", () => {
  assert.equal(textureScalarKeyframeValue({ value: { x: 0.25, y: 0.5 } }, "textureTranslationY"), 0.5);
  assert.equal(textureScalarKeyframeValue({ value: { offset: [0.25, 0.5, 0] } }, "textureTranslationY"), 0.5);
  assert.equal(textureScalarKeyframeValue({ value: { value: { repeat: { x: 2, y: 3, z: 1 } } } }, "textureScaleY"), 3);
  assert.equal(textureScalarKeyframeValue({ defaultValue: { rotation: [0, 0, 0.75] } }, "textureRotationZ"), 0.75);
});
