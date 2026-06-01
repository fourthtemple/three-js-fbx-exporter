import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AnimationClip,
  BufferGeometry,
  ClampToEdgeWrapping,
  CubeReflectionMapping,
  EquirectangularReflectionMapping,
  FloatType,
  Float32BufferAttribute,
  GreaterEqualCompare,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  LessCompare,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  NearestMipmapNearestFilter,
  NumberKeyframeTrack,
  RepeatWrapping,
  RGBFormat,
  RGBAFormat,
  Scene,
  Texture
} from "three";
import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { checkerTga, decode } from "./fbx-test-helpers.js";

function checkerDataUrl() {
  return `data:image/x-tga;base64,${Buffer.from(checkerTga()).toString("base64")}`;
}

function quadGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0,
    -1, 1, 0
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

function textureScene() {
  return {
    name: "AnimatedTextureMetadataScene",
    meshes: [
      {
        name: "Quad",
        materials: [
          {
            name: "SamplerMaterial",
            diffuseTexture: {
              name: "sampler_checker",
              src: checkerDataUrl(),
              wrapS: RepeatWrapping,
              wrapT: ClampToEdgeWrapping,
              wrapR: RepeatWrapping,
              mappingType: "spherical",
              textureTypeUse: "environment",
              blendMode: "add",
              alphaSource: "none",
              useMipMap: true,
              uvSwap: false,
              premultiplyAlpha: false,
              colorSpace: "none",
              encoding: "LinearEncoding",
              flipY: false,
              unpackAlignment: 4,
              minFilter: "LinearMipmapLinearFilter",
              magFilter: "LinearFilter",
              anisotropy: 1,
              format: "RGBAFormat",
              type: "UnsignedByteType",
              internalFormat: "RGBA8",
              isDepthTexture: false,
              compareFunction: "LessCompare",
              textureDimension: "2d",
              textureDepth: 1,
              textureLayers: 1,
              isDataTexture: false,
              isCompressedTexture: false,
              isTextureArray: false,
              mipmapCount: 0,
              matrixAutoUpdate: true
            }
          }
        ],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0]
        }
      }
    ],
    animations: [
      {
        name: "SamplerMetadata",
        frameRate: 30,
        tracks: [
          {
            target: "sampler_checker",
            property: "wrapU",
            keyframes: [
              { frame: 0, value: "repeat" },
              { frame: 30, value: "clamp" }
            ]
          },
          {
            target: "sampler_checker",
            property: "WrapModeV",
            keyframes: [
              { frame: 0, value: "clamp" },
              { frame: 30, value: "repeat" }
            ]
          },
          {
            target: "sampler_checker",
            property: "wrapR",
            keyframes: [
              { frame: 0, value: "repeat" },
              { frame: 30, value: "clamp" }
            ]
          },
          {
            target: "sampler_checker",
            property: "mappingType",
            keyframes: [
              { frame: 0, value: "spherical" },
              { frame: 30, value: "box" }
            ]
          },
          {
            target: "sampler_checker",
            property: "blendMode",
            keyframes: [
              { frame: 0, value: "add" },
              { frame: 30, value: "multiply" }
            ]
          },
          {
            target: "sampler_checker",
            property: "textureTypeUse",
            keyframes: [
              { frame: 0, value: "environment" },
              { frame: 30, value: "shadow" }
            ]
          },
          {
            target: "sampler_checker",
            property: "alphaSource",
            keyframes: [
              { frame: 0, value: "none" },
              { frame: 30, value: "alpha channel" }
            ]
          },
          {
            target: "sampler_checker",
            property: "useMipMap",
            keyframes: [
              { frame: 0, value: true },
              { frame: 30, value: false }
            ]
          },
          {
            target: "sampler_checker",
            property: "uvSwap",
            keyframes: [
              { frame: 0, value: false },
              { frame: 30, value: true }
            ]
          },
          {
            target: "sampler_checker",
            property: "premultiplyAlpha",
            keyframes: [
              { frame: 0, value: false },
              { frame: 30, value: true }
            ]
          },
          {
            target: "sampler_checker",
            property: "colorSpace",
            keyframes: [
              { frame: 0, value: "none" },
              { frame: 30, value: "srgb" }
            ]
          },
          {
            target: "sampler_checker",
            property: "encoding",
            keyframes: [
              { frame: 0, value: "LinearEncoding" },
              { frame: 30, value: "sRGBEncoding" }
            ]
          },
          {
            target: "sampler_checker",
            property: "flipY",
            keyframes: [
              { frame: 0, value: false },
              { frame: 30, value: true }
            ]
          },
          {
            target: "sampler_checker",
            property: "unpackAlignment",
            keyframes: [
              { frame: 0, value: 4 },
              { frame: 30, value: 1 }
            ]
          },
          {
            target: "sampler_checker",
            property: "minFilter",
            keyframes: [
              { frame: 0, value: "LinearMipmapLinearFilter" },
              { frame: 30, value: "NearestMipmapNearestFilter" }
            ]
          },
          {
            target: "sampler_checker",
            property: "magFilter",
            keyframes: [
              { frame: 0, value: "LinearFilter" },
              { frame: 30, value: "NearestFilter" }
            ]
          },
          {
            target: "sampler_checker",
            property: "textureAnisotropy",
            keyframes: [
              { frame: 0, value: 1 },
              { frame: 30, value: 8 }
            ]
          },
          {
            target: "sampler_checker",
            property: "format",
            keyframes: [
              { frame: 0, value: "RGBAFormat" },
              { frame: 30, value: "RGBFormat" }
            ]
          },
          {
            target: "sampler_checker",
            property: "type",
            keyframes: [
              { frame: 0, value: "UnsignedByteType" },
              { frame: 30, value: "FloatType" }
            ]
          },
          {
            target: "sampler_checker",
            property: "internalFormat",
            keyframes: [
              { frame: 0, value: "RGBA8" },
              { frame: 30, value: "RGBA16F" }
            ]
          },
          {
            target: "sampler_checker",
            property: "isDepthTexture",
            keyframes: [
              { frame: 0, value: false },
              { frame: 30, value: true }
            ]
          },
          {
            target: "sampler_checker",
            property: "compareFunction",
            keyframes: [
              { frame: 0, value: "LessCompare" },
              { frame: 30, value: "GreaterEqualCompare" }
            ]
          },
          {
            target: "sampler_checker",
            property: "textureDimension",
            keyframes: [
              { frame: 0, value: "2d" },
              { frame: 30, value: "3d" }
            ]
          },
          {
            target: "sampler_checker",
            property: "textureDepth",
            keyframes: [
              { frame: 0, value: 1 },
              { frame: 30, value: 4 }
            ]
          },
          {
            target: "sampler_checker",
            property: "textureLayers",
            keyframes: [
              { frame: 0, value: 1 },
              { frame: 30, value: 6 }
            ]
          },
          {
            target: "sampler_checker",
            property: "isDataTexture",
            keyframes: [
              { frame: 0, value: false },
              { frame: 30, value: true }
            ]
          },
          {
            target: "sampler_checker",
            property: "isCompressedTexture",
            keyframes: [
              { frame: 0, value: false },
              { frame: 30, value: true }
            ]
          },
          {
            target: "sampler_checker",
            property: "isTextureArray",
            keyframes: [
              { frame: 0, value: false },
              { frame: 30, value: true }
            ]
          },
          {
            target: "sampler_checker",
            property: "mipmapCount",
            keyframes: [
              { frame: 0, value: 0 },
              { frame: 30, value: 3 }
            ]
          },
          {
            target: "sampler_checker",
            property: "matrixAutoUpdate",
            keyframes: [
              { frame: 0, value: true },
              { frame: 30, value: false }
            ]
          }
        ]
      }
    ]
  };
}

