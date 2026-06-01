import { animationsFromThreeClips } from "./three-animation-adapter.js";
import { geometryToSceneGeometry } from "./three-geometry-adapter.js";
import {
  geometryWithInstanceColor,
  instancedMeshInstances,
  isThreeInstancedMesh
} from "./three-instancing-adapter.js";
import {
  lightAnimationParameters,
  lightToSceneLight
} from "./three-light-adapter.js";
import { isThreeLine, lineToSceneGeometry } from "./three-line-adapter.js";
import { materialToSceneMaterial } from "./three-material-adapter.js";
import { isThreePoints, pointsToSceneGeometry } from "./three-points-adapter.js";
import { skinFromThreeSkinnedMesh } from "./three-skinning-adapter.js";
import { isThreeSprite, spriteToSceneGeometry } from "./three-sprite-adapter.js";
import { collectMaterialTextureAnimationEntries } from "./three-material-texture-animation-entries.js";
import { objectAnimationClipEntries } from "./three-object-animation-clips.js";
import {
  animationRootTargets,
  materialTextureAnimationRootTargets
} from "./three-animation-root-targets.js";
import { animationEntryForRootTargets } from "./three-animation-root-entries.js";
import { trackTargetAliasesFor } from "./three-animation-target-aliases.js";
import { threeAnimationTargetName } from "./three-animation-target-name.js";
import { threeModelCustomProperties } from "./three-model-custom-properties.js";
import { shaderUniformArraysByMaterial } from "./three-shader-uniform-adapter.js";
import {
  objectRotationOrderName,
  objectTransform,
  objectVisibility
} from "./three-transform-adapter.js";
import { THREE_MATERIAL_TEXTURE_FIELDS } from "./three-material-texture-fields.js";
import { threeTextureName } from "./three-texture-source.js";
import { threeTextureLayerTargets } from "./three-texture-layer-targets.js";

function isBufferGeometry(geometry) {
  return Boolean(geometry?.attributes?.position || geometry?.getAttribute?.("position"));
}

function collectObjects(root) {
  const objects = [];
  if (typeof root.traverse === "function") {
    root.traverse((object) => objects.push(object));
    return objects;
  }

  const visit = (object) => {
    objects.push(object);
    for (const child of object.children || []) {
      visit(child);
    }
  };
  visit(root);
  return objects;
}

function targetNamesFor(nodes, meshes, cameras, lights) {
  const names = new Set([
    ...nodes.map((node) => node.name),
    ...meshes.map((mesh) => mesh.name),
    ...cameras.map((camera) => camera.name),
    ...lights.map((light) => light.name),
    ...meshes.flatMap((mesh) => mesh.materials.flatMap((material) => [material.animationName, material.name].filter(Boolean))),
    ...meshes.flatMap((mesh) => mesh.materials.flatMap((material) => {
      const directTextures = THREE_MATERIAL_TEXTURE_FIELDS
        .map(([, field]) => material[field]?.animationName || material[field]?.name)
        .filter(Boolean);
      const customTextures = (material.textures || [])
        .map((texture) => texture.animationName || texture.name || texture.texture?.animationName || texture.texture?.name)
        .filter(Boolean);
      return [...directTextures, ...customTextures];
    }))
  ]);
  for (const mesh of meshes) {
    for (const bone of mesh.skin?.bones || []) {
      names.add(bone.name);
    }
  }
  return names;
}

function cameraToSceneCamera(object) {
  const orthoZoom = object.isOrthographicCamera
    ? Math.abs((object.top ?? 1) - (object.bottom ?? -1)) / (object.zoom || 1)
    : null;
  return {
    name: object.name || "Camera",
    parent: null,
    transform: objectTransform(object),
    projection: object.isOrthographicCamera ? "orthographic" : "perspective",
    fov: object.fov ?? 45,
    focalLength: typeof object.getFocalLength === "function" ? object.getFocalLength() : object.focalLength ?? 35,
    orthoZoom,
    near: object.near ?? 0.1,
    far: object.far ?? 1000,
    aspectWidth: object.aspect ?? 1,
    aspectHeight: 1
  };
}

