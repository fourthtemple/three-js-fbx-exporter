import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BufferGeometry,
  CompressedArrayTexture,
  Data3DTexture,
  DepthFormat,
  DepthArrayTexture,
  DepthTexture,
  FloatType,
  Float32BufferAttribute,
  LinearMipmapLinearFilter,
  LessEqualCompare,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  RepeatWrapping,
  RGBFormat,
  RGBAFormat,
  Scene,
  UnsignedByteType,
  SRGBColorSpace,
  Texture,
  UnsignedIntType,
  VideoTexture
} from "three";
import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { FBX_KTIME } from "../src/core/fbx-values.js";
import { normalizeTextureAlphaSource } from "../src/texture/texture-alpha.js";
import { textureDimensionsFromPayload } from "../src/texture/texture-content.js";
import { normalizeTextureCropping } from "../src/texture/texture-cropping.js";
import {
  normalizeTextureColorSpace,
  normalizeTextureCompareFunction,
  normalizeTextureDimensionKind,
  normalizeTextureEncoding,
  normalizeTextureFilter,
  normalizeTextureAnisotropy,
  normalizeTextureFormat,
  normalizeTextureInternalFormatId,
  normalizeTextureType,
  textureDimensionKindLabel
} from "../src/texture/texture-metadata-normalizer.js";
import { normalizeTextureVideo } from "../src/texture/texture-video.js";
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

