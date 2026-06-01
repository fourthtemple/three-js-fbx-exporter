import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AnimationClip,
  BufferGeometry,
  Color,
  ColorKeyframeTrack,
  Float32BufferAttribute,
  Mesh,
  NumberKeyframeTrack,
  ShaderMaterial,
  Texture,
  Vector3,
  VectorKeyframeTrack
} from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { FBX_KTIME } from "../src/core/fbx-values.js";
import { arrayBufferFrom, decode, withMockDocument } from "./fbx-test-helpers.js";

function rounded(values) {
  return values.map((value) => Number(value.toFixed(4)));
}

function quadGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0,
    -1, 1, 0
  ], 3));
  geometry.setAttribute("normal", new Float32BufferAttribute([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1
  ], 3));
  geometry.setAttribute("uv", new Float32BufferAttribute([
    0, 0,
    1, 0,
    1, 1,
    0, 1
  ], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
}

function shaderTexture({
  animate = false,
  animationName = "ShaderTextureDrift",
  customProperties = false,
  fileName = "shader-uniform.tga",
  name = "shader_diffuse"
} = {}) {
  const texture = new Texture({ src: fileName });
  texture.name = name;
  texture.userData.relativeFileName = fileName;
  if (customProperties) {
    texture.userData.customProperties = {
      "Maya|shader_texture_gain": { kind: "scalar", value: 0.5 }
    };
  }
  if (animate) {
    texture.animations = [
      new AnimationClip(animationName, 1, [
        new VectorKeyframeTrack("offset", [0, 1], [
          0, 0,
          0.25, 0.5
        ])
      ])
    ];
  }
  return texture;
}

function shaderScene({
  meshAnimations = false,
  textureAnimations = false,
  uniformTextureDetailAnimations = false,
  uniformTextureMatrixAnimations = false,
  uniformTextureNestedTransformAnimations = false,
  uniformTextureNestedMatrixAnimations = false,
  plainTextureUniform = false,
  plainTextureUserDataSourceUniform = false,
  scalarArrayAnimations = false,
  scalarArrayUniform = false,
  textureArrayAnimations = false,
  textureArrayClipAnimations = false,
  textureArrayDetailAnimations = false,
  textureArrayUniform = false,
  vectorColorArrayAnimations = false,
  vectorColorArrayUniform = false
} = {}) {
  const uniforms = {
    uTime: { value: 0.5 },
    uTint: { value: new Color(0.25, 0.5, 1) },
    uOffset: { value: new Vector3(1, 2, 3) },
    uMap: {
      value: shaderTexture({
        animate: textureAnimations,
        customProperties: uniformTextureDetailAnimations
      })
    }
  };
  if (plainTextureUniform) {
    uniforms.uPlainMap = {
      value: {
        name: "shader_plain",
        src: "shader-plain.tga",
        userData: {
          relativeFileName: "shader-plain.tga"
        },
        offset: [0.125, 0.25],
        repeat: [2, 3]
      }
    };
  }
  if (plainTextureUserDataSourceUniform) {
    uniforms.uPlainSourceMap = {
      value: {
        name: "shader_plain_source",
        userData: {
          source: {
            currentSrc: "media/shader-source.mp4",
            videoWidth: 640,
            videoHeight: 360,
            duration: 2,
            fps: 24
          }
        }
      }
    };
  }
  if (scalarArrayUniform) {
    uniforms.uWeights = {
      value: new Float32Array([0.1, 0.2, 0.3, 0.4])
    };
  }
  if (vectorColorArrayUniform) {
    uniforms.uColorStops = {
      value: [
        new Color(1, 0, 0),
        new Color(0, 1, 0)
      ]
    };
    uniforms.uVectorStops = {
      value: [
        new Vector3(1, 2, 3),
        new Vector3(4, 5, 6)
      ]
    };
  }
  if (textureArrayUniform) {
    uniforms.uTextureArray = {
      value: [
        shaderTexture({
          animate: textureArrayAnimations,
          animationName: "ShaderTextureArrayDrift",
          customProperties: textureArrayDetailAnimations,
          fileName: "shader-array-a.tga",
          name: "shader_array_a"
        }),
        {
          name: "shader_array_b",
          src: "shader-array-b.tga",
          userData: {
            customProperties: textureArrayDetailAnimations
              ? {
                  "Maya|shader_array_gain": { kind: "scalar", value: 0.35 }
                }
              : undefined,
            relativeFileName: "shader-array-b.tga"
          },
          offset: [0.2, 0.3],
          repeat: [4, 5]
        }
      ]
    };
  }
  const material = new ShaderMaterial({
    name: "ShaderUniformMaterial",
    uniforms,
    vertexShader: "void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: "void main(){gl_FragColor=vec4(1.0);}"
  });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "ShaderQuad";
  const animations = [];
  if (meshAnimations) {
    animations.push(
      new AnimationClip("ShaderUniforms", 1, [
        new NumberKeyframeTrack("ShaderQuad.material.uniforms.uTime.value", [0, 1], [0.5, 1]),
        new VectorKeyframeTrack("ShaderQuad.material.uniforms.uOffset.value", [0, 1], [
          1, 2, 3,
          4, 5, 6
        ]),
        new VectorKeyframeTrack("ShaderQuad.material.uniforms.uMap.value.offset", [0, 1], [
          0, 0,
          0.125, 0.25
        ]),
        new NumberKeyframeTrack("ShaderQuad.material.uniforms.uMap.value.rotation[2]", [0, 1], [0.1, 0.4])
      ])
    );
  }
  if (uniformTextureDetailAnimations) {
    animations.push(
      new AnimationClip("ShaderTextureDetails", 1, [
        new VectorKeyframeTrack("ShaderQuad.material.uniforms.uMap.value.center", [0, 1], [
          0.5, 0.5,
          0.25, 0.75
        ]),
        new NumberKeyframeTrack(
          "ShaderQuad.material.uniforms.uMap.value.userData.customProperties[Maya|shader_texture_gain].value",
          [0, 1],
          [0.5, 1]
        )
      ])
    );
  }
  if (uniformTextureMatrixAnimations) {
    animations.push(
      new AnimationClip("ShaderTextureMatrix", 1, [
        new VectorKeyframeTrack("ShaderQuad.material.uniforms.uMap.value.userData.uvMatrix.elements", [0, 1], [
          2, 0, 0,
          0, 3, 0,
          0.125, -0.25, 1,
          4, 0, 0,
          0, 5, 0,
          0.25, 0.5, 1
        ])
      ])
    );
  }
  if (uniformTextureNestedTransformAnimations) {
    animations.push(
      new AnimationClip("ShaderTextureNestedTransforms", 1, [
        new VectorKeyframeTrack("ShaderQuad.material.uniforms.uMap.value.userData.source.data.offset", [0, 1], [
          0.2, 0.4,
          0.5, 0.7
        ]),
        new NumberKeyframeTrack("ShaderQuad.material.uniforms.uMap.value.userData.image.rotation", [0, 1], [0.45, 0.75]),
        new VectorKeyframeTrack("ShaderQuad.material.uniforms.uMap.value.source.data.repeat", [0, 1], [
          5, 6,
          7, 8
        ]),
        new VectorKeyframeTrack("ShaderQuad.material.uniforms.uMap.value.image.center", [0, 1], [
          0.3, 0.7,
          0.4, 0.8
        ])
      ])
    );
  }
  if (uniformTextureNestedMatrixAnimations) {
    animations.push(
      new AnimationClip("ShaderTextureNestedMatrix", 1, [
        new VectorKeyframeTrack("ShaderQuad.material.uniforms.uMap.value.userData.source.data.uvMatrix.elements", [0, 1], [
          7, 0, 0,
          0, 8, 0,
          0.625, 0.125, 1,
          9, 0, 0,
          0, 10, 0,
          0.75, 0.25, 1
        ])
      ])
    );
  }
  if (scalarArrayAnimations) {
    animations.push(
      new AnimationClip("ShaderUniformArrayWeights", 1, [
        new VectorKeyframeTrack("ShaderQuad.material.uniforms.uWeights.value", [0, 1], [
          0.1, 0.2, 0.3, 0.4,
          0.5, 0.6, 0.7, 0.8
        ])
      ]),
      new AnimationClip("ShaderUniformArrayWeightIndex", 1, [
        new NumberKeyframeTrack("ShaderQuad.material.uniforms.uWeights.value[2]", [0, 1], [0.3, 0.95])
      ])
    );
  }
  if (vectorColorArrayAnimations) {
    animations.push(
      new AnimationClip("ShaderUniformVectorColorArrays", 1, [
        new ColorKeyframeTrack("ShaderQuad.material.uniforms.uColorStops.value[1]", [0, 1], [
          0, 1, 0,
          0, 0, 1
        ]),
        new VectorKeyframeTrack("ShaderQuad.material.uniforms.uVectorStops.value[0]", [0, 1], [
          1, 2, 3,
          7, 8, 9
        ])
      ])
    );
  }
  if (textureArrayClipAnimations) {
    animations.push(
      new AnimationClip("ShaderTextureArrayClip", 1, [
        new VectorKeyframeTrack("ShaderQuad.material.uniforms.uTextureArray.value[1].offset", [0, 1], [
          0.2, 0.3,
          0.4, 0.6
        ]),
        new NumberKeyframeTrack("ShaderQuad.material.uniforms.uTextureArray.value[0].rotation", [0, 1], [0, 0.75]),
        new VectorKeyframeTrack("ShaderQuad.material.uniforms.uTextureArray.value[1].userData.source.data.repeat", [0, 1], [
          4, 5,
          6, 7
        ])
      ])
    );
  }
  if (textureArrayDetailAnimations) {
    animations.push(
      new AnimationClip("ShaderTextureArrayDetails", 1, [
        new NumberKeyframeTrack(
          "ShaderQuad.material.uniforms.uTextureArray.value[1].userData.customProperties[Maya|shader_array_gain].value",
          [0, 1],
          [0.35, 0.9]
        ),
        new NumberKeyframeTrack("ShaderQuad.material.uniforms.uTextureArray.value[0].image.currentTime", [0, 1], [0.25, 0.75])
      ])
    );
  }
  if (animations.length) {
    mesh.animations = animations;
  }
  return mesh;
}

test("adapts ShaderMaterial uniforms into custom FBX properties and texture lanes", () => {
  const scene = fromThreeObject(shaderScene());
  const material = scene.meshes[0].materials[0];

  assert.equal(material.name, "ShaderUniformMaterial");
  assert.deepEqual(material.customProperties.map((property) => [property.name, property.kind]), [
    ["Maya|shader_uniform_uTime", "scalar"],
    ["Maya|shader_uniform_uTint", "color"],
    ["Maya|shader_uniform_uOffset", "vector"]
  ]);
  assert.equal(material.customProperties[0].value, 0.5);
  assert.deepEqual(rounded(material.customProperties[2].value), [1, 2, 3]);
  assert.deepEqual(material.textures.map((texture) => [texture.name, texture.property, texture.sourceTextureField]), [
    ["shader_diffuse", "Maya|TEX_shader_uniform_uMap", "shaderUniform:uMap"]
  ]);
});

test("adapts plain ShaderMaterial texture uniform records", () => {
  const scene = fromThreeObject(shaderScene({ plainTextureUniform: true }));
  const material = scene.meshes[0].materials[0];
  const plainTexture = material.textures.find((texture) => texture.sourceUniformName === "uPlainMap");

  assert.ok(plainTexture);
  assert.equal(plainTexture.name, "shader_plain");
  assert.equal(plainTexture.property, "Maya|TEX_shader_uniform_uPlainMap");
  assert.equal(plainTexture.sourceTextureField, "shaderUniform:uPlainMap");
  assert.equal(plainTexture.relativeFileName, "shader-plain.tga");
  assert.deepEqual(rounded(plainTexture.translation), [0.125, 0.25, 0]);
  assert.deepEqual(rounded(plainTexture.scale), [2, 3, 1]);
  assert.deepEqual(material.customProperties.map((property) => property.name), [
    "Maya|shader_uniform_uTime",
    "Maya|shader_uniform_uTint",
    "Maya|shader_uniform_uOffset"
  ]);
});

test("adapts plain ShaderMaterial texture uniforms from userData source records", () => {
  const scene = fromThreeObject(shaderScene({ plainTextureUserDataSourceUniform: true }));
  const material = scene.meshes[0].materials[0];
  const sourceTexture = material.textures.find((texture) => texture.sourceUniformName === "uPlainSourceMap");

  assert.ok(sourceTexture);
  assert.equal(sourceTexture.name, "shader_plain_source");
  assert.equal(sourceTexture.property, "Maya|TEX_shader_uniform_uPlainSourceMap");
  assert.equal(sourceTexture.sourceTextureField, "shaderUniform:uPlainSourceMap");
  assert.equal(sourceTexture.relativeFileName, "media/shader-source.mp4");
  assert.equal(sourceTexture.width, 640);
  assert.equal(sourceTexture.height, 360);
  assert.equal(sourceTexture.frameRate, 24);
  assert.equal(sourceTexture.stopFrame, 48);
  assert.deepEqual(material.customProperties.map((property) => property.name), [
    "Maya|shader_uniform_uTime",
    "Maya|shader_uniform_uTint",
    "Maya|shader_uniform_uOffset"
  ]);
});

test("adapts ShaderMaterial texture uniform arrays", () => {
  const scene = fromThreeObject(shaderScene({ textureArrayUniform: true }));
  const material = scene.meshes[0].materials[0];
  const arrayTextures = material.textures.filter((texture) => texture.sourceUniformName?.startsWith("uTextureArray"));

  assert.deepEqual(arrayTextures.map((texture) => [
    texture.sourceUniformName,
    texture.name,
    texture.property,
    texture.sourceTextureField,
    texture.relativeFileName
  ]), [
    ["uTextureArray[0]", "shader_array_a", "Maya|TEX_shader_uniform_uTextureArray_0", "shaderUniform:uTextureArray_0", "shader-array-a.tga"],
    ["uTextureArray[1]", "shader_array_b", "Maya|TEX_shader_uniform_uTextureArray_1", "shaderUniform:uTextureArray_1", "shader-array-b.tga"]
  ]);
  assert.deepEqual(rounded(arrayTextures[1].translation), [0.2, 0.3, 0]);
  assert.deepEqual(rounded(arrayTextures[1].scale), [4, 5, 1]);
  assert.ok(!material.customProperties.some((property) => property.name.includes("uTextureArray")));
});

test("adapts scalar ShaderMaterial uniform arrays as indexed custom properties", () => {
  const scene = fromThreeObject(shaderScene({ scalarArrayUniform: true }));
  const material = scene.meshes[0].materials[0];
  const weightProperties = material.customProperties.filter((property) => property.name.includes("uWeights"));

  assert.deepEqual(weightProperties.map((property) => [property.name, property.kind, Number(property.value.toFixed(4))]), [
    ["Maya|shader_uniform_uWeights_0", "scalar", 0.1],
    ["Maya|shader_uniform_uWeights_1", "scalar", 0.2],
    ["Maya|shader_uniform_uWeights_2", "scalar", 0.3],
    ["Maya|shader_uniform_uWeights_3", "scalar", 0.4]
  ]);
  assert.ok(!material.customProperties.some((property) => property.name === "Maya|shader_uniform_uWeights"));
});

test("adapts vector and color ShaderMaterial uniform arrays as indexed custom properties", () => {
  const scene = fromThreeObject(shaderScene({ vectorColorArrayUniform: true }));
  const material = scene.meshes[0].materials[0];
  const arrayProperties = material.customProperties.filter((property) => /u(?:Color|Vector)Stops/.test(property.name));

  assert.deepEqual(arrayProperties.map((property) => [property.name, property.kind, property.value]), [
    ["Maya|shader_uniform_uColorStops_0", "color", [1, 0, 0]],
    ["Maya|shader_uniform_uColorStops_1", "color", [0, 1, 0]],
    ["Maya|shader_uniform_uVectorStops_0", "vector", [1, 2, 3]],
    ["Maya|shader_uniform_uVectorStops_1", "vector", [4, 5, 6]]
  ]);
  assert.ok(!material.customProperties.some((property) => property.name === "Maya|shader_uniform_uColorStops"));
  assert.ok(!material.customProperties.some((property) => property.name === "Maya|shader_uniform_uVectorStops"));
});

test("routes ShaderMaterial uniform scalar, vector, and texture animation", () => {
  const scene = normalizeFbxScene(fromThreeObject(shaderScene({ meshAnimations: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const tracks = scene.animations[0].tracks;

  assert.deepEqual(tracks.map((track) => [track.target, track.property]), [
    ["ShaderUniformMaterial", "customMaterialScalar:Maya|shader_uniform_uTime"],
    ["ShaderUniformMaterial", "customMaterialVector:Maya|shader_uniform_uOffset"],
    ["shader_diffuse", "textureTranslation"],
    ["shader_diffuse", "textureRotationZ"]
  ]);
  assert.equal(tracks[0].keyframes[1].value, 1);
  assert.deepEqual(tracks[1].keyframes[1].value, [4, 5, 6]);
  assert.deepEqual(rounded(tracks[2].keyframes[1].value), [0.125, 0.25, 0]);
  assert.equal(Number(tracks[3].keyframes[1].value.toFixed(4)), 0.4);
});

test("routes ShaderMaterial uniform texture pivot and custom property animation", () => {
  const scene = normalizeFbxScene(fromThreeObject(shaderScene({ uniformTextureDetailAnimations: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const texture = scene.meshes[0].materials[0].textures[0];
  const tracks = scene.animations[0].tracks;

  assert.deepEqual(texture.customProperties.map((property) => [property.name, property.kind, property.value]), [
    ["Maya|shader_texture_gain", "scalar", 0.5]
  ]);
  assert.deepEqual(tracks.map((track) => [track.target, track.property]), [
    ["shader_diffuse", "textureRotationPivot"],
    ["shader_diffuse", "textureScalingPivot"],
    ["shader_diffuse", "customTextureScalar:Maya|shader_texture_gain"]
  ]);
  assert.deepEqual(rounded(tracks[0].keyframes[1].value), [0.25, 0.75, 0]);
  assert.deepEqual(rounded(tracks[1].keyframes[1].value), [0.25, 0.75, 0]);
  assert.equal(tracks[2].keyframes[1].value, 1);
});

test("routes ShaderMaterial uniform texture userData matrix animation", () => {
  const scene = normalizeFbxScene(fromThreeObject(shaderScene({ uniformTextureMatrixAnimations: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const tracks = scene.animations[0].tracks;

  assert.deepEqual(tracks.map((track) => [track.target, track.property]), [
    ["shader_diffuse", "textureTranslation"],
    ["shader_diffuse", "textureRotation"],
    ["shader_diffuse", "textureScale"]
  ]);
  assert.deepEqual(rounded(tracks[0].keyframes[0].value), [0.125, -0.25, 0]);
  assert.deepEqual(rounded(tracks[1].keyframes[0].value), [0, 0, 0]);
  assert.deepEqual(rounded(tracks[2].keyframes[1].value), [4, 5, 1]);
});

test("routes ShaderMaterial uniform nested texture transform animation", () => {
  const scene = normalizeFbxScene(fromThreeObject(shaderScene({ uniformTextureNestedTransformAnimations: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const tracks = scene.animations[0].tracks;

  assert.deepEqual(tracks.map((track) => [track.target, track.property]), [
    ["shader_diffuse", "textureTranslation"],
    ["shader_diffuse", "textureRotation"],
    ["shader_diffuse", "textureScale"],
    ["shader_diffuse", "textureRotationPivot"],
    ["shader_diffuse", "textureScalingPivot"]
  ]);
  assert.deepEqual(rounded(tracks[0].keyframes[0].value), [0.2, 0.4, 0]);
  assert.deepEqual(rounded(tracks[1].keyframes[1].value), [0, 0, 0.75]);
  assert.deepEqual(rounded(tracks[2].keyframes[1].value), [7, 8, 1]);
  assert.deepEqual(rounded(tracks[3].keyframes[0].value), [0.3, 0.7, 0]);
  assert.deepEqual(rounded(tracks[4].keyframes[1].value), [0.4, 0.8, 0]);
});

test("routes ShaderMaterial uniform nested texture matrix animation", () => {
  const scene = normalizeFbxScene(fromThreeObject(shaderScene({ uniformTextureNestedMatrixAnimations: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const tracks = scene.animations[0].tracks;

  assert.deepEqual(tracks.map((track) => [track.target, track.property]), [
    ["shader_diffuse", "textureTranslation"],
    ["shader_diffuse", "textureRotation"],
    ["shader_diffuse", "textureScale"]
  ]);
  assert.deepEqual(rounded(tracks[0].keyframes[0].value), [0.625, 0.125, 0]);
  assert.deepEqual(rounded(tracks[1].keyframes[0].value), [0, 0, 0]);
  assert.deepEqual(rounded(tracks[2].keyframes[1].value), [9, 10, 1]);
});

test("collects texture-owned ShaderMaterial uniform animation clips", () => {
  const scene = normalizeFbxScene(fromThreeObject(shaderScene({ textureAnimations: true }), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations.map((clip) => clip.name), ["ShaderTextureDrift"]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["shader_diffuse", "textureTranslation"]
  ]);
});

test("collects texture-owned ShaderMaterial texture array animation clips", () => {
  const scene = normalizeFbxScene(fromThreeObject(shaderScene({
    textureArrayAnimations: true,
    textureArrayUniform: true
  }), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const clip = scene.animations.find((animation) => animation.name === "ShaderTextureArrayDrift");

  assert.ok(clip);
  assert.deepEqual(clip.tracks.map((track) => [track.target, track.property]), [
    ["shader_array_a", "textureTranslation"]
  ]);
  assert.deepEqual(rounded(clip.tracks[0].keyframes[1].value), [0.25, 0.5, 0]);
});

test("routes ShaderMaterial texture array uniform clip animation", () => {
  const scene = normalizeFbxScene(fromThreeObject(shaderScene({
    textureArrayClipAnimations: true,
    textureArrayUniform: true
  }), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const tracks = scene.animations.find((clip) => clip.name === "ShaderTextureArrayClip").tracks;

  assert.deepEqual(tracks.map((track) => [track.target, track.property]), [
    ["shader_array_b", "textureTranslation"],
    ["shader_array_a", "textureRotation"],
    ["shader_array_b", "textureScale"]
  ]);
  assert.deepEqual(rounded(tracks[0].keyframes[1].value), [0.4, 0.6, 0]);
  assert.deepEqual(rounded(tracks[1].keyframes[1].value), [0, 0, 0.75]);
  assert.deepEqual(rounded(tracks[2].keyframes[1].value), [6, 7, 1]);
});

test("routes ShaderMaterial scalar uniform array animation", () => {
  const scene = normalizeFbxScene(fromThreeObject(shaderScene({
    scalarArrayAnimations: true,
    scalarArrayUniform: true
  }), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const arrayClip = scene.animations.find((clip) => clip.name === "ShaderUniformArrayWeights");
  const indexClip = scene.animations.find((clip) => clip.name === "ShaderUniformArrayWeightIndex");

  assert.deepEqual(arrayClip.tracks.map((track) => [track.target, track.property]), [
    ["ShaderUniformMaterial", "customMaterialScalar:Maya|shader_uniform_uWeights_0"],
    ["ShaderUniformMaterial", "customMaterialScalar:Maya|shader_uniform_uWeights_1"],
    ["ShaderUniformMaterial", "customMaterialScalar:Maya|shader_uniform_uWeights_2"],
    ["ShaderUniformMaterial", "customMaterialScalar:Maya|shader_uniform_uWeights_3"]
  ]);
  assert.deepEqual(arrayClip.tracks.map((track) => Number(track.keyframes[1].value.toFixed(4))), [0.5, 0.6, 0.7, 0.8]);
  assert.deepEqual(indexClip.tracks.map((track) => [track.target, track.property]), [
    ["ShaderUniformMaterial", "customMaterialScalar:Maya|shader_uniform_uWeights_2"]
  ]);
  assert.equal(Number(indexClip.tracks[0].keyframes[1].value.toFixed(4)), 0.95);
});

test("routes ShaderMaterial vector and color uniform array animation", () => {
  const scene = normalizeFbxScene(fromThreeObject(shaderScene({
    vectorColorArrayAnimations: true,
    vectorColorArrayUniform: true
  }), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const tracks = scene.animations.find((clip) => clip.name === "ShaderUniformVectorColorArrays").tracks;

  assert.deepEqual(tracks.map((track) => [track.target, track.property]), [
    ["ShaderUniformMaterial", "customMaterialColor:Maya|shader_uniform_uColorStops_1"],
    ["ShaderUniformMaterial", "customMaterialVector:Maya|shader_uniform_uVectorStops_0"]
  ]);
  assert.deepEqual(rounded(tracks[0].keyframes[1].value), [0, 0, 1]);
  assert.deepEqual(rounded(tracks[1].keyframes[1].value), [7, 8, 9]);
});

test("routes ShaderMaterial texture array uniform custom and video animation", () => {
  const scene = normalizeFbxScene(fromThreeObject(shaderScene({
    textureArrayDetailAnimations: true,
    textureArrayUniform: true
  }), {
    bakeAnimations: false,
    frameRate: 30
  }));
  const arrayTexture = scene.meshes[0].materials[0].textures.find((texture) => texture.name === "shader_array_b");
  const tracks = scene.animations.find((clip) => clip.name === "ShaderTextureArrayDetails").tracks;

  assert.deepEqual(arrayTexture.customProperties.map((property) => [property.name, property.kind, property.value]), [
    ["Maya|shader_array_gain", "scalar", 0.35]
  ]);
  assert.deepEqual(tracks.map((track) => [track.target, track.property]), [
    ["shader_array_b", "customTextureScalar:Maya|shader_array_gain"],
    ["shader_array_a", "videoCurrentTime"]
  ]);
  assert.equal(Number(tracks[0].keyframes[1].value.toFixed(4)), 0.9);
  assert.equal(tracks[1].keyframes[1].value, Math.round(0.75 * FBX_KTIME));
});

test("writes ShaderMaterial uniform properties and texture lanes into FBX", async () => {
  const bytes = exportFbx(shaderScene({ meshAnimations: true }));
  const text = decode(bytes);

  assert.match(text, /Maya\|shader_uniform_uTime/);
  assert.match(text, /Maya\|shader_uniform_uTint/);
  assert.match(text, /Maya\|shader_uniform_uOffset/);
  assert.match(text, /Maya\|TEX_shader_uniform_uMap/);
  assert.match(text, /AnimationCurveNode/);

  await withMockDocument(async () => {
    const group = new FBXLoader().parse(arrayBufferFrom(exportFbx(shaderScene())), "");
    const mesh = group.getObjectByName("ShaderQuad");

    assert.ok(mesh?.isMesh);
    assert.equal(mesh.material.name, "ShaderUniformMaterial");
  });
});