function cameraAnimationParameters(object) {
  return {
    filmHeight: typeof object.getFilmHeight === "function"
      ? object.getFilmHeight()
      : (object.filmGauge || 35) / Math.max(object.aspect || 1, 1),
    focalLength: typeof object.getFocalLength === "function" ? object.getFocalLength() : object.focalLength ?? 35,
    focusDistance: object.focusDistance ?? object.dof?.focusDistance ?? null,
    orthographicHeight: object.isOrthographicCamera ? Math.abs((object.top ?? 1) - (object.bottom ?? -1)) : null
  };
}

function isDefaultTransform(transform) {
  return transform.translation.every((value) => value === 0) &&
    transform.rotation.every((value) => value === 0) &&
    transform.scale.every((value) => value === 1);
}

function isSceneRootSkipped(object, root) {
  return object === root && object.type === "Scene" && isDefaultTransform(objectTransform(object));
}

function objectKind(object) {
  if (isThreeLine(object)) {
    return "mesh";
  }
  if (isThreePoints(object)) {
    return "mesh";
  }
  if (isThreeSprite(object)) {
    return "mesh";
  }
  if (isThreeInstancedMesh(object)) {
    return "node";
  }
  if (isBufferGeometry(object.geometry)) {
    return "mesh";
  }
  if (object.isCamera || /Camera$/.test(object.type || "")) {
    return "camera";
  }
  if (object.isLight || /Light$/.test(object.type || "")) {
    return "light";
  }
  return "node";
}

function collectSkeletonBoneObjects(objects) {
  const bones = new Set();
  for (const object of objects) {
    if (!object.isSkinnedMesh && !/SkinnedMesh$/.test(object.type || "")) {
      continue;
    }
    for (const bone of object.skeleton?.bones || []) {
      bones.add(bone);
    }
  }
  return bones;
}

function fallbackBoneName(index) {
  return `Bone_${index + 1}`;
}

function collectSkeletonBoneExportNames(objects, usedNames = new Set()) {
  const names = new Map();
  for (const object of objects) {
    if (!object.isSkinnedMesh && !/SkinnedMesh$/.test(object.type || "")) {
      continue;
    }
    for (const [index, bone] of (object.skeleton?.bones || []).entries()) {
      if (names.has(bone)) {
        continue;
      }
      names.set(bone, uniqueExportName(bone.name || fallbackBoneName(index), usedNames));
    }
  }
  return names;
}

function collectExportNames(objects, root, options = {}, skippedObjects = new Set()) {
  const counts = { node: 0, camera: 0, light: 0, mesh: 0 };
  const names = new Map();
  const used = new Set();
  for (const object of objects) {
    if (skippedObjects.has(object) || isSceneRootSkipped(object, root)) {
      continue;
    }
    const kind = objectKind(object);
    counts[kind] += 1;
    const fallback = kind === "mesh"
      ? options.defaultMeshName && counts.mesh === 1 ? options.defaultMeshName : `Mesh_${counts.mesh}`
      : `${kind[0].toUpperCase()}${kind.slice(1)}_${counts[kind]}`;
    names.set(object, uniqueExportName(object.name || fallback, used));
  }
  return names;
}

function uniqueExportName(baseName, used) {
  let name = String(baseName || "Object");
  if (!used.has(name)) {
    used.add(name);
    return name;
  }

  let index = 2;
  while (used.has(`${name}_${index}`)) {
    index += 1;
  }
  name = `${name}_${index}`;
  used.add(name);
  return name;
}

function objectQuaternion(object) {
  return [
    object.quaternion?.x ?? 0,
    object.quaternion?.y ?? 0,
    object.quaternion?.z ?? 0,
    object.quaternion?.w ?? 1
  ];
}