function textureMetadataScene() {
  return {
    name: "TextureMetadataScene",
    meshes: [
      {
        name: "Quad",
        materials: [
          {
            name: "SamplerMaterial",
            diffuseTexture: {
              name: "sampler_checker",
              src: checkerDataUrl(),
              wrapR: "repeat",
              textureTypeUse: 7,
              useMipMap: true,
              colorSpace: "srgb",
              encoding: "sRGBEncoding",
              flipY: true,
              unpackAlignment: 1,
              minFilter: "LinearMipmapLinearFilter",
              magFilter: "NearestFilter",
              anisotropy: 8,
              format: "RGBFormat",
              type: "FloatType",
              internalFormat: "RGBA16F",
              isDepthTexture: true,
              compareFunction: "LessEqualCompare",
              matrixAutoUpdate: false,
              alphaSource: "alpha",
              premultiplyAlpha: true,
              imageSequence: {
                startFrame: 2,
                stopFrame: 18,
                imageSequenceOffset: 4,
                frameRate: 24,
                lastFrame: 20
              },
              videoOffset: 120,
              playSpeed: 1,
              loop: true,
              cropping: { left: 1.2, top: 2, right: 3.8, bottom: 4 }
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
    ]
  };
}

function textureUserDataMetadataScene() {
  const scene = textureMetadataScene();
  const texture = scene.meshes[0].materials[0].diffuseTexture;
  for (const key of [
    "wrapR",
    "textureTypeUse",
    "useMipMap",
    "colorSpace",
    "encoding",
    "flipY",
    "unpackAlignment",
    "minFilter",
    "magFilter",
    "anisotropy",
    "format",
    "type",
    "internalFormat",
    "isDepthTexture",
    "compareFunction",
    "cropping",
    "alphaSource",
    "premultiplyAlpha"
  ]) {
    delete texture[key];
  }
  texture.userData = {
    wrapS: "repeat",
    wrapR: "repeat",
    uvSet: "LightmapUV",
    mappingType: "spherical",
    uvSwap: true,
    textureTypeUse: "reflection",
    useMipMap: true,
    colorSpace: "srgb",
    encoding: "sRGBEncoding",
    flipY: true,
    unpackAlignment: 1,
    minFilter: "LinearMipmapLinearFilter",
    magFilter: "NearestFilter",
    anisotropy: 8,
    format: "RGBFormat",
    type: "FloatType",
    internalFormat: "RGBA16F",
    isDepthTexture: true,
    compareFunction: "LessEqualCompare",
    textureDimension: "2DArrayTexture",
    textureDepth: 6,
    textureLayers: 6,
    isDataTexture: true,
    isCompressedTexture: true,
    isTextureArray: true,
    mipmapCount: 2,
    video: {
      videoWidth: 128,
      videoHeight: 72
    },
    crop: [5.2, 6, 7.8, 8],
    blendMode: "multiply",
    textureAlpha: 0.4,
    alphaSource: "alpha",
    premultiplyAlpha: true
  };
  return scene;
}

function textureDirectSourceMetadataScene() {
  return {
    name: "TextureDirectSourceMetadataScene",
    meshes: [
      {
        name: "SourceQuad",
        materials: [
          {
            name: "SourceMaterial",
            diffuseTexture: {
              name: "source_direct_texture",
              source: {
                currentSrc: "media/source-direct.mp4",
                relativeFileName: "relative/source-direct.mp4",
                textureDimension: "2DArrayTexture",
                wrapR: "repeat",
                uvSet: "UVMap_2",
                mappingType: "spherical",
                textureTypeUse: "shadow",
                useMipMap: true,
                colorSpace: "srgb",
                encoding: "sRGBEncoding",
                flipY: true,
                unpackAlignment: 1,
                minFilter: "nearest",
                magFilter: "linear",
                anisotropy: 4,
                format: "RGBFormat",
                type: "FloatType",
                internalFormat: "RGBA16F",
                isDepthTexture: true,
                compareFunction: "LessEqualCompare",
                isDataTexture: true,
                isCompressedTexture: true,
                isTextureArray: true,
                mipmapCount: 3,
                matrixAutoUpdate: false,
                blendMode: "multiply",
                textureAlpha: 0.65,
                alphaSource: "alpha",
                premultiplyAlpha: true,
                videoWidth: 800,
                videoHeight: 450,
                duration: 2,
                fps: 20,
                frameCount: 40,
                playbackRate: 0.75,
                loop: true,
                crop: [9.2, 10, 11.8, 12],
                depth: 5,
                layers: 5
              }
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
    ]
  };
}

function threeTextureMetadataScene() {
  const texture = new Texture({ src: checkerDataUrl(), name: "checker_image" });
  texture.name = "sampler_checker";
  texture.image.width = 8;
  texture.image.height = 4;
  texture.userData.textureTypeUse = 7;
  texture.userData.videoAccessMode = "disk";
  texture.userData.crop = [1, 2, 3, 4];
  texture.wrapR = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.userData.encoding = "sRGBEncoding";
  texture.flipY = false;
  texture.unpackAlignment = 1;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = NearestFilter;
  texture.anisotropy = 8;
  texture.format = RGBFormat;
  texture.type = FloatType;
  texture.internalFormat = "RGBA16F";
  texture.matrixAutoUpdate = false;
  texture.userData.alphaSource = "rgbIntensity";
  texture.userData.premultiplyAlpha = true;
  texture.userData.sequence = {
    startFrame: 3,
    stopFrame: 12,
    frameRate: 12,
    lastFrame: 12
  };
  texture.userData.videoLoop = true;
  texture.generateMipmaps = true;

  const material = new MeshBasicMaterial({ name: "SamplerMaterial", map: texture });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "Quad";

  const scene = new Scene();
  scene.name = "ThreeTextureMetadataScene";
  scene.add(mesh);
  return scene;
}

function threeDepthTextureMetadataScene() {
  const texture = new DepthTexture(8, 4);
  texture.name = "depth_shadow";
  texture.image = { src: checkerDataUrl(), width: 8, height: 4, name: "depth_image" };
  texture.format = DepthFormat;
  texture.type = UnsignedIntType;
  texture.compareFunction = LessEqualCompare;
  texture.generateMipmaps = false;

  const material = new MeshBasicMaterial({ name: "DepthMaterial", map: texture });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "DepthQuad";

  const scene = new Scene();
  scene.name = "ThreeDepthTextureMetadataScene";
  scene.add(mesh);
  return scene;
}

function threeDimensionalTextureMetadataScene() {
  const volumeTexture = new Data3DTexture(null, 4, 2, 3);
  volumeTexture.name = "volume_lut";
  volumeTexture.wrapR = RepeatWrapping;

  const depthArrayTexture = new DepthArrayTexture(8, 4, 6);
  depthArrayTexture.name = "shadow_array";
  depthArrayTexture.compareFunction = LessEqualCompare;

  const compressedArrayTexture = new CompressedArrayTexture([
    { data: new Uint8Array([1, 2, 3, 4]), width: 4, height: 4, depth: 2 }
  ], 4, 4, 2, RGBAFormat, UnsignedByteType);
  compressedArrayTexture.name = "compressed_array";

  const scene = new Scene();
  scene.name = "ThreeDimensionalTextureMetadataScene";
  for (const [name, texture] of [
    ["VolumeQuad", volumeTexture],
    ["DepthArrayQuad", depthArrayTexture],
    ["CompressedArrayQuad", compressedArrayTexture]
  ]) {
    const material = new MeshBasicMaterial({ name: `${name}Material`, map: texture });
    const mesh = new Mesh(quadGeometry(), material);
    mesh.name = name;
    scene.add(mesh);
  }
  return scene;
}

function threeVideoTextureMetadataScene() {
  const video = {
    currentSrc: "media/walk-cycle.mp4",
    videoWidth: 1920,
    videoHeight: 1080,
    duration: 2,
    frameRate: 24,
    playbackRate: 1.25,
    loop: true,
    name: "walk_cycle_video"
  };
  const texture = new VideoTexture(video);
  texture.name = "walk_cycle_texture";

  const material = new MeshBasicMaterial({ name: "VideoMaterial", map: texture });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "VideoQuad";

  const scene = new Scene();
  scene.name = "ThreeVideoTextureMetadataScene";
  scene.add(mesh);
  return scene;
}

function threeUserDataVideoTextureMetadataScene() {
  const texture = new Texture();
  texture.userData.video = {
    currentSrc: "media/userdata-walk.webm",
    videoWidth: 640,
    videoHeight: 360,
    duration: 1.5,
    fps: 30,
    playbackRate: 0.75,
    loop: true
  };

  const material = new MeshBasicMaterial({ name: "VideoMaterial", map: texture });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "VideoQuad";

  const scene = new Scene();
  scene.name = "ThreeUserDataVideoTextureMetadataScene";
  scene.add(mesh);
  return scene;
}

function threeUserDataMediaElementTextureMetadataScene() {
  const texture = new Texture();
  texture.userData.mediaElement = {
    name: "media_element_walk",
    currentSrc: "media/userdata-media-element.mov",
    videoWidth: 800,
    videoHeight: 450,
    duration: 2.5,
    fps: 24,
    currentTime: 0.25,
    playbackRate: 1.5,
    loop: true
  };

  const material = new MeshBasicMaterial({ name: "MediaElementMaterial", map: texture });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "MediaElementQuad";

  const scene = new Scene();
  scene.name = "ThreeUserDataMediaElementTextureMetadataScene";
  scene.add(mesh);
  return scene;
}

function threeUserDataImageSourceMetadataScene() {
  const texture = new Texture();
  texture.userData.image = {
    currentSrc: "frames/userdata-image-0001.tga",
    videoWidth: 256,
    duration: 1.25,
    frameIndex: 3,
    loop: true
  };
  texture.userData.source = {
    data: {
      videoHeight: 144,
      fps: 12,
      playbackRate: 0.5,
      frameCount: 15
    }
  };

  const material = new MeshBasicMaterial({ name: "ImageSourceMaterial", map: texture });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "ImageSourceQuad";

  const scene = new Scene();
  scene.name = "ThreeUserDataImageSourceMetadataScene";
  scene.add(mesh);
  return scene;
}

function threeDirectSourceMetadataScene() {
  const texture = new Texture();
  texture.name = "direct_source_texture";
  texture.source.currentSrc = "media/direct-source.mov";
  texture.source.relativePath = "relative/direct-source.mov";
  texture.source.textureDimension = "2DArrayTexture";
  texture.source.wrapR = RepeatWrapping;
  texture.source.uvSet = "UVMap_2";
  texture.source.mappingType = "spherical";
  texture.source.textureTypeUse = "shadow";
  texture.source.useMipMap = true;
  texture.source.colorSpace = SRGBColorSpace;
  texture.source.encoding = "sRGBEncoding";
  texture.source.flipY = true;
  texture.source.unpackAlignment = 1;
  texture.source.minFilter = NearestFilter;
  texture.source.magFilter = LinearMipmapLinearFilter;
  texture.source.anisotropy = 4;
  texture.source.format = RGBFormat;
  texture.source.type = FloatType;
  texture.source.internalFormat = "RGBA16F";
  texture.source.isDepthTexture = true;
  texture.source.compareFunction = LessEqualCompare;
  texture.source.isDataTexture = true;
  texture.source.isCompressedTexture = true;
  texture.source.isTextureArray = true;
  texture.source.mipmapCount = 3;
  texture.source.matrixAutoUpdate = false;
  texture.source.blendMode = "multiply";
  texture.source.textureAlpha = 0.65;
  texture.source.alphaSource = "alpha";
  texture.source.premultiplyAlpha = true;
  texture.source.videoWidth = 1024;
  texture.source.videoHeight = 576;
  texture.source.duration = 3;
  texture.source.fps = 30;
  texture.source.frameCount = 90;
  texture.source.playbackRate = 1.2;
  texture.source.loop = true;
  texture.source.cropping = { left: 9.4, top: 10, right: 11.6, bottom: 12 };
  texture.source.depth = 7;
  texture.source.layers = 7;

  const material = new MeshBasicMaterial({ name: "DirectSourceMaterial", map: texture });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "DirectSourceQuad";

  const scene = new Scene();
  scene.name = "ThreeDirectSourceMetadataScene";
  scene.add(mesh);
  return scene;
}

function threeFrameCountVideoTextureMetadataScene() {
  const texture = new Texture();
  texture.name = "frame_count_texture";
  texture.userData.video = {
    currentSrc: "media/frame-count.mov",
    videoWidth: 320,
    videoHeight: 180,
    frameRate: 24,
    frameCount: 96,
    playbackRate: 1.5
  };

  const material = new MeshBasicMaterial({ name: "VideoMaterial", map: texture });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "VideoQuad";

  const scene = new Scene();
  scene.name = "ThreeFrameCountVideoTextureMetadataScene";
  scene.add(mesh);
  return scene;
}

test("normalizes and writes texture usage metadata", () => {
  const scene = normalizeFbxScene(textureMetadataScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.wrapW, "repeat");
  assert.equal(texture.textureTypeUse, 7);
  assert.equal(texture.useMipMap, true);
  assert.equal(texture.colorSpace, "srgb");
  assert.equal(texture.colorSpaceId, 2);
  assert.equal(texture.encoding, 3001);
  assert.equal(texture.flipY, true);
  assert.equal(texture.unpackAlignment, 1);
  assert.equal(texture.minFilter, 1008);
  assert.equal(texture.magFilter, 1003);
  assert.equal(texture.anisotropy, 8);
  assert.equal(texture.format, 1022);
  assert.equal(texture.type, 1015);
  assert.equal(texture.internalFormat, "RGBA16F");
  assert.equal(texture.internalFormatId, 34842);
  assert.equal(texture.isDepthTexture, true);
  assert.equal(texture.compareFunction, LessEqualCompare);
  assert.equal(texture.matrixAutoUpdate, false);
  assert.equal(texture.width, 2);
  assert.equal(texture.height, 2);
  assert.equal(texture.accessMode, 1);
  assert.equal(texture.alphaSource, 2);
  assert.equal(texture.premultiplyAlpha, true);
  assert.equal(texture.imageSequence, true);
  assert.equal(texture.startFrame, 2);
  assert.equal(texture.stopFrame, 18);
  assert.equal(texture.imageSequenceOffset, 4);
  assert.equal(texture.frameRate, 24);
  assert.equal(texture.lastFrame, 20);
  assert.equal(texture.videoOffset, 120);
  assert.equal(texture.playSpeed, 1);
  assert.equal(texture.loop, true);
  assert.deepEqual(texture.cropping, { left: 1, top: 2, right: 4, bottom: 4 });

  const text = decode(exportFbx(scene));
  assert.match(text, /TextureTypeUse/);
  assert.match(text, /AlphaSource/);
  assert.match(text, /PremultiplyAlpha/);
  assert.match(text, /Maya\|color_space/);
  assert.match(text, /srgb/);
  assert.match(text, /Maya\|color_space_id/);
  assert.match(text, /Maya\|encoding/);
  assert.match(text, /Maya\|flip_y/);
  assert.match(text, /Maya\|unpack_alignment/);
  assert.match(text, /Maya\|min_filter/);
  assert.match(text, /Maya\|mag_filter/);
  assert.match(text, /Maya\|anisotropy/);
  assert.match(text, /Maya\|format/);
  assert.match(text, /Maya\|type/);
  assert.match(text, /Maya\|internal_format/);
  assert.match(text, /RGBA16F/);
  assert.match(text, /Maya\|internal_format_id/);
  assert.match(text, /Maya\|is_depth_texture/);
  assert.match(text, /Maya\|compare_function/);
  assert.match(text, /Maya\|matrix_auto_update/);
  assert.match(text, /Maya\|wrap_mode_w/);
  assert.match(text, /UseMipMap/);
  assert.match(text, /Width/);
  assert.match(text, /Height/);
  assert.match(text, /AccessMode/);
  assert.match(text, /ImageSequence/);
  assert.match(text, /ImageSequenceOffset/);
  assert.match(text, /FrameRate/);
  assert.match(text, /LastFrame/);
  assert.match(text, /StartFrame/);
  assert.match(text, /StopFrame/);
  assert.match(text, /PlaySpeed/);
  assert.match(text, /Loop/);
  assert.match(text, /CroppingLeft/);
  assert.match(text, /CroppingTop/);
  assert.match(text, /CroppingRight/);
  assert.match(text, /CroppingBottom/);
});

test("normalizes internal userData texture sampler metadata", () => {
  const scene = normalizeFbxScene(textureUserDataMetadataScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.wrapU, "repeat");
  assert.equal(texture.wrapW, "repeat");
  assert.equal(texture.uvSet, "LightmapUV");
  assert.equal(texture.mappingType, 2);
  assert.equal(texture.uvSwap, true);
  assert.equal(texture.textureTypeUse, 3);
  assert.equal(texture.useMipMap, true);
  assert.equal(texture.colorSpace, "srgb");
  assert.equal(texture.colorSpaceId, 2);
  assert.equal(texture.encoding, 3001);
  assert.equal(texture.flipY, true);
  assert.equal(texture.unpackAlignment, 1);
  assert.equal(texture.minFilter, 1008);
  assert.equal(texture.magFilter, 1003);
  assert.equal(texture.anisotropy, 8);
  assert.equal(texture.format, 1022);
  assert.equal(texture.type, 1015);
  assert.equal(texture.internalFormat, "RGBA16F");
  assert.equal(texture.internalFormatId, 34842);
  assert.equal(texture.isDepthTexture, true);
  assert.equal(texture.compareFunction, LessEqualCompare);
  assert.equal(texture.textureDimensionId, 3);
  assert.equal(texture.textureDepth, 6);
  assert.equal(texture.textureLayers, 6);
  assert.equal(texture.isDataTexture, true);
  assert.equal(texture.isCompressedTexture, true);
  assert.equal(texture.isTextureArray, true);
  assert.equal(texture.mipmapCount, 2);
  assert.equal(texture.width, 128);
  assert.equal(texture.height, 72);
  assert.deepEqual(texture.cropping, { left: 5, top: 6, right: 8, bottom: 8 });
  assert.equal(texture.blendMode, 2);
  assert.equal(texture.alpha, 0.4);
  assert.equal(texture.alphaSource, 2);
  assert.equal(texture.premultiplyAlpha, true);
});

test("normalizes internal direct source media metadata", () => {
  const scene = normalizeFbxScene(textureDirectSourceMetadataScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.fileName, "media/source-direct.mp4");
  assert.equal(texture.relativeFileName, "relative/source-direct.mp4");
  assert.equal(texture.width, 800);
  assert.equal(texture.height, 450);
  assert.equal(texture.textureDimension, "2DArrayTexture");
  assert.equal(texture.textureDimensionId, 3);
  assert.equal(texture.textureDepth, 5);
  assert.equal(texture.textureLayers, 5);
  assert.equal(texture.wrapW, "repeat");
  assert.equal(texture.uvSet, "UVMap_2");
  assert.equal(texture.mappingType, 2);
  assert.equal(texture.textureTypeUse, 1);
  assert.equal(texture.useMipMap, true);
  assert.equal(texture.colorSpace, "srgb");
  assert.equal(texture.colorSpaceId, 2);
  assert.equal(texture.encoding, 3001);
  assert.equal(texture.flipY, true);
  assert.equal(texture.unpackAlignment, 1);
  assert.equal(texture.minFilter, NearestFilter);
  assert.equal(texture.magFilter, 1006);
  assert.equal(texture.anisotropy, 4);
  assert.equal(texture.format, RGBFormat);
  assert.equal(texture.type, FloatType);
  assert.equal(texture.internalFormat, "RGBA16F");
  assert.equal(texture.internalFormatId, 34842);
  assert.equal(texture.isDepthTexture, true);
  assert.equal(texture.compareFunction, LessEqualCompare);
  assert.equal(texture.isDataTexture, true);
  assert.equal(texture.isCompressedTexture, true);
  assert.equal(texture.isTextureArray, true);
  assert.equal(texture.mipmapCount, 3);
  assert.equal(texture.matrixAutoUpdate, false);
  assert.equal(texture.blendMode, 2);
  assert.equal(texture.alpha, 0.65);
  assert.equal(texture.alphaSource, 2);
  assert.equal(texture.premultiplyAlpha, true);
  assert.deepEqual(texture.cropping, { left: 9, top: 10, right: 12, bottom: 12 });
  assert.equal(texture.duration, 2);
  assert.equal(texture.frameRate, 20);
  assert.equal(texture.frameCount, 40);
  assert.equal(texture.stopFrame, 40);
  assert.equal(texture.lastFrame, 40);
  assert.equal(texture.playSpeed, 0.75);
  assert.equal(texture.loop, true);
});

test("adapts Three.js texture usage metadata", () => {
  const scene = fromThreeObject(threeTextureMetadataScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.wrapW, "repeat");
  assert.equal(texture.textureTypeUse, 7);
  assert.equal(texture.useMipMap, true);
  assert.equal(texture.colorSpace, SRGBColorSpace);
  assert.equal(texture.colorSpaceId, 2);
  assert.equal(texture.encoding, 3001);
  assert.equal(texture.flipY, false);
  assert.equal(texture.unpackAlignment, 1);
  assert.equal(texture.minFilter, LinearMipmapLinearFilter);
  assert.equal(texture.magFilter, NearestFilter);
  assert.equal(texture.anisotropy, 8);
  assert.equal(texture.format, RGBFormat);
  assert.equal(texture.type, FloatType);
  assert.equal(texture.internalFormat, "RGBA16F");
  assert.equal(texture.internalFormatId, 34842);
  assert.equal(texture.matrixAutoUpdate, false);
  assert.equal(texture.width, 8);
  assert.equal(texture.height, 4);
  assert.equal(texture.accessMode, 0);
  assert.equal(texture.alphaSource, 1);
  assert.equal(texture.premultiplyAlpha, true);
  assert.equal(texture.imageSequence, true);
  assert.equal(texture.startFrame, 3);
  assert.equal(texture.stopFrame, 12);
  assert.equal(texture.frameRate, 12);
  assert.equal(texture.lastFrame, 12);
  assert.equal(texture.loop, true);
  assert.deepEqual(texture.cropping, { left: 1, top: 2, right: 3, bottom: 4 });
});

test("adapts Three.js depth texture sampler metadata", () => {
  const scene = fromThreeObject(threeDepthTextureMetadataScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.name, "depth_shadow");
  assert.equal(texture.isDepthTexture, true);
  assert.equal(texture.compareFunction, LessEqualCompare);
  assert.equal(texture.format, DepthFormat);
  assert.equal(texture.type, UnsignedIntType);
  assert.equal(texture.useMipMap, false);
  assert.equal(texture.width, 8);
  assert.equal(texture.height, 4);

  const text = decode(exportFbx(threeDepthTextureMetadataScene()));
  assert.match(text, /Maya\|is_depth_texture/);
  assert.match(text, /Maya\|compare_function/);
});

test("adapts Three.js dimensional and compressed texture metadata", () => {
  const scene = fromThreeObject(threeDimensionalTextureMetadataScene());
  const [volume, depthArray, compressedArray] = scene.meshes.map((mesh) => {
    return mesh.materials[0].diffuseTexture;
  });

  assert.equal(volume.name, "volume_lut");
  assert.equal(volume.textureDimension, "3d");
  assert.equal(volume.textureDimensionId, 2);
  assert.equal(volume.textureDepth, 3);
  assert.equal(volume.textureLayers, 1);
  assert.equal(volume.wrapW, "repeat");
  assert.equal(volume.isDataTexture, true);
  assert.equal(volume.isCompressedTexture, false);
  assert.equal(volume.isTextureArray, false);

  assert.equal(depthArray.name, "shadow_array");
  assert.equal(depthArray.textureDimension, "2d_array");
  assert.equal(depthArray.textureDimensionId, 3);
  assert.equal(depthArray.textureDepth, 6);
  assert.equal(depthArray.textureLayers, 6);
  assert.equal(depthArray.isDepthTexture, true);
  assert.equal(depthArray.isTextureArray, true);
  assert.equal(depthArray.compareFunction, LessEqualCompare);

  assert.equal(compressedArray.name, "compressed_array");
  assert.equal(compressedArray.textureDimensionId, 3);
  assert.equal(compressedArray.textureDepth, 2);
  assert.equal(compressedArray.textureLayers, 2);
  assert.equal(compressedArray.isCompressedTexture, true);
  assert.equal(compressedArray.isTextureArray, true);
  assert.equal(compressedArray.mipmapCount, 1);

  const text = decode(exportFbx(threeDimensionalTextureMetadataScene()));
  assert.match(text, /Maya\|texture_dimension/);
  assert.match(text, /Maya\|texture_dimension_id/);
  assert.match(text, /Maya\|texture_depth/);
  assert.match(text, /Maya\|texture_layers/);
  assert.match(text, /Maya\|is_data_texture/);
  assert.match(text, /Maya\|is_compressed_texture/);
  assert.match(text, /Maya\|is_texture_array/);
  assert.match(text, /Maya\|mipmap_count/);
  assert.match(text, /Maya\|wrap_mode_w/);
});

test("adapts Three.js VideoTexture source metadata", () => {
  const scene = fromThreeObject(threeVideoTextureMetadataScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.name, "walk_cycle_texture");
  assert.equal(texture.fileName, "media/walk-cycle.mp4");
  assert.equal(texture.relativeFileName, "media/walk-cycle.mp4");
  assert.equal(texture.width, 1920);
  assert.equal(texture.height, 1080);
  assert.equal(texture.accessMode, 0);
  assert.equal(texture.duration, 2);
  assert.equal(texture.frameRate, 24);
  assert.equal(texture.frameCount, 48);
  assert.equal(texture.stopFrame, 48);
  assert.equal(texture.lastFrame, 48);
  assert.equal(texture.playSpeed, 1.25);
  assert.equal(texture.loop, true);
  assert.equal(texture.imageSequence, false);

  const text = decode(exportFbx(threeVideoTextureMetadataScene()));
  assert.match(text, /media\/walk-cycle\.mp4/);
  assert.match(text, /Width/);
  assert.match(text, /Height/);
  assert.match(text, /PlaySpeed/);
  assert.match(text, /Loop/);
});

test("adapts Three.js userData video media sources", () => {
  const scene = fromThreeObject(threeUserDataVideoTextureMetadataScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.name, "userdata-walk");
  assert.equal(texture.fileName, "media/userdata-walk.webm");
  assert.equal(texture.relativeFileName, "media/userdata-walk.webm");
  assert.equal(texture.width, 640);
  assert.equal(texture.height, 360);
  assert.equal(texture.duration, 1.5);
  assert.equal(texture.frameRate, 30);
  assert.equal(texture.frameCount, 45);
  assert.equal(texture.stopFrame, 45);
  assert.equal(texture.lastFrame, 45);
  assert.equal(texture.playSpeed, 0.75);
  assert.equal(texture.loop, true);

  const text = decode(exportFbx(threeUserDataVideoTextureMetadataScene()));
  assert.match(text, /media\/userdata-walk\.webm/);
  assert.match(text, /PlaySpeed/);
});

test("adapts Three.js userData media element sources", () => {
  const scene = fromThreeObject(threeUserDataMediaElementTextureMetadataScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.name, "media_element_walk");
  assert.equal(texture.fileName, "media/userdata-media-element.mov");
  assert.equal(texture.relativeFileName, "media/userdata-media-element.mov");
  assert.equal(texture.width, 800);
  assert.equal(texture.height, 450);
  assert.equal(texture.duration, 2.5);
  assert.equal(texture.frameRate, 24);
  assert.equal(texture.frameCount, 60);
  assert.equal(texture.stopFrame, 60);
  assert.equal(texture.lastFrame, 60);
  assert.equal(texture.videoOffset, Math.round(0.25 * FBX_KTIME));
  assert.equal(texture.playSpeed, 1.5);
  assert.equal(texture.loop, true);

  const text = decode(exportFbx(threeUserDataMediaElementTextureMetadataScene()));
  assert.match(text, /media\/userdata-media-element\.mov/);
  assert.match(text, /Offset/);
  assert.match(text, /PlaySpeed/);
});

test("adapts Three.js userData image and source data media metadata", () => {
  const scene = fromThreeObject(threeUserDataImageSourceMetadataScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.name, "userdata-image-0001");
  assert.equal(texture.fileName, "frames/userdata-image-0001.tga");
  assert.equal(texture.relativeFileName, "frames/userdata-image-0001.tga");
  assert.equal(texture.width, 256);
  assert.equal(texture.height, 144);
  assert.equal(texture.duration, 1.25);
  assert.equal(texture.frameRate, 12);
  assert.equal(texture.frameCount, 15);
  assert.equal(texture.stopFrame, 15);
  assert.equal(texture.lastFrame, 15);
  assert.equal(texture.imageSequenceOffset, 3);
  assert.equal(texture.playSpeed, 0.5);
  assert.equal(texture.loop, true);

  const text = decode(exportFbx(threeUserDataImageSourceMetadataScene()));
  assert.match(text, /frames\/userdata-image-0001\.tga/);
  assert.match(text, /ImageSequenceOffset/);
  assert.match(text, /PlaySpeed/);
});

test("adapts Three.js direct source media metadata", () => {
  const scene = fromThreeObject(threeDirectSourceMetadataScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.name, "direct_source_texture");
  assert.equal(texture.fileName, "media/direct-source.mov");
  assert.equal(texture.relativeFileName, "relative/direct-source.mov");
  assert.equal(texture.width, 1024);
  assert.equal(texture.height, 576);
  assert.equal(texture.textureDimension, "2DArrayTexture");
  assert.equal(texture.textureDimensionId, 3);
  assert.equal(texture.textureDepth, 7);
  assert.equal(texture.textureLayers, 7);
  assert.equal(texture.wrapW, "repeat");
  assert.equal(texture.uvSet, "UVMap_2");
  assert.equal(texture.mappingType, 2);
  assert.equal(texture.textureTypeUse, 1);
  assert.equal(texture.useMipMap, true);
  assert.equal(texture.colorSpace, SRGBColorSpace);
  assert.equal(texture.colorSpaceId, 2);
  assert.equal(texture.encoding, 3001);
  assert.equal(texture.flipY, true);
  assert.equal(texture.unpackAlignment, 1);
  assert.equal(texture.minFilter, NearestFilter);
  assert.equal(texture.magFilter, LinearMipmapLinearFilter);
  assert.equal(texture.anisotropy, 4);
  assert.equal(texture.format, RGBFormat);
  assert.equal(texture.type, FloatType);
  assert.equal(texture.internalFormat, "RGBA16F");
  assert.equal(texture.internalFormatId, 34842);
  assert.equal(texture.isDepthTexture, true);
  assert.equal(texture.compareFunction, LessEqualCompare);
  assert.equal(texture.isDataTexture, true);
  assert.equal(texture.isCompressedTexture, true);
  assert.equal(texture.isTextureArray, true);
  assert.equal(texture.mipmapCount, 3);
  assert.equal(texture.matrixAutoUpdate, false);
  assert.equal(texture.blendMode, 2);
  assert.equal(texture.alpha, 0.65);
  assert.equal(texture.alphaSource, 2);
  assert.equal(texture.premultiplyAlpha, true);
  assert.deepEqual(texture.cropping, { left: 9, top: 10, right: 12, bottom: 12 });
  assert.equal(texture.duration, 3);
  assert.equal(texture.frameRate, 30);
  assert.equal(texture.frameCount, 90);
  assert.equal(texture.stopFrame, 90);
  assert.equal(texture.lastFrame, 90);
  assert.equal(texture.playSpeed, 1.2);
  assert.equal(texture.loop, true);

  const text = decode(exportFbx(threeDirectSourceMetadataScene()));
  assert.match(text, /media\/direct-source\.mov/);
  assert.match(text, /Maya\|texture_depth/);
  assert.match(text, /PlaySpeed/);
});

test("adapts Three.js authored video frame counts into frame bounds", () => {
  const scene = fromThreeObject(threeFrameCountVideoTextureMetadataScene());
  const texture = scene.meshes[0].materials[0].diffuseTexture;

  assert.equal(texture.name, "frame_count_texture");
  assert.equal(texture.fileName, "media/frame-count.mov");
  assert.equal(texture.relativeFileName, "media/frame-count.mov");
  assert.equal(texture.width, 320);
  assert.equal(texture.height, 180);
  assert.equal(texture.frameRate, 24);
  assert.equal(texture.frameCount, 96);
  assert.equal(texture.stopFrame, 96);
  assert.equal(texture.lastFrame, 96);
  assert.equal(texture.playSpeed, 1.5);

  const text = decode(exportFbx(threeFrameCountVideoTextureMetadataScene()));
  assert.match(text, /media\/frame-count\.mov/);
  assert.match(text, /StopFrame/);
  assert.match(text, /LastFrame/);
  assert.match(text, /FrameRate/);
});

test("extracts media dimensions from embedded TGA payloads", () => {
  assert.deepEqual(textureDimensionsFromPayload("image/x-tga", checkerTga()), {
    width: 2,
    height: 2
  });
});

test("normalizes texture crop aliases", () => {
  assert.deepEqual(normalizeTextureCropping({
    cropLeft: 1.1,
    cropTop: 2,
    cropRight: 3.9,
    cropBottom: -4
  }), {
    left: 1,
    top: 2,
    right: 4,
    bottom: 0
  });
  assert.deepEqual(normalizeTextureCropping({
    userData: {
      crop: [5.2, 6, 7.8, 8]
    }
  }), {
    left: 5,
    top: 6,
    right: 8,
    bottom: 8
  });
  assert.deepEqual(normalizeTextureCropping({
    source: {
      data: {
        cropping: { left: 9.4, top: 10, right: 11.6, bottom: 12 }
      }
    }
  }), {
    left: 9,
    top: 10,
    right: 12,
    bottom: 12
  });
});

test("normalizes texture alpha source aliases", () => {
  assert.equal(normalizeTextureAlphaSource("none"), 0);
  assert.equal(normalizeTextureAlphaSource("rgbIntensity"), 1);
  assert.equal(normalizeTextureAlphaSource("alpha channel"), 2);
});

test("normalizes texture color-space, encoding, and sampler aliases", () => {
  assert.equal(normalizeTextureColorSpace("none"), 0);
  assert.equal(normalizeTextureColorSpace("srgb-linear"), 1);
  assert.equal(normalizeTextureColorSpace("srgb"), 2);
  assert.equal(normalizeTextureColorSpace("display-p3"), 3);
  assert.equal(normalizeTextureEncoding("LinearEncoding"), 3000);
  assert.equal(normalizeTextureEncoding("sRGBEncoding"), 3001);
  assert.equal(normalizeTextureEncoding("RGBM16Encoding"), 3005);
  assert.equal(normalizeTextureFilter("NearestFilter"), 1003);
  assert.equal(normalizeTextureFilter("LinearMipmapLinearFilter"), 1008);
  assert.equal(normalizeTextureAnisotropy(16), 16);
  assert.equal(normalizeTextureFormat("RGBFormat"), 1022);
  assert.equal(normalizeTextureFormat("RGBAFormat"), 1023);
  assert.equal(normalizeTextureType("UnsignedByteType"), UnsignedByteType);
  assert.equal(normalizeTextureType("FloatType"), FloatType);
  assert.equal(normalizeTextureInternalFormatId("RGBA16F"), 34842);
  assert.equal(normalizeTextureInternalFormatId("SRGB8_ALPHA8"), 35907);
  assert.equal(normalizeTextureCompareFunction("LessEqualCompare"), LessEqualCompare);
  assert.equal(normalizeTextureCompareFunction("greater-equal"), 518);
  assert.equal(normalizeTextureCompareFunction("not equal"), 517);
  assert.equal(normalizeTextureDimensionKind("2DArrayTexture"), 3);
  assert.equal(normalizeTextureDimensionKind("volume"), 2);
  assert.equal(textureDimensionKindLabel("CubeTexture"), "cube");
});

test("normalizes video image-sequence metadata", () => {
  assert.deepEqual(normalizeTextureVideo({
    videoAccessMode: "embedded",
    sequence: {
      startFrame: 1.2,
      stopFrame: 8.6,
      fps: 23.976,
      lastFrame: 9
    },
    videoOffset: 42,
    freeRunning: true
  }, false), {
    accessMode: 1,
    startFrame: 1,
    stopFrame: 9,
    videoOffset: 42,
    playSpeed: 0,
    freeRunning: true,
    loop: false,
    interlaceMode: 0,
    imageSequence: true,
    imageSequenceOffset: 0,
    frameRate: 23.976,
    lastFrame: 9
  });

  assert.deepEqual(normalizeTextureVideo({
    userData: {
      image: {
        frameIndex: 4,
        duration: 1
      },
      source: {
        data: {
          fps: 8,
          playbackRate: 0.5
        }
      }
    }
  }, false), {
    accessMode: 0,
    startFrame: 0,
    stopFrame: 8,
    videoOffset: 0,
    playSpeed: 0.5,
    freeRunning: false,
    loop: false,
    interlaceMode: 0,
    imageSequence: false,
    imageSequenceOffset: 4,
    frameRate: 8,
    lastFrame: 8,
    duration: 1,
    frameCount: 8
  });
});

test("derives video frame bounds from duration and frame rate", () => {
  assert.deepEqual(normalizeTextureVideo({
    duration: 2.5,
    frameRate: 24,
    videoAccessMode: "disk"
  }, false), {
    accessMode: 0,
    startFrame: 0,
    stopFrame: 60,
    videoOffset: 0,
    playSpeed: 0,
    freeRunning: false,
    loop: false,
    interlaceMode: 0,
    imageSequence: false,
    imageSequenceOffset: 0,
    frameRate: 24,
    lastFrame: 60,
    duration: 2.5,
    frameCount: 60
  });
});

test("uses explicit video frame counts for frame bounds", () => {
  assert.deepEqual(normalizeTextureVideo({
    userData: {
      videoFrameCount: 72,
      fps: 24
    },
    videoAccessMode: "disk"
  }, false), {
    accessMode: 0,
    startFrame: 0,
    stopFrame: 72,
    videoOffset: 0,
    playSpeed: 0,
    freeRunning: false,
    loop: false,
    interlaceMode: 0,
    imageSequence: false,
    imageSequenceOffset: 0,
    frameRate: 24,
    lastFrame: 72,
    frameCount: 72
  });
});