function threeTextureScene() {
  const texture = new Texture({ src: checkerDataUrl(), name: "checker_image" });
  texture.name = "sampler_checker";
  texture.image.depth = 1;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.wrapR = RepeatWrapping;
  texture.mapping = CubeReflectionMapping;
  texture.userData.textureTypeUse = 3;
  texture.userData.blendMode = 1;
  texture.userData.alphaSource = 0;
  texture.userData.uvSwap = false;
  texture.userData.colorSpace = 0;
  texture.userData.encoding = 3000;
  texture.premultiplyAlpha = false;
  texture.flipY = true;
  texture.unpackAlignment = 4;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 1;
  texture.format = RGBAFormat;
  texture.type = HalfFloatType;
  texture.internalFormat = "RGBA16F";
  texture.userData.isDepthTexture = false;
  texture.userData.compareFunction = LessCompare;
  texture.userData.textureDimensionId = 0;
  texture.userData.layers = 1;
  texture.userData.isDataTexture = false;
  texture.userData.isCompressedTexture = false;
  texture.userData.isTextureArray = false;
  texture.userData.mipmapCount = 0;
  texture.matrixAutoUpdate = true;
  texture.generateMipmaps = true;

  const material = new MeshBasicMaterial({ name: "SamplerMaterial", map: texture });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "Quad";

  const scene = new Scene();
  scene.name = "ThreeAnimatedTextureMetadataScene";
  scene.add(mesh);
  scene.animations = [
    new AnimationClip("SamplerMetadata", 1, [
      new NumberKeyframeTrack("Quad.material.map.wrapS", [0, 1], [RepeatWrapping, ClampToEdgeWrapping]),
      new NumberKeyframeTrack("Quad.material.map.wrapT", [0, 1], [ClampToEdgeWrapping, RepeatWrapping]),
      new NumberKeyframeTrack("Quad.material.map.wrapR", [0, 1], [RepeatWrapping, ClampToEdgeWrapping]),
      new NumberKeyframeTrack("Quad.material.map.mapping", [0, 1], [CubeReflectionMapping, EquirectangularReflectionMapping]),
      new NumberKeyframeTrack("Quad.material.map.userData.blendMode", [0, 1], [1, 2]),
      new NumberKeyframeTrack("Quad.material.map.userData.textureTypeUse", [0, 1], [3, 1]),
      new NumberKeyframeTrack("Quad.material.map.userData.alphaSource", [0, 1], [0, 2]),
      new NumberKeyframeTrack("Quad.material.map.generateMipmaps", [0, 1], [1, 0]),
      new NumberKeyframeTrack("Quad.material.map.userData.uvSwap", [0, 1], [0, 1]),
      new NumberKeyframeTrack("Quad.material.map.premultiplyAlpha", [0, 1], [0, 1]),
      new NumberKeyframeTrack("Quad.material.map.userData.colorSpace", [0, 1], [0, 2]),
      new NumberKeyframeTrack("Quad.material.map.userData.encoding", [0, 1], [3000, 3001]),
      new NumberKeyframeTrack("Quad.material.map.flipY", [0, 1], [1, 0]),
      new NumberKeyframeTrack("Quad.material.map.unpackAlignment", [0, 1], [4, 1]),
      new NumberKeyframeTrack("Quad.material.map.minFilter", [0, 1], [LinearMipmapLinearFilter, NearestMipmapNearestFilter]),
      new NumberKeyframeTrack("Quad.material.map.magFilter", [0, 1], [LinearFilter, NearestFilter]),
      new NumberKeyframeTrack("Quad.material.map.anisotropy", [0, 1], [1, 8]),
      new NumberKeyframeTrack("Quad.material.map.format", [0, 1], [RGBAFormat, RGBFormat]),
      new NumberKeyframeTrack("Quad.material.map.type", [0, 1], [HalfFloatType, FloatType]),
      new NumberKeyframeTrack("Quad.material.map.userData.internalFormatId", [0, 1], [34842, 35907]),
      new NumberKeyframeTrack("Quad.material.map.userData.isDepthTexture", [0, 1], [0, 1]),
      new NumberKeyframeTrack("Quad.material.map.userData.compareFunction", [0, 1], [LessCompare, GreaterEqualCompare]),
      new NumberKeyframeTrack("Quad.material.map.userData.textureDimensionId", [0, 1], [0, 2]),
      new NumberKeyframeTrack("Quad.material.map.image.depth", [0, 1], [1, 4]),
      new NumberKeyframeTrack("Quad.material.map.userData.layers", [0, 1], [1, 6]),
      new NumberKeyframeTrack("Quad.material.map.userData.isDataTexture", [0, 1], [0, 1]),
      new NumberKeyframeTrack("Quad.material.map.userData.isCompressedTexture", [0, 1], [0, 1]),
      new NumberKeyframeTrack("Quad.material.map.userData.isTextureArray", [0, 1], [0, 1]),
      new NumberKeyframeTrack("Quad.material.map.userData.mipmapCount", [0, 1], [0, 3]),
      new NumberKeyframeTrack("Quad.material.map.matrixAutoUpdate", [0, 1], [1, 0])
    ])
  ];
  return scene;
}