function collectAnimationEntries(root, objects, exportNameByObject, skeletonBoneNameByObject, options = {}, rootTargetOptions = {}) {
  const optionClips = options.animations;
  const fallbackRoot = exportNameByObject.get(root) || null;
  if (optionClips) {
    return optionClips.flatMap((entry) => {
      if (!entry?.clip) {
        return {
          clip: entry,
          rootTrackTarget: fallbackRoot
        };
      }
      const explicitRoot = entry.rootTrackTarget ?? entry.rootTarget ?? entry.rootObject ?? entry.targetObject;
      const rootTargets = animationRootTargets(explicitRoot, {
        exportNameByObject,
        skeletonBoneNameByObject,
        materialTextureRootTargets: rootTargetOptions.materialTextureRootTargets
      });
      const animationEntry = animationEntryForRootTargets(
        entry.clip,
        rootTargets.length ? rootTargets : [entry.rootTrackTarget || fallbackRoot]
      );
      return animationEntry
        ? [{ ...entry, ...animationEntry }]
        : [{ ...entry, rootTrackTarget: entry.rootTrackTarget || fallbackRoot || null }];
    });
  }
  const animationOwners = new Set([...objects, ...skeletonBoneNameByObject.keys()]);
  return Array.from(animationOwners).flatMap((object) => objectAnimationClipEntries(
    object,
    exportNameByObject.get(object) || skeletonBoneNameByObject.get(object) || null
  ));
}

function sourceTextureTargetName(texture) {
  if (!texture) {
    return "";
  }
  return threeAnimationTargetName(texture) || threeTextureName(texture);
}

function sceneTextureTargetName(texture) {
  return texture?.animationName || texture?.name || "";
}

function sceneMaterialTextureRecords(sceneMaterial) {
  const direct = THREE_MATERIAL_TEXTURE_FIELDS
    .map(([, field]) => sceneMaterial[field])
    .filter(Boolean);
  const custom = (sceneMaterial.textures || [])
    .map((texture) => texture.texture || texture)
    .filter(Boolean);
  return [...direct, ...custom];
}

function materialTargetName(sceneMaterial) {
  return sceneMaterial?.animationName || sceneMaterial?.name || "";
}

function materialTextureTargetName(sourceMaterial, sceneMaterial, threeField, sceneField) {
  const sourceTexture = sourceMaterial?.[threeField] ?? sourceMaterial?.userData?.[threeField];
  const sourceTarget = sourceTexture ? sourceTextureTargetName(sourceTexture) : "";
  const directTarget = sceneTextureTargetName(sceneMaterial[sceneField]);
  if (!sourceTarget) {
    return directTarget;
  }
  if (
    sceneMaterial[sceneField]?.animationName === sourceTarget ||
    sceneMaterial[sceneField]?.name === sourceTarget
  ) {
    return directTarget || sourceTarget;
  }
  const record = sceneMaterialTextureRecords(sceneMaterial).find((texture) => {
    return texture.animationName === sourceTarget || texture.name === sourceTarget;
  });
  return sceneTextureTargetName(record) || directTarget || sourceTarget;
}

function materialTextureTargetNames(sourceMaterial, sceneMaterial) {
  const directTargets = Object.fromEntries(THREE_MATERIAL_TEXTURE_FIELDS
    .map(([threeField, sceneField]) => {
      return [threeField, materialTextureTargetName(sourceMaterial, sceneMaterial, threeField, sceneField)];
    })
    .filter(([, textureName]) => Boolean(textureName)));
  const shaderUniformTargets = Object.fromEntries((sceneMaterial.textures || [])
    .filter((texture) => texture.sourceTextureField)
    .map((texture) => [texture.sourceTextureField, sceneTextureTargetName(texture)])
    .filter(([, textureName]) => Boolean(textureName)));
  return {
    ...directTargets,
    ...shaderUniformTargets
  };
}

