import {
  customMaterialAnimationProperty,
  customMaterialVectorComponentAnimationProperty
} from "./material-custom-properties.js";
import { nestedTextureSources } from "./texture-source-fields.js";
import { threeColorToFbxColor } from "./three-color-adapter.js";
import { vector } from "./value-normalizers.js";

const TEXTURE_SOURCE_FIELDS = Object.freeze([
  "src",
  "currentSrc",
  "url",
  "href",
  "path",
  "fileName",
  "relativeFileName",
  "relativePath",
  "relativeUrl"
]);
const TEXTURE_PAYLOAD_FIELDS = Object.freeze(["content", "bytes", "data"]);
const UNIFORM_COMPONENTS = Object.freeze({
  0: 0,
  1: 1,
  2: 2,
  r: 0,
  g: 1,
  b: 2,
  x: 0,
  y: 1,
  z: 2
});

function uniformValue(uniform) {
  return uniform && Object.hasOwn(uniform, "value") ? uniform.value : uniform;
}

function shaderUniformEntries(material) {
  return Object.entries(material?.uniforms || {}).flatMap(([name, uniform]) => {
    return shaderUniformValueEntries(name, uniformValue(uniform));
  });
}

function safeUniformName(name) {
  return String(name || "uniform")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "") || "uniform";
}

function hasTextField(source, fields) {
  return fields.some((field) => typeof source?.[field] === "string" && source[field].length);
}

function hasBytesField(source) {
  return TEXTURE_PAYLOAD_FIELDS.some((field) => source?.[field] != null);
}

function hasMimeType(source) {
  const mimeType = source?.mimeType ?? source?.mediaType ?? source?.contentType ?? source?.type;
  return typeof mimeType === "string" && mimeType.includes("/");
}

function hasRawImageShape(source) {
  return hasBytesField(source) && Number(source?.width ?? source?.videoWidth) > 0 && Number(source?.height ?? source?.videoHeight) > 0;
}

function hasTextureSourceHint(source) {
  return Boolean(
    hasTextField(source, TEXTURE_SOURCE_FIELDS) ||
    (hasBytesField(source) && hasMimeType(source)) ||
    hasRawImageShape(source) ||
    typeof source?.toDataURL === "function"
  );
}

function textureUniformSources(value) {
  return [
    value,
    value?.userData,
    ...nestedTextureSources(value)
  ];
}

function isTextureUniformValue(value) {
  return Boolean(
    value?.isTexture ||
    value?.source ||
    value?.image ||
    textureUniformSources(value).some(hasTextureSourceHint)
  );
}

function shaderUniformValueEntries(name, value) {
  if (Array.isArray(value) && value.some(isTextureUniformValue)) {
    return value.flatMap((item, index) => isTextureUniformValue(item)
      ? [{
          name: `${name}[${index}]`,
          fieldName: `${name}_${index}`,
          value: item
        }]
      : []);
  }
  return [{ name, fieldName: name, value }];
}

function isColorUniformValue(value) {
  return Boolean(value?.isColor || (value?.r != null && value?.g != null && value?.b != null));
}

function isVectorUniformValue(value) {
  return Boolean(
    Array.isArray(value) ||
    ArrayBuffer.isView(value) ||
    (value?.x != null && value?.y != null) ||
    (value?.isVector2 || value?.isVector3 || value?.isVector4)
  );
}

function scalarArrayUniformValues(value) {
  const values = Array.isArray(value) || ArrayBuffer.isView(value) ? Array.from(value) : [];
  return values.length > 3 && values.every((item) => scalarUniformValue(item) != null)
    ? values.map(scalarUniformValue)
    : [];
}

function uniformArrayElementKind(value) {
  if (isColorUniformValue(value)) {
    return "color";
  }
  if (isVectorUniformValue(value)) {
    return "vector";
  }
  return scalarUniformValue(value) == null ? null : "scalar";
}

function uniformArrayElementValue(value, kind) {
  if (kind === "color") {
    return threeColorToFbxColor(value);
  }
  if (kind === "vector") {
    return vectorUniformValue(value);
  }
  return scalarUniformValue(value);
}

function objectArrayUniformElements(value) {
  if (!Array.isArray(value) || value.some(isTextureUniformValue)) {
    return [];
  }
  const kinds = value.map(uniformArrayElementKind);
  if (!kinds.length || kinds.some((kind) => !kind) || kinds.every((kind) => kind === "scalar")) {
    return [];
  }
  return value.map((item, index) => ({
    index,
    kind: kinds[index],
    value: uniformArrayElementValue(item, kinds[index])
  }));
}

function shaderUniformArrayElements(value) {
  const scalarValues = scalarArrayUniformValues(value);
  if (scalarValues.length) {
    return scalarValues.map((item, index) => ({ index, kind: "scalar", value: item }));
  }
  return objectArrayUniformElements(value);
}

