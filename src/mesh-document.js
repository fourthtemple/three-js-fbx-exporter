import { FbxNode } from "./binary-writer.js";
import {
  addBoolProperty,
  addDoubleProperty,
  addProperties70,
  addStringProperty,
  addVectorProperty,
  fbxName,
  float64Array,
  int32Array,
  int64
} from "./fbx-values.js";
import { addModelTransformProperties } from "./model-document.js";
import {
  materialClippingPlaneConstantProperty,
  materialClippingPlaneNormalProperty
} from "./material-clipping.js";
import {
  buildTexture,
  buildTextureConnections,
  buildVideo,
  countTextureObjects
} from "./texture-document.js";
import {
  buildTextureLayer,
  buildTextureLayerConnections,
  countTextureLayerObjects,
  createTextureLayerRecords
} from "./texture-layer-document.js";

const GEOMETRY_VERSION = 124;
const MODEL_VERSION = 232;
const MATERIAL_VERSION = 102;
const LAYER_VERSION = 100;

function polygonVertexIndex(faces) {
  const indices = [];
  for (const face of faces) {
    for (let index = 0; index < face.length; index += 1) {
      const vertexIndex = face[index];
      indices.push(index === face.length - 1 ? -vertexIndex - 1 : vertexIndex);
    }
  }
  return indices;
}

function polygonMaterialMapping(geometry, materialCount) {
  if (materialCount <= 1 || geometry.materialIndices.every((index) => index === geometry.materialIndices[0])) {
    return {
      mapping: "AllSame",
      indices: [Math.min(geometry.materialIndices[0] ?? 0, Math.max(0, materialCount - 1))]
    };
  }
  return {
    mapping: "ByPolygon",
    indices: geometry.materialIndices.map((index) => Math.min(index, Math.max(0, materialCount - 1)))
  };
}

function bounds(vertices) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let offset = 0; offset < vertices.length; offset += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = vertices[offset + axis];
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
  }
  return { min, max };
}

function cornerIndices(faces) {
  const count = faces.reduce((sum, face) => sum + face.length, 0);
  return Array.from({ length: count }, (_, index) => index);
}

function buildDirectVectorLayer(node, { elementName, dataName, index = 0, name = "", values }) {
  const layer = node.add(elementName, [index]);
  layer.add("Version", [101]);
  layer.add("Name", [name]);
  layer.add("MappingInformationType", ["ByPolygonVertex"]);
  layer.add("ReferenceInformationType", ["Direct"]);
  layer.add(dataName, [float64Array(values)]);
}

function addLayerElement(layer, type, typedIndex = 0) {
  const element = layer.add("LayerElement");
  element.add("Type", [type]);
  element.add("TypedIndex", [typedIndex]);
}