export function isThreeObjectLike(value) {
  return Boolean(value?.isObject3D || value?.type || value?.traverse || value?.children || isBufferGeometry(value?.geometry));
}

export function fromThreeObject(root, options = {}) {
  const meshes = [];
  const nodes = [];
  const cameras = [];
  const lights = [];
  const cameraParametersByName = new Map();
  const lightParametersByName = new Map();
  const rotationOrdersByName = new Map();
  const quaternionsByName = new Map();
  const sourceMaterialsByMesh = new Map();
  const objects = collectObjects(root);
  const skeletonBoneObjects = collectSkeletonBoneObjects(objects);
  const exportNameByObject = collectExportNames(objects, root, options, skeletonBoneObjects);
  const skeletonBoneNameByObject = collectSkeletonBoneExportNames(objects, new Set(exportNameByObject.values()));
  const emittedMeshNames = new Set([
    ...exportNameByObject.values(),
    ...skeletonBoneNameByObject.values()
  ]);

  function exportedParentName(object) {
    let parent = object.parent;
    while (parent && !exportNameByObject.has(parent)) {
      parent = parent.parent;
    }
    return exportNameByObject.get(parent) || null;
  }

  for (const object of objects) {
    if (isBufferGeometry(object.geometry) && !isThreeInstancedMesh(object)) {
      continue;
    }
    const transform = objectTransform(object);
    if (!exportNameByObject.has(object)) {
      continue;
    }
    const name = exportNameByObject.get(object);
    rotationOrdersByName.set(name, objectRotationOrderName(object));
    quaternionsByName.set(name, objectQuaternion(object));
    if (object.isCamera || /Camera$/.test(object.type || "")) {
      cameraParametersByName.set(name, cameraAnimationParameters(object));
      cameras.push({
        ...cameraToSceneCamera(object),
        name,
        parent: exportedParentName(object),
        transform,
        visibility: objectVisibility(object),
        customProperties: threeModelCustomProperties(object)
      });
    } else if (object.isLight || /Light$/.test(object.type || "")) {
      lightParametersByName.set(name, lightAnimationParameters(object));
      lights.push({
        ...lightToSceneLight(object),
        name,
        parent: exportedParentName(object),
        transform,
        visibility: objectVisibility(object),
        customProperties: threeModelCustomProperties(object)
      });
    } else {
      nodes.push({
        name,
        parent: exportedParentName(object),
        transform,
        visibility: objectVisibility(object),
        customProperties: threeModelCustomProperties(object)
      });
    }
  }

  for (const object of objects) {
    if (!isBufferGeometry(object.geometry)) {
      continue;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material].filter(Boolean);
    const sceneMaterials = materials.map(materialToSceneMaterial);
    const name = exportNameByObject.get(object);
    if (isThreeInstancedMesh(object)) {
      for (const instance of instancedMeshInstances(object, name, {
        rotationOrder: objectRotationOrderName(object),
        makeName: (candidate) => uniqueExportName(candidate, emittedMeshNames)
      })) {
        sourceMaterialsByMesh.set(instance.name, materials);
        rotationOrdersByName.set(instance.name, objectRotationOrderName(object));
        quaternionsByName.set(instance.name, [0, 0, 0, 1]);
        meshes.push({
          name: instance.name,
          parent: name,
          transform: instance.transform,
          visibility: objectVisibility(object),
          customProperties: threeModelCustomProperties(object),
          materials: sceneMaterials,
          geometry: geometryWithInstanceColor(geometryToSceneGeometry(object.geometry, {
            drawMode: object.drawMode,
            morphTargetDictionary: object.morphTargetDictionary,
            morphTargetInfluences: instance.morphTargetInfluences || object.morphTargetInfluences
          }), instance.color),
          skin: null
        });
      }
      continue;
    }
    sourceMaterialsByMesh.set(name, materials);
    rotationOrdersByName.set(name, objectRotationOrderName(object));
    quaternionsByName.set(name, objectQuaternion(object));
    meshes.push({
      name,
      parent: exportedParentName(object),
      transform: objectTransform(object),
      visibility: objectVisibility(object),
      customProperties: threeModelCustomProperties(object),
      materials: sceneMaterials,
      geometry: isThreeLine(object) ? lineToSceneGeometry(object) : isThreePoints(object) ? pointsToSceneGeometry(object) : isThreeSprite(object) ? spriteToSceneGeometry(object) : geometryToSceneGeometry(object.geometry, {
        drawMode: object.drawMode,
        morphTargetDictionary: object.morphTargetDictionary,
        morphTargetInfluences: object.morphTargetInfluences
      }),
      skin: skinFromThreeSkinnedMesh(object, { boneNames: skeletonBoneNameByObject })
    });
  }

  for (const [bone, name] of skeletonBoneNameByObject) {
    rotationOrdersByName.set(name, objectRotationOrderName(bone));
    quaternionsByName.set(name, objectQuaternion(bone));
  }
  const materialNamesByMesh = new Map(meshes.map((mesh) => [
    mesh.name,
    mesh.materials.map(materialTargetName)
  ]));
  const lightNames = new Set(lights.map((light) => light.name));
  const textureNamesByMesh = new Map(meshes.map((mesh) => [
    mesh.name,
    mesh.materials.map((material, materialIndex) => materialTextureTargetNames(
      sourceMaterialsByMesh.get(mesh.name)?.[materialIndex],
      material
    ))
  ]));
  const materialTargetNames = new Set(
    Array.from(materialNamesByMesh.values()).flat()
  );
  const textureTargetNames = new Set(
    Array.from(textureNamesByMesh.values()).flatMap((materials) => materials.flatMap((textures) => Object.values(textures)))
  );
  const textureLayerTargets = threeTextureLayerTargets(meshes, textureNamesByMesh);
  const shaderUniformArrays = shaderUniformArraysByMaterial(meshes, sourceMaterialsByMesh, materialNamesByMesh);
  const materialTextureRootTargets = materialTextureAnimationRootTargets(
    sourceMaterialsByMesh,
    materialNamesByMesh,
    textureNamesByMesh
  );
  const clips = [
    ...collectAnimationEntries(root, objects, exportNameByObject, skeletonBoneNameByObject, options, {
      materialTextureRootTargets
    }),
    ...collectMaterialTextureAnimationEntries(meshes, sourceMaterialsByMesh, materialNamesByMesh, textureNamesByMesh)
  ];
  const morphTargetsByMesh = new Map(meshes.map((mesh) => [
    mesh.name,
    mesh.geometry.morphTargets.map((target) => target.name)
  ]));

  return {
    name: root.name || options.sceneName || "ThreeScene",
    frameRate: options.frameRate || root.frameRate || root.userData?.frameRate || 30,
    nodes,
    cameras,
    lights,
    meshes,
    animations: animationsFromThreeClips(clips, targetNamesFor(nodes, meshes, cameras, lights), {
      ...options,
      cameraParametersByName,
      lightParametersByName,
      lightNames,
      materialNamesByMesh,
      materialTargetNames,
      textureNamesByMesh,
      textureTargetNames,
      textureLayerNamesByMesh: textureLayerTargets.byMesh,
      textureLayerNamesByTexture: textureLayerTargets.byTexture,
      shaderUniformArraysByMaterial: shaderUniformArrays,
      morphTargetsByMesh,
      rotationOrdersByName,
      quaternionsByName,
      trackTargetAliases: trackTargetAliasesFor({
        objects,
        exportNameByObject,
        meshes,
        sourceMaterialsByMesh,
        materialNamesByMesh,
        textureNamesByMesh
      }),
      rootTrackTarget: exportNameByObject.get(root) || null
    })
  };
}
