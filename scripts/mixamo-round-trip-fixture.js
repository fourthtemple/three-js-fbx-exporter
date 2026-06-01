import {
  AnimationClip,
  Bone,
  BufferGeometry,
  Euler,
  Float32BufferAttribute,
  MeshStandardMaterial,
  NumberKeyframeTrack,
  Object3D,
  Quaternion,
  QuaternionKeyframeTrack,
  Skeleton,
  SkinnedMesh,
  Texture,
  Uint16BufferAttribute,
  VectorKeyframeTrack
} from "three";
import { checkerTga } from "./sample-texture.js";

const BONE_NAMES = Object.freeze([
  "mixamorig:Hips",
  "mixamorig:Spine",
  "mixamorig:Spine1",
  "mixamorig:Neck",
  "mixamorig:Head",
  "mixamorig:LeftUpLeg",
  "mixamorig:LeftLeg",
  "mixamorig:LeftFoot",
  "mixamorig:LeftToeBase",
  "mixamorig:RightUpLeg",
  "mixamorig:RightLeg",
  "mixamorig:RightFoot",
  "mixamorig:RightToeBase",
  "mixamorig:LeftArm",
  "mixamorig:LeftForeArm",
  "mixamorig:RightArm",
  "mixamorig:RightForeArm"
]);

function checkerDataUrl() {
  return `data:image/tga;base64,${Buffer.from(checkerTga()).toString("base64")}`;
}

function makeTexture(name, fileName) {
  const texture = new Texture({ src: fileName });
  texture.name = name;
  texture.userData.relativeFileName = fileName;
  texture.wrapS = 1000;
  texture.wrapT = 1000;
  return texture;
}

function makeDataUrlTexture(name) {
  const texture = new Texture({ src: checkerDataUrl() });
  texture.name = name;
  texture.userData.relativeFileName = `${name}.tga`;
  return texture;
}

function makeRawTexture(name) {
  const texture = new Texture();
  texture.name = name;
  texture.userData.source = {
    width: 2,
    height: 2,
    data: new Uint8Array([
      255, 128, 128, 255,
      128, 255, 128, 255,
      128, 128, 255, 255,
      255, 255, 255, 255
    ])
  };
  return texture;
}

function makeMaterials() {
  const body = new MeshStandardMaterial({
    name: "CatBody",
    color: 0x70513f,
    roughness: 0.62,
    metalness: 0,
    map: makeTexture("body_checker", "checker.tga")
  });
  body.normalMap = makeRawTexture("body_raw_normal");

  const paws = new MeshStandardMaterial({
    name: "CatPaws",
    color: 0x231f20,
    roughness: 0.8,
    metalness: 0,
    map: makeDataUrlTexture("paw_data_url")
  });
  return [body, paws];
}