function buildGeometry(mesh, ids) {
  const geometry = mesh.geometry;
  const node = new FbxNode("Geometry", [int64(ids.geometry), fbxName("Geometry", `${mesh.name}Geometry`), "Mesh"]);
  node.add("GeometryVersion", [GEOMETRY_VERSION]);

  const propertyNode = addProperties70(node);
  const box = bounds(geometry.vertices);
  addVectorProperty(propertyNode, "Color", "ColorRGB", [0.8, 0.8, 0.8]);
  addVectorProperty(propertyNode, "BBoxMin", "Vector3D", box.min);
  addVectorProperty(propertyNode, "BBoxMax", "Vector3D", box.max);
  addBoolProperty(propertyNode, "Primary Visibility", true);
  addBoolProperty(propertyNode, "Casts Shadows", true);
  addBoolProperty(propertyNode, "Receive Shadows", true);

  node.add("Vertices", [float64Array(geometry.vertices)]);
  node.add("PolygonVertexIndex", [int32Array(polygonVertexIndex(geometry.faces))]);

  if (geometry.colors?.length) {
    const colors = node.add("LayerElementColor", [0]);
    colors.add("Version", [101]);
    colors.add("Name", ["Color"]);
    colors.add("MappingInformationType", ["ByPolygonVertex"]);
    colors.add("ReferenceInformationType", ["IndexToDirect"]);
    colors.add("Colors", [float64Array(geometry.colors)]);
    colors.add("ColorIndex", [int32Array(cornerIndices(geometry.faces))]);
  }

  const uvSets = geometry.uvSets?.length
    ? geometry.uvSets
    : [{ name: "UVMap", uvs: geometry.uvs }];

  buildDirectVectorLayer(node, {
    elementName: "LayerElementNormal",
    dataName: "Normals",
    values: geometry.normals
  });

  if (geometry.binormals?.length) {
    buildDirectVectorLayer(node, {
      elementName: "LayerElementBinormal",
      dataName: "Binormals",
      name: uvSets[0]?.name || "UVMap",
      values: geometry.binormals
    });
  }

  if (geometry.tangents?.length) {
    buildDirectVectorLayer(node, {
      elementName: "LayerElementTangent",
      dataName: "Tangents",
      name: uvSets[0]?.name || "UVMap",
      values: geometry.tangents
    });
  }

  uvSets.forEach((uvSet, index) => {
    const uvs = node.add("LayerElementUV", [index]);
    uvs.add("Version", [101]);
    uvs.add("Name", [uvSet.name || (index === 0 ? "UVMap" : `UVMap_${index}`)]);
    uvs.add("MappingInformationType", ["ByPolygonVertex"]);
    uvs.add("ReferenceInformationType", ["IndexToDirect"]);
    uvs.add("UV", [float64Array(uvSet.uvs)]);
    uvs.add("UVIndex", [int32Array(cornerIndices(geometry.faces))]);
  });

  const materialMapping = polygonMaterialMapping(geometry, mesh.materials.length);
  const materials = node.add("LayerElementMaterial", [0]);
  materials.add("Version", [101]);
  materials.add("Name", [""]);
  materials.add("MappingInformationType", [materialMapping.mapping]);
  materials.add("ReferenceInformationType", ["IndexToDirect"]);
  materials.add("Materials", [int32Array(materialMapping.indices)]);

  const layer = node.add("Layer", [0]);
  layer.add("Version", [LAYER_VERSION]);
  if (geometry.colors?.length) {
    addLayerElement(layer, "LayerElementColor");
  }
  addLayerElement(layer, "LayerElementNormal");
  if (geometry.binormals?.length) {
    addLayerElement(layer, "LayerElementBinormal");
  }
  if (geometry.tangents?.length) {
    addLayerElement(layer, "LayerElementTangent");
  }
  addLayerElement(layer, "LayerElementUV");
  addLayerElement(layer, "LayerElementMaterial");

  for (let index = 1; index < uvSets.length; index += 1) {
    const uvOnlyLayer = node.add("Layer", [index]);
    uvOnlyLayer.add("Version", [LAYER_VERSION]);
    addLayerElement(uvOnlyLayer, "LayerElementUV", index);
  }

  return node;
}

function buildModel(mesh, ids) {
  const node = new FbxNode("Model", [int64(ids.model), fbxName("Model", mesh.name), "Mesh"]);
  node.add("Version", [MODEL_VERSION]);
  const properties = addProperties70(node);
  addModelTransformProperties(properties, mesh.transform, {
    visibility: mesh.visibility,
    customProperties: mesh.customProperties
  });
  node.add("Shading", ["Y"]);
  node.add("Culling", ["CullingOff"]);
  return node;
}

