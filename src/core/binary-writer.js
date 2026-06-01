const FBX_BINARY_MAGIC = new Uint8Array([
  ...Array.from("Kaydara FBX Binary  ", (char) => char.charCodeAt(0)),
  0x00,
  0x1a,
  0x00
]);

const NULL_RECORD_32_SIZE = 13;
const NULL_RECORD_64_SIZE = 25;

function utf8Bytes(value) {
  return new TextEncoder().encode(String(value));
}

function concatBytes(chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function dataViewBytes(byteLength, writer) {
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);
  writer(view);
  return new Uint8Array(buffer);
}

function uint8(value) {
  return Uint8Array.of(Number(value) & 0xff);
}

function uint32(value) {
  return dataViewBytes(4, (view) => view.setUint32(0, Number(value) >>> 0, true));
}

function uint64(value) {
  return dataViewBytes(8, (view) => view.setBigUint64(0, BigInt(value), true));
}

function int16(value) {
  return dataViewBytes(2, (view) => view.setInt16(0, Number(value) || 0, true));
}

function int32(value) {
  return dataViewBytes(4, (view) => view.setInt32(0, Number(value) || 0, true));
}

function int64(value) {
  return dataViewBytes(8, (view) => view.setBigInt64(0, BigInt(value), true));
}

function float32(value) {
  return dataViewBytes(4, (view) => view.setFloat32(0, Number(value) || 0, true));
}

function float64(value) {
  return dataViewBytes(8, (view) => view.setFloat64(0, Number(value) || 0, true));
}

function arrayBytes(values, itemByteLength, writeItem) {
  const array = ArrayBuffer.isView(values) ? values : Array.from(values || []);
  const output = new Uint8Array(array.length * itemByteLength);
  const view = new DataView(output.buffer);
  for (let index = 0; index < array.length; index += 1) {
    writeItem(view, index * itemByteLength, array[index]);
  }
  return output;
}