function makeGeometry() {
  const positions = [
    -0.34, 0, 0.48,
    -0.34, 0, -0.42,
    -0.36, 1.05, 0.03,
    -0.32, 2.05, 0.02,
    0.34, 0, 0.48,
    0.34, 0, -0.42,
    0.36, 1.05, 0.03,
    0.32, 2.05, 0.02,
    -0.48, 2.12, 0,
    0.48, 2.12, 0,
    -0.54, 3.26, -0.02,
    0.54, 3.26, -0.02,
    0, 4.08, 0.06,
    -0.82, 2.95, 0,
    -1.22, 2.36, 0.02,
    0.82, 2.95, 0,
    1.22, 2.36, 0.02
  ];
  const indices = [
    0, 1, 2, 1, 3, 2,
    4, 6, 5, 5, 6, 7,
    8, 9, 10, 9, 11, 10,
    10, 11, 12,
    10, 13, 14, 11, 16, 15,
    0, 2, 4, 4, 2, 6
  ];
  const normals = Array.from({ length: positions.length / 3 }, () => [0, 0, 1]).flat();
  const uvs = Array.from({ length: positions.length / 3 }, (_, index) => [
    index % 2,
    Math.floor(index / 2) % 2
  ]).flat();
  const skinIndex = [
    8, 7, 0, 0,
    8, 7, 0, 0,
    6, 5, 0, 0,
    5, 0, 0, 0,
    12, 11, 0, 0,
    12, 11, 0, 0,
    10, 9, 0, 0,
    9, 0, 0, 0,
    0, 1, 0, 0,
    0, 1, 0, 0,
    2, 1, 0, 0,
    2, 1, 0, 0,
    4, 3, 2, 0,
    13, 14, 2, 0,
    14, 13, 0, 0,
    15, 16, 2, 0,
    16, 15, 0, 0
  ];
  const skinWeight = [
    0.7, 0.3, 0, 0,
    0.75, 0.25, 0, 0,
    0.72, 0.28, 0, 0,
    0.86, 0.14, 0, 0,
    0.7, 0.3, 0, 0,
    0.75, 0.25, 0, 0,
    0.72, 0.28, 0, 0,
    0.86, 0.14, 0, 0,
    0.82, 0.18, 0, 0,
    0.82, 0.18, 0, 0,
    0.72, 0.28, 0, 0,
    0.72, 0.28, 0, 0,
    0.62, 0.28, 0.1, 0,
    0.68, 0.22, 0.1, 0,
    0.72, 0.28, 0, 0,
    0.68, 0.22, 0.1, 0,
    0.72, 0.28, 0, 0
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeight, 4));
  geometry.setIndex(indices);
  geometry.addGroup(0, 24, 0);
  geometry.addGroup(24, 12, 1);
  geometry.morphAttributes.position = [
    new Float32BufferAttribute(positions.map((value, index) => {
      const axis = index % 3;
      const vertex = Math.floor(index / 3);
      return value + (axis === 1 && vertex >= 8 ? 0.08 : axis === 2 && vertex >= 10 ? 0.12 : 0);
    }), 3)
  ];
  geometry.morphAttributes.position[0].name = "TailBalance";
  return geometry;
}

function makeBone(name, position) {
  const bone = new Bone();
  bone.name = name;
  bone.position.set(...position);
  return bone;
}

function makeSkeleton() {
  const bones = new Map();
  for (const name of BONE_NAMES) {
    bones.set(name, makeBone(name, [0, 0, 0]));
  }
  bones.get("mixamorig:Hips").position.set(0, 2.05, 0);
  bones.get("mixamorig:Spine").position.set(0, 0.55, 0);
  bones.get("mixamorig:Spine1").position.set(0, 0.58, 0);
  bones.get("mixamorig:Neck").position.set(0, 0.48, 0);
  bones.get("mixamorig:Head").position.set(0, 0.42, 0.05);
  bones.get("mixamorig:LeftUpLeg").position.set(-0.32, -0.08, 0);
  bones.get("mixamorig:LeftLeg").position.set(0, -0.92, 0.02);
  bones.get("mixamorig:LeftFoot").position.set(0, -0.88, 0.1);
  bones.get("mixamorig:LeftToeBase").position.set(0, -0.05, 0.42);
  bones.get("mixamorig:RightUpLeg").position.set(0.32, -0.08, 0);
  bones.get("mixamorig:RightLeg").position.set(0, -0.92, 0.02);
  bones.get("mixamorig:RightFoot").position.set(0, -0.88, 0.1);
  bones.get("mixamorig:RightToeBase").position.set(0, -0.05, 0.42);
  bones.get("mixamorig:LeftArm").position.set(-0.48, 0.95, 0);
  bones.get("mixamorig:LeftForeArm").position.set(-0.44, -0.58, 0.02);
  bones.get("mixamorig:RightArm").position.set(0.48, 0.95, 0);
  bones.get("mixamorig:RightForeArm").position.set(0.44, -0.58, 0.02);

  const hips = bones.get("mixamorig:Hips");
  hips.add(bones.get("mixamorig:Spine"));
  bones.get("mixamorig:Spine").add(bones.get("mixamorig:Spine1"));
  bones.get("mixamorig:Spine1").add(bones.get("mixamorig:Neck"));
  bones.get("mixamorig:Neck").add(bones.get("mixamorig:Head"));
  hips.add(bones.get("mixamorig:LeftUpLeg"));
  bones.get("mixamorig:LeftUpLeg").add(bones.get("mixamorig:LeftLeg"));
  bones.get("mixamorig:LeftLeg").add(bones.get("mixamorig:LeftFoot"));
  bones.get("mixamorig:LeftFoot").add(bones.get("mixamorig:LeftToeBase"));
  hips.add(bones.get("mixamorig:RightUpLeg"));
  bones.get("mixamorig:RightUpLeg").add(bones.get("mixamorig:RightLeg"));
  bones.get("mixamorig:RightLeg").add(bones.get("mixamorig:RightFoot"));
  bones.get("mixamorig:RightFoot").add(bones.get("mixamorig:RightToeBase"));
  bones.get("mixamorig:Spine1").add(bones.get("mixamorig:LeftArm"));
  bones.get("mixamorig:LeftArm").add(bones.get("mixamorig:LeftForeArm"));
  bones.get("mixamorig:Spine1").add(bones.get("mixamorig:RightArm"));
  bones.get("mixamorig:RightArm").add(bones.get("mixamorig:RightForeArm"));
  return { hips, bones: BONE_NAMES.map((name) => bones.get(name)) };
}