function vectorUniformValue(value) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    return vector(value, 3, [0, 0, 0]);
  }
  return [
    Number.isFinite(value?.x) ? value.x : 0,
    Number.isFinite(value?.y) ? value.y : 0,
    Number.isFinite(value?.z) ? value.z : 0
  ];
}

function scalarUniformValue(value) {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function shaderUniformFbxProperty(name) {
  return `Maya|shader_uniform_${safeUniformName(name)}`;
}

export function shaderUniformTextureProperty(name) {
  return `Maya|TEX_shader_uniform_${safeUniformName(name)}`;
}

export function shaderUniformTextureField(name) {
  return `shaderUniform:${safeUniformName(name)}`;
}

export function shaderUniformArrayElementFbxProperty(name, index) {
  return shaderUniformFbxProperty(`${name}_${index}`);
}

export function shaderUniformArrayElementAnimationProperty(name, index, kind = "scalar") {
  return customMaterialAnimationProperty(kind, shaderUniformArrayElementFbxProperty(name, index));
}

export function shaderUniformArrayElementsByName(material) {
  return new Map(shaderUniformEntries(material)
    .map((entry) => [
      entry.name,
      new Map(shaderUniformArrayElements(entry.value).map((element) => [element.index, element.kind]))
    ])
    .filter(([, elements]) => elements.size));
}

export function shaderUniformArraysByMaterial(meshes, sourceMaterialsByMesh, materialNamesByMesh) {
  return new Map(meshes.flatMap((mesh) => {
    const sourceMaterials = sourceMaterialsByMesh.get(mesh.name) || [];
    return sourceMaterials.map((material, index) => [
      materialNamesByMesh.get(mesh.name)?.[index],
      shaderUniformArrayElementsByName(material)
    ]).filter(([name, arrays]) => name && arrays.size);
  }));
}

export function shaderUniformTextureRecords(material) {
  return shaderUniformEntries(material)
    .filter((entry) => isTextureUniformValue(entry.value))
    .map((entry) => {
      const fieldName = entry.fieldName || entry.name;
      return {
        uniformName: entry.name,
        field: shaderUniformTextureField(fieldName),
        property: shaderUniformTextureProperty(fieldName),
        label: `ShaderUniform_${safeUniformName(fieldName)}`,
        texture: entry.value
      };
    });
}

export function shaderUniformCustomProperties(material) {
  return shaderUniformEntries(material)
    .filter((entry) => !isTextureUniformValue(entry.value))
    .flatMap((entry) => {
      const arrayElements = shaderUniformArrayElements(entry.value);
      if (arrayElements.length) {
        return arrayElements.map(({ index, kind, value }) => ({
          name: shaderUniformArrayElementFbxProperty(entry.name, index),
          kind,
          value,
          animationProperty: shaderUniformArrayElementAnimationProperty(entry.name, index, kind)
        }));
      }
      const fbxProperty = shaderUniformFbxProperty(entry.name);
      if (isColorUniformValue(entry.value)) {
        return [{
          name: fbxProperty,
          kind: "color",
          value: threeColorToFbxColor(entry.value),
          animationProperty: customMaterialAnimationProperty("color", fbxProperty)
        }];
      }
      if (isVectorUniformValue(entry.value)) {
        return [{
          name: fbxProperty,
          kind: "vector",
          value: vectorUniformValue(entry.value),
          animationProperty: customMaterialAnimationProperty("vector", fbxProperty)
        }];
      }
      const scalar = scalarUniformValue(entry.value);
      return scalar == null ? [] : [{
        name: fbxProperty,
        kind: "scalar",
        value: scalar,
        animationProperty: customMaterialAnimationProperty("scalar", fbxProperty)
      }];
    });
}

export function shaderUniformAnimationProperty(name, valueSize, component = null) {
  const fbxProperty = shaderUniformFbxProperty(name);
  if (component != null) {
    return customMaterialVectorComponentAnimationProperty(fbxProperty, component);
  }
  return customMaterialAnimationProperty(valueSize > 1 ? "vector" : "scalar", fbxProperty);
}

export function parseShaderUniformComponentSuffix(suffix) {
  const match = suffix?.match(/^(?:\.([rgbxyzRGBXYZ])|\[([rgbxyzRGBXYZ012])\])$/);
  if (!match) {
    return null;
  }
  return UNIFORM_COMPONENTS[(match[1] || match[2]).toLowerCase()] ?? null;
}

export function parseShaderUniformArrayIndexSuffix(suffix) {
  const match = suffix?.match(/^\[(\d+)\]$/);
  return match ? Number(match[1]) : null;
}
