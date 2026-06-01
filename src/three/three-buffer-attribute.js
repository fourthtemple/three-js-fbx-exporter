function attributeArray(attribute) {
  return attribute?.array || attribute?.data?.array || null;
}

function getterName(component) {
  return ["getX", "getY", "getZ", "getW"][component] || null;
}

function rawArrayIndex(attribute, index, component) {
  if (attribute?.data?.stride != null) {
    return index * attribute.data.stride + (attribute.offset || 0) + component;
  }
  return index * (attribute?.itemSize || 1) + component;
}

export function rawAttributeComponent(attribute, index, component, fallback = 0) {
  if (!attribute) {
    return fallback;
  }
  const array = attributeArray(attribute);
  if (array && !attribute.isFloat16BufferAttribute) {
    return array[rawArrayIndex(attribute, index, component)] ?? fallback;
  }
  const getter = getterName(component);
  if (getter && typeof attribute[getter] === "function") {
    return attribute[getter](index);
  }
  return fallback;
}

export function attributeComponent(attribute, index, component, fallback = 0) {
  const value = rawAttributeComponent(attribute, index, component, fallback);
  const array = attributeArray(attribute);
  if (!attribute?.normalized || !array || attribute.isFloat16BufferAttribute) {
    return value;
  }
  if (array instanceof Uint8Array || array instanceof Uint8ClampedArray) {
    return value / 255;
  }
  if (array instanceof Uint16Array) {
    return value / 65535;
  }
  if (array instanceof Uint32Array) {
    return value / 4294967295;
  }
  if (array instanceof Int8Array) {
    return Math.max(value / 127, -1);
  }
  if (array instanceof Int16Array) {
    return Math.max(value / 32767, -1);
  }
  if (array instanceof Int32Array) {
    return Math.max(value / 2147483647, -1);
  }
  return value;
}

export function attributeCount(attribute, fallbackItemSize = 1) {
  if (!attribute) {
    return 0;
  }
  if (Number.isFinite(attribute.count)) {
    return attribute.count;
  }
  const itemSize = attribute.itemSize || fallbackItemSize;
  const array = attributeArray(attribute);
  return Math.floor((array?.length || 0) / itemSize);
}