function bytesFromArrayLike(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

function compressedArrayBytes(bytes, context, options) {
  const compressor = options.compressArrayBytes || options.arrayCompressor;
  return typeof compressor === "function" ? bytesFromArrayLike(compressor(bytes, context)) : null;
}

function typedArrayPropertyBytes(typeCode, values, itemByteLength, writeItem, options = {}) {
  const bytes = arrayBytes(values, itemByteLength, writeItem);
  const compressed = compressedArrayBytes(bytes, {
    typeCode,
    itemByteLength,
    count: bytes.length / itemByteLength,
    byteLength: bytes.length
  }, options);
  const payload = compressed?.length ? compressed : bytes;
  return concatBytes([
    uint8(typeCode.charCodeAt(0)),
    uint32(bytes.length / itemByteLength),
    uint32(compressed?.length ? 1 : 0),
    uint32(payload.length),
    payload
  ]);
}

function propertyBytes(property, options = {}) {
  if (typeof property === "boolean") {
    return Uint8Array.of("C".charCodeAt(0), property ? 1 : 0);
  }
  if (Number.isInteger(property)) {
    return concatBytes([uint8("I".charCodeAt(0)), int32(property)]);
  }
  if (typeof property === "bigint") {
    return concatBytes([uint8("L".charCodeAt(0)), int64(property)]);
  }
  if (typeof property === "number") {
    return concatBytes([uint8("D".charCodeAt(0)), float64(property)]);
  }
  if (property instanceof Uint8Array) {
    return concatBytes([uint8("R".charCodeAt(0)), uint32(property.length), property]);
  }
  if (property && typeof property === "object" && property.type) {
    return typedPropertyBytes(property, options);
  }
  const bytes = utf8Bytes(property ?? "");
  return concatBytes([uint8("S".charCodeAt(0)), uint32(bytes.length), bytes]);
}

function typedPropertyBytes(property, options = {}) {
  switch (property.type) {
    case "int16":
      return concatBytes([uint8("Y".charCodeAt(0)), int16(property.value)]);
    case "int32":
      return concatBytes([uint8("I".charCodeAt(0)), int32(property.value)]);
    case "int64":
      return concatBytes([uint8("L".charCodeAt(0)), int64(property.value)]);
    case "float32":
      return concatBytes([uint8("F".charCodeAt(0)), float32(property.value)]);
    case "float64":
      return concatBytes([uint8("D".charCodeAt(0)), float64(property.value)]);
    case "string": {
      const bytes = utf8Bytes(property.value ?? "");
      return concatBytes([uint8("S".charCodeAt(0)), uint32(bytes.length), bytes]);
    }
    case "raw": {
      const bytes = property.value instanceof Uint8Array ? property.value : new Uint8Array(property.value || []);
      return concatBytes([uint8("R".charCodeAt(0)), uint32(bytes.length), bytes]);
    }
    case "boolArray":
      return typedArrayPropertyBytes("b", property.value, 1, (view, offset, value) => {
        view.setUint8(offset, value ? 1 : 0);
      }, options);
    case "int32Array":
      return typedArrayPropertyBytes("i", property.value, 4, (view, offset, value) => {
        view.setInt32(offset, Number(value) || 0, true);
      }, options);
    case "int64Array":
      return typedArrayPropertyBytes("l", property.value, 8, (view, offset, value) => {
        view.setBigInt64(offset, BigInt(value), true);
      }, options);
    case "float32Array":
      return typedArrayPropertyBytes("f", property.value, 4, (view, offset, value) => {
        view.setFloat32(offset, Number(value) || 0, true);
      }, options);
    case "float64Array":
      return typedArrayPropertyBytes("d", property.value, 8, (view, offset, value) => {
        view.setFloat64(offset, Number(value) || 0, true);
      }, options);
    default:
      throw new Error(`Unsupported FBX property type: ${property.type}`);
  }
}

export class FbxNode {
  constructor(name, properties = [], children = []) {
    this.name = String(name);
    this.properties = [...properties];
    this.children = [...children];
  }

  add(name, properties = [], children = []) {
    const child = new FbxNode(name, properties, children);
    this.children.push(child);
    return child;
  }
}

export class FbxBinaryWriter {
  constructor({ version = 7400, compressArrayBytes = null, arrayCompressor = null } = {}) {
    this.version = version;
    this.compressArrayBytes = compressArrayBytes;
    this.arrayCompressor = arrayCompressor;
  }

  writeDocument(nodes) {
    const header = concatBytes([FBX_BINARY_MAGIC, uint32(this.version)]);
    const body = this.writeNodeList(nodes, header.length);
    return concatBytes([header, body, this.nullRecord()]);
  }

  writeNodeList(nodes, startOffset = 0) {
    let offset = startOffset;
    const chunks = [];
    for (const node of nodes) {
      const bytes = this.writeNode(node, offset);
      chunks.push(bytes);
      offset += bytes.length;
    }
    return concatBytes(chunks);
  }

  writeNode(node, startOffset = 0) {
    const nameBytes = utf8Bytes(node.name);
    if (nameBytes.length > 255) {
      throw new Error(`FBX node names are limited to 255 bytes: ${node.name}`);
    }

    const propertyChunks = node.properties.map((property) => propertyBytes(property, this));
    const properties = concatBytes(propertyChunks);
    const headerLength = this.nodeHeaderLength(nameBytes.length);
    const childStart = startOffset + headerLength + properties.length;
    const children = this.writeNodeList(node.children, childStart);
    const nullRecord = node.children.length ? this.nullRecord() : new Uint8Array();
    const endOffset = startOffset + headerLength + properties.length + children.length + nullRecord.length;

    return concatBytes([
      this.nodeRecordInteger(endOffset),
      this.nodeRecordInteger(node.properties.length),
      this.nodeRecordInteger(properties.length),
      uint8(nameBytes.length),
      nameBytes,
      properties,
      children,
      nullRecord
    ]);
  }

  usesWideNodeRecords() {
    return this.version >= 7500;
  }

  nodeRecordInteger(value) {
    return this.usesWideNodeRecords() ? uint64(value) : uint32(value);
  }

  nodeHeaderLength(nameLength) {
    return (this.usesWideNodeRecords() ? 24 : 12) + 1 + nameLength;
  }

  nullRecord() {
    return new Uint8Array(this.usesWideNodeRecords() ? NULL_RECORD_64_SIZE : NULL_RECORD_32_SIZE);
  }
}

export function makeNode(name, properties = [], children = []) {
  return new FbxNode(name, properties, children);
}