function buildMaterial(material, id) {
  const node = new FbxNode("Material", [int64(id), fbxName("Material", material.name), ""]);
  const shadingModel = material.shadingModel || "Phong";
  const isPhong = shadingModel === "Phong";
  node.add("Version", [MATERIAL_VERSION]);
  node.add("ShadingModel", [shadingModel]);
  node.add("MultiLayer", [false]);
  const properties = addProperties70(node);
  properties.add("P", ["ShadingModel", "KString", "", "", shadingModel]);
  addBoolProperty(properties, "MultiLayer", false);
  addVectorProperty(properties, "EmissiveColor", "Color", material.emissiveColor);
  addDoubleProperty(properties, "EmissiveFactor", "Number", material.emissiveFactor);
  addVectorProperty(properties, "AmbientColor", "Color", material.ambientColor);
  addDoubleProperty(properties, "AmbientFactor", "Number", material.ambientFactor);
  addVectorProperty(properties, "DiffuseColor", "Color", material.diffuseColor);
  addDoubleProperty(properties, "DiffuseFactor", "Number", material.diffuseFactor);
  addDoubleProperty(properties, "BumpFactor", "Number", material.bumpFactor);
  addDoubleProperty(properties, "DisplacementFactor", "Number", material.displacementFactor);
  addVectorProperty(properties, "VectorDisplacementColor", "Color", [0, 0, 0]);
  addDoubleProperty(properties, "VectorDisplacementFactor", "Number", material.vectorDisplacementFactor);
  addVectorProperty(properties, "TransparentColor", "Color", material.transparentColor);
  addDoubleProperty(properties, "TransparencyFactor", "Number", material.transparencyFactor);
  addDoubleProperty(properties, "Opacity", "Number", material.opacity);
  addVectorProperty(properties, "Maya|blend_color", "Color", material.blendColor);
  if (isPhong) {
    addVectorProperty(properties, "SpecularColor", "Color", material.specularColor);
    addDoubleProperty(properties, "SpecularFactor", "Number", material.specularFactor);
    addDoubleProperty(properties, "Shininess", "Number", material.shininess);
    addDoubleProperty(properties, "ShininessExponent", "Number", material.shininess);
    addVectorProperty(properties, "ReflectionColor", "Color", [1, 1, 1]);
    addDoubleProperty(properties, "ReflectionFactor", "Number", material.reflectionFactor);
  }
  addDoubleProperty(properties, "Maya|anisotropy", "Number", material.anisotropy);
  addDoubleProperty(properties, "Maya|anisotropy_rotation", "Number", material.anisotropyRotation);
  addDoubleProperty(properties, "Maya|iridescence", "Number", material.iridescence);
  addDoubleProperty(properties, "Maya|iridescence_ior", "Number", material.iridescenceIOR);
  addDoubleProperty(properties, "Maya|iridescence_thickness_minimum", "Number", material.iridescenceThicknessMinimum);
  addDoubleProperty(properties, "Maya|iridescence_thickness_maximum", "Number", material.iridescenceThicknessMaximum);
  addDoubleProperty(properties, "Maya|thickness", "Number", material.thickness);
  addVectorProperty(properties, "Maya|attenuation_color", "Color", material.attenuationColor);
  addDoubleProperty(properties, "Maya|attenuation_distance", "Number", material.attenuationDistance);
  addDoubleProperty(properties, "Maya|ior", "Number", material.ior);
  addDoubleProperty(properties, "Maya|dispersion", "Number", material.dispersion);
  addDoubleProperty(properties, "Maya|ao_map_intensity", "Number", material.aoMapIntensity);
  addDoubleProperty(properties, "Maya|displacement_bias", "Number", material.displacementBias);
  addDoubleProperty(properties, "Maya|alpha_test", "Number", material.alphaTest);
  addDoubleProperty(properties, "Maya|normal_map_type", "Number", material.normalMapType);
  addDoubleProperty(properties, "Maya|side", "Number", material.side);
  addDoubleProperty(properties, "Maya|blending", "Number", material.blending);
  addDoubleProperty(properties, "Maya|blend_src", "Number", material.blendSrc);
  addDoubleProperty(properties, "Maya|blend_dst", "Number", material.blendDst);
  addDoubleProperty(properties, "Maya|blend_equation", "Number", material.blendEquation);
  addDoubleProperty(properties, "Maya|blend_src_alpha", "Number", material.blendSrcAlpha);
  addDoubleProperty(properties, "Maya|blend_dst_alpha", "Number", material.blendDstAlpha);
  addDoubleProperty(properties, "Maya|blend_equation_alpha", "Number", material.blendEquationAlpha);
  addDoubleProperty(properties, "Maya|blend_alpha", "Number", material.blendAlpha);
  addDoubleProperty(properties, "Maya|depth_func", "Number", material.depthFunc);
  addDoubleProperty(properties, "Maya|depth_test", "Number", material.depthTest);
  addDoubleProperty(properties, "Maya|depth_write", "Number", material.depthWrite);
  addDoubleProperty(properties, "Maya|color_write", "Number", material.colorWrite);
  addDoubleProperty(properties, "Maya|vertex_colors", "Number", material.vertexColors);
  addDoubleProperty(properties, "Maya|fog", "Number", material.fog);
  addDoubleProperty(properties, "Maya|material_visible", "Number", material.materialVisible);
  addDoubleProperty(properties, "Maya|allow_override", "Number", material.allowOverride);
  addDoubleProperty(properties, "Maya|shadow_side", "Number", material.shadowSide);
  addDoubleProperty(properties, "Maya|polygon_offset", "Number", material.polygonOffset);
  addDoubleProperty(properties, "Maya|polygon_offset_factor", "Number", material.polygonOffsetFactor);
  addDoubleProperty(properties, "Maya|polygon_offset_units", "Number", material.polygonOffsetUnits);
  addDoubleProperty(properties, "Maya|stencil_write", "Number", material.stencilWrite);
  addDoubleProperty(properties, "Maya|stencil_write_mask", "Number", material.stencilWriteMask);
  addDoubleProperty(properties, "Maya|stencil_func", "Number", material.stencilFunc);
  addDoubleProperty(properties, "Maya|stencil_ref", "Number", material.stencilRef);
  addDoubleProperty(properties, "Maya|stencil_func_mask", "Number", material.stencilFuncMask);
  addDoubleProperty(properties, "Maya|stencil_fail", "Number", material.stencilFail);
  addDoubleProperty(properties, "Maya|stencil_z_fail", "Number", material.stencilZFail);
  addDoubleProperty(properties, "Maya|stencil_z_pass", "Number", material.stencilZPass);
  addDoubleProperty(properties, "Maya|clip_intersection", "Number", material.clipIntersection);
  addDoubleProperty(properties, "Maya|clip_shadows", "Number", material.clipShadows);
  addDoubleProperty(properties, "Maya|clipping_plane_count", "Number", material.clippingPlaneCount);
  addDoubleProperty(properties, "Maya|alpha_hash", "Number", material.alphaHash);
  addDoubleProperty(properties, "Maya|alpha_to_coverage", "Number", material.alphaToCoverage);
  addDoubleProperty(properties, "Maya|premultiplied_alpha", "Number", material.premultipliedAlpha);
  addDoubleProperty(properties, "Maya|force_single_pass", "Number", material.forceSinglePass);
  addDoubleProperty(properties, "Maya|tone_mapped", "Number", material.toneMapped);
  addDoubleProperty(properties, "Maya|dithering", "Number", material.dithering);
  addDoubleProperty(properties, "Maya|wireframe", "Number", material.wireframe);
  addDoubleProperty(properties, "Maya|wireframe_linewidth", "Number", material.wireframeLinewidth);
  (material.clippingPlanes || []).forEach((plane, index) => {
    addVectorProperty(properties, materialClippingPlaneNormalProperty(index), "Vector3D", plane.normal);
    addDoubleProperty(properties, materialClippingPlaneConstantProperty(index), "Number", plane.constant);
  });
  for (const property of material.customProperties || []) {
    if (property.kind === "color") {
      addVectorProperty(properties, property.name, "Color", property.value);
    } else if (property.kind === "vector") {
      addVectorProperty(properties, property.name, "Vector3D", property.value);
    } else if (property.kind === "boolean") {
      addBoolProperty(properties, property.name, Boolean(property.value));
    } else if (property.kind === "string") {
      addStringProperty(properties, property.name, property.value);
    } else {
      addDoubleProperty(properties, property.name, "Number", property.value);
    }
  }
  return node;
}

