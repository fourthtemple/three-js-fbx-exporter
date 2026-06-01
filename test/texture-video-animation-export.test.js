import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AnimationClip,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  NumberKeyframeTrack,
  Scene,
  Texture
} from "three";
import { exportFbx, fromThreeObject, normalizeFbxScene } from "../src/index.js";
import { FBX_KTIME } from "../src/core/fbx-values.js";
import { normalizeTextureVideo } from "../src/texture/texture-video.js";
import {
  normalizeTextureVideoAnimationProperty,
  textureVideoScalarKeyframeValue
} from "../src/texture/texture-video-animation-normalizer.js";
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

function textureVideoScene() {
  return {
    name: "TextureVideoAnimationScene",
    meshes: [
      {
        name: "Quad",
        materials: [
          {
            name: "SamplerMaterial",
            diffuseTexture: {
              name: "sampler_checker",
              src: checkerDataUrl(),
              width: 64,
              height: 32,
              videoAccessMode: "disk",
              sequence: {
                startFrame: 1,
                stopFrame: 12,
                currentFrame: 2,
                frameRate: 12,
                lastFrame: 12
              },
              videoOffset: 4,
              playSpeed: 1,
              freeRunning: false,
              videoLoop: false,
              interlaceMode: 0
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
        name: "SamplerPlayback",
        frameRate: 30,
        tracks: [
          {
            target: "sampler_checker",
            property: "videoWidth",
            keyframes: [
              { frame: 0, value: 64 },
              { frame: 30, value: 128 }
            ]
          },
          {
            target: "sampler_checker",
            property: "height",
            keyframes: [
              { frame: 0, value: 32 },
              { frame: 30, value: 64 }
            ]
          },
          {
            target: "sampler_checker",
            property: "videoAccessMode",
            keyframes: [
              { frame: 0, value: "disk" },
              { frame: 30, value: "embedded" }
            ]
          },
          {
            target: "sampler_checker",
            property: "videoStartFrame",
            keyframes: [
              { frame: 0, value: 1 },
              { frame: 30, value: 5 }
            ]
          },
          {
            target: "sampler_checker",
            property: "videoStopFrame",
            keyframes: [
              { frame: 0, value: 12 },
              { frame: 30, value: 18 }
            ]
          },
          {
            target: "sampler_checker",
            property: "videoOffset",
            keyframes: [
              { frame: 0, value: 4 },
              { frame: 30, value: 8 }
            ]
          },
          {
            target: "sampler_checker",
            property: "currentTime",
            keyframes: [
              { frame: 0, value: 0.25 },
              { frame: 30, value: 0.5 }
            ]
          },
          {
            target: "sampler_checker",
            property: "videoPlaySpeed",
            keyframes: [
              { frame: 0, value: 1 },
              { frame: 30, value: 0.5 }
            ]
          },
          {
            target: "sampler_checker",
            property: "videoFreeRunning",
            keyframes: [
              { frame: 0, value: false },
              { frame: 30, value: true }
            ]
          },
          {
            target: "sampler_checker",
            property: "videoLoop",
            keyframes: [
              { frame: 0, value: false },
              { frame: 30, value: true }
            ]
          },
          {
            target: "sampler_checker",
            property: "videoInterlaceMode",
            keyframes: [
              { frame: 0, value: 0 },
              { frame: 30, value: 2 }
            ]
          },
          {
            target: "sampler_checker",
            property: "videoImageSequence",
            keyframes: [
              { frame: 0, value: true },
              { frame: 30, value: false }
            ]
          },
          {
            target: "sampler_checker",
            property: "currentFrame",
            keyframes: [
              { frame: 0, currentFrame: 2 },
              { frame: 30, currentFrame: 6 }
            ]
          },
          {
            target: "sampler_checker",
            property: "videoFrameRate",
            keyframes: [
              { frame: 0, value: 12 },
              { frame: 30, value: 24 }
            ]
          },
          {
            target: "sampler_checker",
            property: "videoLastFrame",
            keyframes: [
              { frame: 0, value: 12 },
              { frame: 30, value: 18 }
            ]
          }
        ]
      }
    ]
  };
}

function threeTextureVideoScene() {
  const texture = new Texture({ src: checkerDataUrl(), name: "checker_image" });
  texture.name = "sampler_checker";
  texture.image.videoWidth = 64;
  texture.image.videoHeight = 32;
  texture.image.currentTime = 0.25;
  texture.image.playbackRate = 1;
  texture.userData.videoAccessMode = "disk";
  texture.userData.startFrame = 1;
  texture.userData.stopFrame = 12;
  texture.userData.videoOffset = 4;
  texture.userData.playSpeed = 1;
  texture.userData.freeRunning = false;
  texture.userData.videoLoop = false;
  texture.userData.interlaceMode = 0;
  texture.userData.imageSequence = true;
  texture.userData.currentFrame = 2;
  texture.userData.frameRate = 12;
  texture.userData.lastFrame = 12;

  const material = new MeshBasicMaterial({ name: "SamplerMaterial", map: texture });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "Quad";

  const scene = new Scene();
  scene.name = "ThreeTextureVideoAnimationScene";
  scene.add(mesh);
  scene.animations = [
    new AnimationClip("SamplerPlayback", 1, [
      new NumberKeyframeTrack("Quad.material.map.image.videoWidth", [0, 1], [64, 128]),
      new NumberKeyframeTrack("Quad.material.map.source.data.videoHeight", [0, 1], [32, 64]),
      new NumberKeyframeTrack("Quad.material.map.userData.videoAccessMode", [0, 1], [0, 1]),
      new NumberKeyframeTrack("Quad.material.map.userData.startFrame", [0, 1], [1, 5]),
      new NumberKeyframeTrack("Quad.material.map.userData.stopFrame", [0, 1], [12, 18]),
      new NumberKeyframeTrack("Quad.material.map.userData.videoOffset", [0, 1], [4, 8]),
      new NumberKeyframeTrack("Quad.material.map.image.currentTime", [0, 1], [0.25, 0.5]),
      new NumberKeyframeTrack("Quad.material.map.image.playbackRate", [0, 1], [1, 0.5]),
      new NumberKeyframeTrack("Quad.material.map.userData.freeRunning", [0, 1], [0, 1]),
      new NumberKeyframeTrack("Quad.material.map.userData.videoLoop", [0, 1], [0, 1]),
      new NumberKeyframeTrack("Quad.material.map.userData.interlaceMode", [0, 1], [0, 2]),
      new NumberKeyframeTrack("Quad.material.map.userData.imageSequence", [0, 1], [1, 0]),
      new NumberKeyframeTrack("Quad.material.map.userData.currentFrame", [0, 1], [2, 6]),
      new NumberKeyframeTrack("Quad.material.map.userData.frameRate", [0, 1], [12, 24]),
      new NumberKeyframeTrack("Quad.material.map.userData.lastFrame", [0, 1], [12, 18])
    ])
  ];
  return scene;
}

function threeNestedTextureVideoScene() {
  const texture = new Texture();
  texture.name = "nested_video";
  texture.userData.video = {
    currentSrc: "media/nested.mp4",
    videoWidth: 320,
    videoHeight: 180,
    playbackRate: 1,
    loop: false
  };

  const material = new MeshBasicMaterial({ name: "NestedVideoMaterial", map: texture });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "Quad";

  const scene = new Scene();
  scene.name = "ThreeNestedTextureVideoAnimationScene";
  scene.add(mesh);
  scene.animations = [
    new AnimationClip("NestedSamplerPlayback", 1, [
      new NumberKeyframeTrack("Quad.material.map.userData.video.videoWidth", [0, 1], [320, 640]),
      new NumberKeyframeTrack("Quad.material.map.userData.video.playbackRate", [0, 1], [1, 0.25]),
      new NumberKeyframeTrack("Quad.material.map.userData.video.loop", [0, 1], [0, 1])
    ])
  ];
  return scene;
}

function threeNestedTextureImageSourceScene() {
  const texture = new Texture();
  texture.name = "nested_image_sequence";
  texture.userData.image = {
    currentSrc: "frames/nested_0001.tga",
    videoWidth: 256,
    frameIndex: 1
  };
  texture.userData.source = {
    currentTime: 1.25,
    data: {
      videoHeight: 144,
      playbackRate: 1
    }
  };

  const material = new MeshBasicMaterial({ name: "NestedImageMaterial", map: texture });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "Quad";

  const scene = new Scene();
  scene.name = "ThreeNestedTextureImageSourceAnimationScene";
  scene.add(mesh);
  scene.animations = [
    new AnimationClip("NestedImageSamplerPlayback", 1, [
      new NumberKeyframeTrack("Quad.material.map.userData.image.videoWidth", [0, 1], [256, 512]),
      new NumberKeyframeTrack("Quad.material.map.userData.source.data.videoHeight", [0, 1], [144, 288]),
      new NumberKeyframeTrack("Quad.material.map.userData.image.frameIndex", [0, 1], [1, 12]),
      new NumberKeyframeTrack("Quad.material.map.userData.source.currentTime", [0, 1], [1.25, 2]),
      new NumberKeyframeTrack("Quad.material.map.userData.source.data.playbackRate", [0, 1], [1, 0.5])
    ])
  ];
  return scene;
}

function threeMediaOwnedTextureAnimationScene() {
  const texture = new Texture();
  texture.name = "media_owned_video";
  texture.image = {
    currentSrc: "media/owned.mp4",
    videoWidth: 160,
    videoHeight: 90,
    currentTime: 0.25,
    playbackRate: 1,
    animations: [
      new AnimationClip("ImageMediaPlayback", 1, [
        new NumberKeyframeTrack("currentTime", [0, 1], [0.25, 0.75]),
        new NumberKeyframeTrack("playbackRate", [0, 1], [1, 0.5])
      ])
    ]
  };
  texture.userData.source = {
    data: {
      animations: [
        new AnimationClip("SourceImageSequence", 1, [
          new NumberKeyframeTrack("frameIndex", [0, 1], [1, 12])
        ])
      ]
    }
  };

  const material = new MeshBasicMaterial({ name: "MediaOwnedMaterial", map: texture });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "Quad";

  const scene = new Scene();
  scene.name = "ThreeMediaOwnedTextureAnimationScene";
  scene.add(mesh);
  return scene;
}

function threeSourceAndUserDataOwnedTextureAnimationScene() {
  const texture = new Texture();
  texture.name = "source_owned_video";
  texture.source.data = {
    currentSrc: "media/source.mp4",
    currentTime: 0.1,
    playbackRate: 1
  };
  texture.source.currentTime = 0.1;
  texture.userData.customProperties = {
    "Maya|gain": { value: 0.2 }
  };

  const sharedClip = new AnimationClip("DedupedTextureClip", 1, [
    new NumberKeyframeTrack("currentTime", [0, 1], [0, 0.2])
  ]);
  texture.animations = [sharedClip];
  texture.source.animations = [
    new AnimationClip("TextureSourcePlayback", 1, [
      new NumberKeyframeTrack("currentTime", [0, 1], [0.1, 0.9])
    ])
  ];
  texture.userData.animations = [
    new AnimationClip("TextureUserDataCustoms", 1, [
      new NumberKeyframeTrack("customProperties[Maya|gain].value", [0, 1], [0.2, 0.8])
    ])
  ];
  texture.userData.image = { animations: [sharedClip] };
  texture.userData.source = {
    playbackRate: 1,
    data: { playbackRate: 1 },
    animations: [
      new AnimationClip("UserDataSourcePlayback", 1, [
        new NumberKeyframeTrack("playbackRate", [0, 1], [1, 0.25])
      ])
    ]
  };

  const material = new MeshBasicMaterial({ name: "SourceOwnedMaterial", map: texture });
  const mesh = new Mesh(quadGeometry(), material);
  mesh.name = "Quad";

  const scene = new Scene();
  scene.name = "ThreeSourceAndUserDataOwnedTextureAnimationScene";
  scene.add(mesh);
  return scene;
}

const VIDEO_PROPERTIES = [
  "videoWidth",
  "videoHeight",
  "videoAccessMode",
  "videoStartFrame",
  "videoStopFrame",
  "videoOffset",
  "videoCurrentTime",
  "videoPlaySpeed",
  "videoFreeRunning",
  "videoLoop",
  "videoInterlaceMode",
  "videoImageSequence",
  "videoImageSequenceOffset",
  "videoFrameRate",
  "videoLastFrame"
];

test("normalizes texture video animation targets", () => {
  const scene = normalizeFbxScene(textureVideoScene());

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), VIDEO_PROPERTIES);
  assert.deepEqual(scene.animations[0].tracks.map((track) => {
    return track.keyframes.map((keyframe) => keyframe.value);
  }), [
    [64, 128],
    [32, 64],
    [0, 1],
    [1, 5],
    [12, 18],
    [4, 8],
    [Math.round(0.25 * FBX_KTIME), Math.round(0.5 * FBX_KTIME)],
    [1, 0.5],
    [0, 1],
    [0, 1],
    [0, 2],
    [1, 0],
    [2, 6],
    [12, 24],
    [12, 18]
  ]);
});

test("normalizes image-sequence current-frame aliases", () => {
  for (const alias of ["currentFrame", "currentSequenceFrame", "sequenceFrame", "imageSequenceFrame", "frameIndex"]) {
    assert.equal(normalizeTextureVideoAnimationProperty(alias), "videoImageSequenceOffset");
  }
  assert.equal(normalizeTextureVideo({ sequenceFrame: 7 }).imageSequenceOffset, 7);
  assert.equal(normalizeTextureVideo({ userData: { frameIndex: 9 } }).imageSequenceOffset, 9);
  assert.equal(textureVideoScalarKeyframeValue({ imageSequenceFrame: 11 }, "videoImageSequenceOffset"), 11);
  assert.equal(textureVideoScalarKeyframeValue({ value: { frameIndex: 13 } }, "videoImageSequenceOffset"), 13);
});

test("normalizes media current-time aliases as FBX video offsets", () => {
  assert.equal(normalizeTextureVideo({ image: { currentTime: 1.5 } }).videoOffset, Math.round(1.5 * FBX_KTIME));
  assert.equal(normalizeTextureVideo({ userData: { source: { data: { currentTimeSeconds: 2 } } } }).videoOffset, 2 * FBX_KTIME);
  assert.equal(normalizeTextureVideoAnimationProperty("currentTime"), "videoCurrentTime");
  assert.equal(textureVideoScalarKeyframeValue({ value: 2.25 }, "videoCurrentTime"), Math.round(2.25 * FBX_KTIME));
  assert.equal(textureVideoScalarKeyframeValue({ value: { currentTime: 1.75 } }, "videoCurrentTime"), Math.round(1.75 * FBX_KTIME));
  assert.equal(textureVideoScalarKeyframeValue({ currentTime: 0.5 }, "videoCurrentTime"), Math.round(0.5 * FBX_KTIME));
});

test("normalizes object-valued texture video keyframe aliases", () => {
  assert.equal(textureVideoScalarKeyframeValue({ value: { videoWidth: 256 } }, "videoWidth"), 256);
  assert.equal(textureVideoScalarKeyframeValue({ value: { value: { width: 320 } } }, "videoWidth"), 320);
  assert.equal(textureVideoScalarKeyframeValue({ value: { naturalHeight: 144 } }, "videoHeight"), 144);
  assert.equal(textureVideoScalarKeyframeValue({ defaultValue: { naturalHeight: 180 } }, "videoHeight"), 180);
  assert.equal(textureVideoScalarKeyframeValue({ value: { accessMode: "embedded" } }, "videoAccessMode"), 1);
  assert.equal(textureVideoScalarKeyframeValue({ value: { playbackRate: 0.75 } }, "videoPlaySpeed"), 0.75);
  assert.equal(textureVideoScalarKeyframeValue({ value: { defaultValue: { playbackRate: 1.25 } } }, "videoPlaySpeed"), 1.25);
  assert.equal(textureVideoScalarKeyframeValue({ value: { value: 1.5 } }, "videoCurrentTime"), Math.round(1.5 * FBX_KTIME));
  assert.equal(textureVideoScalarKeyframeValue({ value: { defaultValue: { currentFrame: 17 } } }, "videoImageSequenceOffset"), 17);
});

test("writes texture video animation curves", () => {
  const text = decode(exportFbx(textureVideoScene()));

  assert.match(text, /sampler_checker/);
  assert.match(text, /Width/);
  assert.match(text, /Height/);
  assert.match(text, /AccessMode/);
  assert.match(text, /StartFrame/);
  assert.match(text, /StopFrame/);
  assert.match(text, /Offset/);
  assert.match(text, /PlaySpeed/);
  assert.match(text, /FreeRunning/);
  assert.match(text, /Loop/);
  assert.match(text, /InterlaceMode/);
  assert.match(text, /ImageSequence/);
  assert.match(text, /ImageSequenceOffset/);
  assert.match(text, /FrameRate/);
  assert.match(text, /LastFrame/);
  assert.match(text, /AnimationCurveNode/);
  assert.match(text, /AnimationCurve/);
});

test("adapts Three.js texture video tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeTextureVideoScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), VIDEO_PROPERTIES);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), VIDEO_PROPERTIES.map(() => "sampler_checker"));
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.keyframes[1].value), [
    128,
    64,
    1,
    5,
    18,
    8,
    Math.round(0.5 * FBX_KTIME),
    0.5,
    1,
    1,
    2,
    0,
    6,
    24,
    18
  ]);
});