test("normalizes texture metadata animation targets", () => {
  const scene = normalizeFbxScene(textureScene());

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureWrapU",
    "textureWrapV",
    "textureWrapW",
    "textureMappingType",
    "textureBlendMode",
    "textureTypeUse",
    "textureAlphaSource",
    "textureUseMipMap",
    "textureUvSwap",
    "texturePremultiplyAlpha",
    "textureColorSpace",
    "textureEncoding",
    "textureFlipY",
    "textureUnpackAlignment",
    "textureMinFilter",
    "textureMagFilter",
    "textureAnisotropy",
    "textureFormat",
    "textureType",
    "textureInternalFormatId",
    "textureIsDepthTexture",
    "textureCompareFunction",
    "textureDimensionId",
    "textureDepth",
    "textureLayers",
    "textureIsDataTexture",
    "textureIsCompressedTexture",
    "textureIsTextureArray",
    "textureMipmapCount",
    "textureMatrixAutoUpdate"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => {
    return track.keyframes.map((keyframe) => keyframe.value);
  }), [
    [0, 1],
    [1, 0],
    [0, 1],
    [2, 4],
    [1, 2],
    [3, 1],
    [0, 2],
    [1, 0],
    [0, 1],
    [0, 1],
    [0, 2],
    [3000, 3001],
    [0, 1],
    [4, 1],
    [1008, 1004],
    [1006, 1003],
    [1, 8],
    [1023, 1022],
    [1009, 1015],
    [32856, 34842],
    [0, 1],
    [LessCompare, GreaterEqualCompare],
    [0, 2],
    [1, 4],
    [1, 6],
    [0, 1],
    [0, 1],
    [0, 1],
    [0, 3],
    [1, 0]
  ]);
});