export function createMeshRecords(scene, nextId) {
  return scene.meshes.map((mesh) => ({
    mesh,
    ids: {
      model: nextId(),
      geometry: nextId()
    },
    visibility: mesh.visibility,
    materials: mesh.materials.map((material) => {
      const materialRecord = {
        material,
        animationName: material.animationName,
        id: nextId()
      };
      materialRecord.textures = (material.textures || []).map((texture) => ({
        texture,
        textureId: nextId(),
        videoId: nextId()
      }));
      materialRecord.layers = createTextureLayerRecords(materialRecord, nextId);
      return materialRecord;
    })
  }));
}

export function meshDefinitionCounts(records) {
  return {
    models: records.length,
    geometries: records.length,
    materials: records.reduce((sum, record) => sum + record.materials.length, 0),
    textures: countTextureObjects(records),
    textureLayers: countTextureLayerObjects(records)
  };
}

export function materialTargets(records) {
  return records.flatMap((record) => record.materials);
}

export function textureTargets(records) {
  return records.flatMap((record) => {
    return record.materials.flatMap((materialRecord) => {
      return materialRecord.textures.map((textureRecord) => ({
        name: textureRecord.texture.name,
        animationName: textureRecord.texture.animationName,
        ids: { texture: textureRecord.textureId, video: textureRecord.videoId },
        texture: textureRecord.texture
      }));
    });
  });
}