test("adapts nested Three.js userData video tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeNestedTextureVideoScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "videoWidth",
    "videoPlaySpeed",
    "videoLoop"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), [
    "nested_video",
    "nested_video",
    "nested_video"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.keyframes[1].value), [
    640,
    0.25,
    1
  ]);
});

test("adapts nested Three.js userData image and source data tracks before export", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeNestedTextureImageSourceScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations[0].tracks.map((track) => track.property), [
    "videoWidth",
    "videoHeight",
    "videoImageSequenceOffset",
    "videoCurrentTime",
    "videoPlaySpeed"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.target), [
    "nested_image_sequence",
    "nested_image_sequence",
    "nested_image_sequence",
    "nested_image_sequence",
    "nested_image_sequence"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.keyframes[1].value), [
    512,
    288,
    12,
    2 * FBX_KTIME,
    0.5
  ]);
});

test("collects animation clips owned by nested texture media sources", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeMediaOwnedTextureAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations.map((clip) => clip.name), [
    "ImageMediaPlayback",
    "SourceImageSequence"
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => [track.target, track.property]), [
    ["media_owned_video", "videoCurrentTime"],
    ["media_owned_video", "videoPlaySpeed"]
  ]);
  assert.deepEqual(scene.animations[0].tracks.map((track) => track.keyframes[1].value), [
    Math.round(0.75 * FBX_KTIME),
    0.5
  ]);
  assert.deepEqual(scene.animations[1].tracks.map((track) => [track.target, track.property]), [
    ["media_owned_video", "videoImageSequenceOffset"]
  ]);
  assert.equal(scene.animations[1].tracks[0].keyframes[1].value, 12);
});

test("collects texture source and userData owned clips with owner-local paths", () => {
  const scene = normalizeFbxScene(fromThreeObject(threeSourceAndUserDataOwnedTextureAnimationScene(), {
    bakeAnimations: false,
    frameRate: 30
  }));

  assert.deepEqual(scene.animations.map((clip) => clip.name), [
    "DedupedTextureClip",
    "TextureSourcePlayback",
    "TextureUserDataCustoms",
    "UserDataSourcePlayback"
  ]);
  assert.deepEqual(scene.animations.map((clip) => clip.tracks.map((track) => [track.target, track.property])), [
    [["source_owned_video", "videoCurrentTime"]],
    [["source_owned_video", "videoCurrentTime"]],
    [["source_owned_video", "customTextureScalar:Maya|gain"]],
    [["source_owned_video", "videoPlaySpeed"]]
  ]);
  assert.deepEqual(scene.animations.map((clip) => clip.tracks[0].keyframes[1].value), [
    Math.round(Math.fround(0.2) * FBX_KTIME),
    Math.round(Math.fround(0.9) * FBX_KTIME),
    Math.fround(0.8),
    0.25
  ]);
});