function quaternionValues(...rotations) {
  return rotations.flatMap((rotation) => new Quaternion().setFromEuler(new Euler(...rotation)).toArray());
}

function makeAnimations(mesh) {
  const times = [0, 0.4, 0.8, 1.2];
  const walk = new AnimationClip("WalkForward_Edited", 1.2, [
    new VectorKeyframeTrack("Armature.bones[mixamorig:Hips].position", times, [
      0, 2.05, 0,
      0, 2.12, 0.45,
      0, 2.04, 0.9,
      0, 2.08, 1.35
    ]),
    new QuaternionKeyframeTrack("Armature.bones[mixamorig:LeftFoot].quaternion", times, quaternionValues(
      [-0.05, 0, 0],
      [0.38, 0, 0.05],
      [-0.08, 0, 0],
      [-0.05, 0, 0]
    )),
    new QuaternionKeyframeTrack("Armature.bones[mixamorig:RightFoot].quaternion", times, quaternionValues(
      [0.32, 0, -0.04],
      [-0.06, 0, 0],
      [0.34, 0, -0.03],
      [0.32, 0, -0.04]
    )),
    new QuaternionKeyframeTrack("Armature.bones[mixamorig:LeftForeArm].quaternion", times, quaternionValues(
      [0, 0, 0.18],
      [0, 0, -0.1],
      [0, 0, 0.16],
      [0, 0, 0.18]
    )),
    new NumberKeyframeTrack(`${mesh.name}.morphTargetInfluences[TailBalance]`, times, [
      0.1,
      0.55,
      0.2,
      0.1
    ]),
    new VectorKeyframeTrack(`${mesh.name}.material.map.offset`, [0, 1.2], [
      0, 0,
      0.2, 0.1
    ])
  ]);
  const loopBlend = new AnimationClip("LoopBlend_EndToStart", 1.2, [
    new VectorKeyframeTrack("Armature.bones[mixamorig:Hips].position", [0, 1.2], [
      0, 2.08, 1.35,
      0, 2.05, 2.7
    ]),
    new QuaternionKeyframeTrack("Armature.bones[mixamorig:Spine1].quaternion", [0, 0.6, 1.2], quaternionValues(
      [0, 0, 0.05],
      [0, 0, -0.05],
      [0, 0, 0.05]
    ))
  ]);
  return [walk, loopBlend];
}

export function createMixamoRoundTripFixture() {
  const { hips, bones } = makeSkeleton();
  const mesh = new SkinnedMesh(makeGeometry(), makeMaterials());
  mesh.name = "MixamoCatMesh";
  mesh.add(hips);
  mesh.bind(new Skeleton(bones));
  mesh.updateMorphTargets();
  mesh.morphTargetInfluences[0] = 0.1;

  const root = new Object3D();
  root.name = "MixamoCleanupRoundTrip";
  root.frameRate = 30;
  root.add(mesh);
  root.animations = makeAnimations(mesh);

  return {
    root,
    animations: root.animations,
    frameRate: 30,
    expectations: {
      meshes: 1,
      skinnedMeshes: 1,
      materials: 2,
      textures: 3,
      morphTargets: ["TailBalance"],
      bones: BONE_NAMES,
      animations: ["WalkForward_Edited", "LoopBlend_EndToStart"],
      hipsTravelZ: 1.35
    }
  };
}

export function mixamoFixtureTextureResolver(fileName) {
  return fileName === "checker.tga"
    ? { content: checkerTga(), mimeType: "image/tga" }
    : null;
}
