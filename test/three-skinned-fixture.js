import {
  AnimationClip,
  Bone,
  BufferGeometry,
  Euler,
  Float32BufferAttribute,
  MeshBasicMaterial,
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

export function createThreeSkinnedFixture() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    -0.5, 0, 0,
    0.5, 0, 0,
    0.5, 2, 0,
    -0.5, 2, 0
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
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute([
    0, 0, 0, 0,
    0, 0, 0, 0,
    1, 0, 0, 0,
    1, 0, 0, 0
  ], 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute([
    1, 0, 0, 0,
    1, 0, 0, 0,
    1, 0, 0, 0,
    1, 0, 0, 0
  ], 4));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);

  const texture = new Texture({ src: "checker.tga" });
  texture.name = "checker";
  texture.userData.relativeFileName = "checker.tga";

  const normalTexture = new Texture({ src: "normal.tga" });
  normalTexture.name = "normal";
  normalTexture.userData.relativeFileName = "normal.tga";

  const material = new MeshBasicMaterial({ name: "ThreeSkinMaterial", map: texture });
  material.normalMap = normalTexture;
  const mesh = new SkinnedMesh(geometry, material);
  mesh.name = "ThreeSkinnedMesh";

  const rootBone = new Bone();
  rootBone.name = "Root";
  rootBone.position.set(0, 0, 0);

  const spineBone = new Bone();
  spineBone.name = "Spine";
  spineBone.position.set(0, 1, 0);
  rootBone.add(spineBone);

  mesh.add(rootBone);
  mesh.bind(new Skeleton([rootBone, spineBone]));

  const identity = new Quaternion().toArray();
  const bend = new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 6)).toArray();
  const clip = new AnimationClip("ThreeBoneBend", 1, [
    new QuaternionKeyframeTrack("Armature.bones[Spine].quaternion", [0, 0.5, 1], [
      ...identity,
      ...bend,
      ...identity
    ])
  ]);

  const root = new Object3D();
  root.name = "ThreeSkinnedScene";
  root.add(mesh);
  root.animations = [clip];

  return { root, clip };
}

export function createThreeSkinnedMorphFixture() {
  const { root } = createThreeSkinnedFixture();
  root.name = "ThreeSkinnedMorphScene";

  const mesh = root.getObjectByName("ThreeSkinnedMesh");
  mesh.name = "ThreeSkinnedMorphMesh";
  mesh.geometry.morphAttributes.position = [
    new Float32BufferAttribute([
      -0.5, 0, 0,
      0.5, 0, 0,
      0.58, 2.15, 0.2,
      -0.58, 2.15, 0.2
    ], 3)
  ];
  mesh.geometry.morphAttributes.position[0].name = "ChestLift";
  mesh.geometry.morphAttributes.normal = [
    new Float32BufferAttribute([
      0, 0, 1,
      0, 0, 1,
      0, 0.1, 1,
      0, 0.1, 1
    ], 3)
  ];
  mesh.geometry.morphAttributes.normal[0].name = "ChestLift";
  mesh.updateMorphTargets();
  mesh.morphTargetInfluences[0] = 0.2;

  const identity = new Quaternion().toArray();
  const bend = new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 5)).toArray();
  const clip = new AnimationClip("ThreeCharacterPerformance", 1, [
    new QuaternionKeyframeTrack("Armature.bones[Spine].quaternion", [0, 0.5, 1], [
      ...identity,
      ...bend,
      ...identity
    ]),
    new NumberKeyframeTrack("ThreeSkinnedMorphMesh.morphTargetInfluences[ChestLift]", [0, 0.5, 1], [
      0.2,
      1,
      0.2
    ]),
    new VectorKeyframeTrack("ThreeSkinnedMorphMesh.material.map.offset", [0, 1], [
      0, 0,
      0.25, 0.125
    ])
  ]);
  root.animations = [clip];

  return { root, clip };
}