export function textureLayerTargets(records) {
  return records.flatMap((record) => {
    return record.materials.flatMap((materialRecord) => {
      return (materialRecord.layers || []).map((layer) => ({
        name: layer.name,
        animationName: layer.animationName,
        ids: { textureLayer: layer.id },
        layer
      }));
    });
  });
}

export function meshParentMap(records) {
  return new Map(records.map((record) => [record.mesh.name, record.ids.model]));
}

export function buildMeshObjects(records) {
  const nodes = [];
  for (const record of records) {
    nodes.push(buildGeometry(record.mesh, record.ids));
    nodes.push(buildModel(record.mesh, record.ids));
    for (const materialRecord of record.materials) {
      nodes.push(buildMaterial(materialRecord.material, materialRecord.id));
      for (const textureRecord of materialRecord.textures) {
        nodes.push(buildTexture(record, materialRecord, textureRecord));
        nodes.push(buildVideo(record, materialRecord, textureRecord));
      }
      for (const layerRecord of materialRecord.layers || []) {
        nodes.push(buildTextureLayer(layerRecord));
      }
    }
  }
  return nodes;
}

export function buildMeshConnections(connections, records, rootId, parentModelIds = new Map()) {
  for (const record of records) {
    const parentId = record.mesh.parent ? parentModelIds.get(record.mesh.parent) : rootId;
    if (record.mesh.parent && !parentId) {
      throw new Error(`Mesh parent was not exported: ${record.mesh.parent}`);
    }
    connections.add("C", ["OO", int64(record.ids.model), int64(parentId)]);
    connections.add("C", ["OO", int64(record.ids.geometry), int64(record.ids.model)]);
    for (const materialRecord of record.materials) {
      connections.add("C", ["OO", int64(materialRecord.id), int64(record.ids.model)]);
      buildTextureConnections(connections, record, materialRecord);
      buildTextureLayerConnections(connections, materialRecord);
    }
  }
}