test("writes texture metadata animation curves", () => {
  const text = decode(exportFbx(textureScene()));

  assert.match(text, /sampler_checker/);
  assert.match(text, /WrapModeU/);
  assert.match(text, /WrapModeV/);
  assert.match(text, /Maya\|wrap_mode_w/);
  assert.match(text, /CurrentMappingType/);
  assert.match(text, /CurrentTextureBlendMode/);
  assert.match(text, /TextureTypeUse/);
  assert.match(text, /AlphaSource/);
  assert.match(text, /UseMipMap/);
  assert.match(text, /UVSwap/);
  assert.match(text, /PremultiplyAlpha/);
  assert.match(text, /Maya\|color_space_id/);
  assert.match(text, /Maya\|encoding/);
  assert.match(text, /Maya\|flip_y/);
  assert.match(text, /Maya\|unpack_alignment/);
  assert.match(text, /Maya\|min_filter/);
  assert.match(text, /Maya\|mag_filter/);
  assert.match(text, /Maya\|anisotropy/);
  assert.match(text, /Maya\|format/);
  assert.match(text, /Maya\|type/);
  assert.match(text, /Maya\|internal_format_id/);
  assert.match(text, /Maya\|is_depth_texture/);
  assert.match(text, /Maya\|compare_function/);
  assert.match(text, /Maya\|texture_dimension_id/);
  assert.match(text, /Maya\|texture_depth/);
  assert.match(text, /Maya\|texture_layers/);
  assert.match(text, /Maya\|is_data_texture/);
  assert.match(text, /Maya\|is_compressed_texture/);
  assert.match(text, /Maya\|is_texture_array/);
  assert.match(text, /Maya\|mipmap_count/);
  assert.match(text, /Maya\|matrix_auto_update/);
  assert.match(text, /AnimationCurveNode/);
  assert.match(text, /AnimationCurve/);
});

test("adapts Three.js texture metadata tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeTextureScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "textureWrapU",
    "textureWrapV",
    "textureWrapW",
    "textureMappingType",
    "textureBlendMode",
    "textureTypeUse",
    "textureAlphaSource",
    "textureUseMipMap",
    "textureUvSwap",
    "texturePremultiplyAlpha",
    "textureColorSpace",
    "textureEncoding",
    "textureFlipY",
    "textureUnpackAlignment",
    "textureMinFilter",
    "textureMagFilter",
    "textureAnisotropy",
    "textureFormat",
    "textureType",
    "textureInternalFormatId",
    "textureIsDepthTexture",
    "textureCompareFunction",
    "textureDimensionId",
    "textureDepth",
    "textureLayers",
    "textureIsDataTexture",
    "textureIsCompressedTexture",
    "textureIsTextureArray",
    "textureMipmapCount",
    "textureMatrixAutoUpdate"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), [
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker",
    "sampler_checker"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.keyframes[1].value), [
    1,
    0,
    1,
    2,
    2,
    1,
    2,
    0,
    1,
    1,
    2,
    3001,
    0,
    1,
    NearestMipmapNearestFilter,
    NearestFilter,
    8,
    RGBFormat,
    FloatType,
    35907,
    1,
    GreaterEqualCompare,
    2,
    4,
    6,
    1,
    1,
    1,
    3,
    0
  ]);
});
