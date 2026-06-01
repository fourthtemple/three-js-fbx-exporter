const FBX_BINARY_MAGIC = "Kaydara FBX Binary  \0\x1a\0";
const HEADER_LENGTH = 27;
const NULL_RECORD_32_SIZE = 13;
const NULL_RECORD_64_SIZE = 25;

const ARRAY_ELEMENT_SIZES = Object.freeze({
  b: 1,
  i: 4,
  l: 8,
  f: 4,
  d: 8
});

const SCALAR_PROPERTY_SIZES = Object.freeze({
  C: 1,
  Y: 2,
  I: 4,
  F: 4,
  D: 8,
  L: 8
});

function bytesFrom(input) {
  if (input instanceof Uint8Array) {
    return input;
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  throw new Error("FBX binary validation requires Uint8Array or ArrayBuffer bytes");
}

function fail(errors, message, offset) {
  errors.push(offset == null ? message : `${message} at byte ${offset}`);
}

function ensureRange(bytes, offset, length, errors, label) {
  if (offset < 0 || length < 0 || offset + length > bytes.length) {
    fail(errors, `${label} exceeds file length`, offset);
    return false;
  }
  return true;
}

function readUint32(bytes, offset, errors, label) {
  if (!ensureRange(bytes, offset, 4, errors, label)) {
    return 0;
  }
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);
}

function readUint64(bytes, offset, errors, label) {
  if (!ensureRange(bytes, offset, 8, errors, label)) {
    return 0;
  }
  const value = new DataView(bytes.buffer, bytes.byteOffset + offset, 8).getBigUint64(0, true);
  return value > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(value);
}

function binaryVersion(bytes, errors) {
  const magic = new TextDecoder().decode(bytes.subarray(0, Math.min(23, bytes.length)));
  if (magic !== FBX_BINARY_MAGIC) {
    fail(errors, "FBX binary magic header is invalid", 0);
  }
  return readUint32(bytes, 23, errors, "FBX version");
}

function nodeLayout(version) {
  const wide = version >= 7500;
  return {
    wide,
    integerSize: wide ? 8 : 4,
    nullRecordSize: wide ? NULL_RECORD_64_SIZE : NULL_RECORD_32_SIZE
  };
}

function readNodeInteger(bytes, offset, layout, errors, label) {
  return layout.wide
    ? readUint64(bytes, offset, errors, label)
    : readUint32(bytes, offset, errors, label);
}

function isNullRecord(bytes, offset, layout) {
  if (offset + layout.nullRecordSize > bytes.length) {
    return false;
  }
  for (let index = 0; index < layout.nullRecordSize; index += 1) {
    if (bytes[offset + index] !== 0) {
      return false;
    }
  }
  return true;
}

function readNodeHeader(bytes, offset, layout, errors) {
  const { integerSize } = layout;
  const minimumHeaderLength = integerSize * 3 + 1;
  if (!ensureRange(bytes, offset, minimumHeaderLength, errors, "FBX node header")) {
    return null;
  }
  const endOffset = readNodeInteger(bytes, offset, layout, errors, "FBX node end offset");
  const propertyCount = readNodeInteger(bytes, offset + integerSize, layout, errors, "FBX node property count");
  const propertyBytes = readNodeInteger(bytes, offset + integerSize * 2, layout, errors, "FBX node property byte length");
  const nameLengthOffset = offset + integerSize * 3;
  const nameLength = bytes[nameLengthOffset];
  const nameStart = nameLengthOffset + 1;
  if (!ensureRange(bytes, nameStart, nameLength, errors, "FBX node name")) {
    return null;
  }
  return {
    endOffset,
    propertyCount,
    propertyBytes,
    nameLength,
    nameStart,
    propertyStart: nameStart + nameLength
  };
}

function parseLengthProperty(bytes, offset, errors, typeCode) {
  const length = readUint32(bytes, offset + 1, errors, `${typeCode} property length`);
  const endOffset = offset + 5 + length;
  if (!ensureRange(bytes, offset + 5, length, errors, `${typeCode} property payload`)) {
    return bytes.length;
  }
  return endOffset;
}

function parseArrayProperty(bytes, offset, errors, typeCode) {
  const count = readUint32(bytes, offset + 1, errors, `${typeCode} array count`);
  const encoding = readUint32(bytes, offset + 5, errors, `${typeCode} array encoding`);
  const payloadLength = readUint32(bytes, offset + 9, errors, `${typeCode} array payload length`);
  const payloadOffset = offset + 13;
  if (encoding !== 0 && encoding !== 1) {
    fail(errors, `${typeCode} array uses unsupported encoding ${encoding}`, offset);
  }
  if (encoding === 0 && payloadLength !== count * ARRAY_ELEMENT_SIZES[typeCode]) {
    fail(errors, `${typeCode} array payload length does not match count`, offset);
  }
  if (!ensureRange(bytes, payloadOffset, payloadLength, errors, `${typeCode} array payload`)) {
    return bytes.length;
  }
  return payloadOffset + payloadLength;
}

function parseProperty(bytes, offset, errors) {
  if (!ensureRange(bytes, offset, 1, errors, "FBX property type")) {
    return bytes.length;
  }
  const typeCode = String.fromCharCode(bytes[offset]);
  if (SCALAR_PROPERTY_SIZES[typeCode]) {
    const endOffset = offset + 1 + SCALAR_PROPERTY_SIZES[typeCode];
    ensureRange(bytes, offset + 1, SCALAR_PROPERTY_SIZES[typeCode], errors, `${typeCode} property payload`);
    return endOffset;
  }
  if (typeCode === "S" || typeCode === "R") {
    return parseLengthProperty(bytes, offset, errors, typeCode);
  }
  if (ARRAY_ELEMENT_SIZES[typeCode]) {
    return parseArrayProperty(bytes, offset, errors, typeCode);
  }
  fail(errors, `Unknown FBX property type '${typeCode}'`, offset);
  return bytes.length;
}

function parseProperties(bytes, header, errors) {
  let offset = header.propertyStart;
  const declaredEnd = header.propertyStart + header.propertyBytes;
  if (declaredEnd > header.endOffset) {
    fail(errors, "FBX node property bytes extend past node end", header.propertyStart);
    return header.endOffset;
  }
  for (let index = 0; index < header.propertyCount; index += 1) {
    if (offset >= declaredEnd) {
      fail(errors, "FBX node has fewer property bytes than declared", offset);
      return declaredEnd;
    }
    offset = parseProperty(bytes, offset, errors);
  }
  if (offset !== declaredEnd) {
    fail(errors, "FBX node property byte length does not match parsed properties", header.propertyStart);
  }
  return declaredEnd;
}

function parseNode(bytes, offset, layout, errors, depth = 0) {
  if (isNullRecord(bytes, offset, layout)) {
    return { offset: offset + layout.nullRecordSize, nullRecord: true };
  }
  const header = readNodeHeader(bytes, offset, layout, errors);
  if (!header) {
    return { offset: bytes.length, nullRecord: false };
  }
  if (header.endOffset <= offset) {
    fail(errors, "FBX node end offset must advance", offset);
    return { offset: bytes.length, nullRecord: false };
  }
  if (header.endOffset > bytes.length) {
    fail(errors, "FBX node end offset exceeds file length", offset);
    return { offset: bytes.length, nullRecord: false };
  }
  let childOffset = parseProperties(bytes, header, errors);
  while (childOffset < header.endOffset) {
    const child = parseNode(bytes, childOffset, layout, errors, depth + 1);
    childOffset = child.offset;
    if (child.nullRecord) {
      break;
    }
  }
  if (childOffset !== header.endOffset) {
    fail(errors, "FBX child node list does not land on parent end offset", offset);
  }
  return { offset: header.endOffset, nullRecord: false };
}

export function validateFbxBinary(input, options = {}) {
  const bytes = bytesFrom(input);
  const errors = [];
  const warnings = [];
  if (bytes.length < HEADER_LENGTH) {
    fail(errors, "FBX binary is shorter than the header");
    return { valid: false, errors, warnings, version: 0, nodeCount: 0, trailingBytes: 0 };
  }
  const version = binaryVersion(bytes, errors);
  const layout = nodeLayout(version);
  let offset = HEADER_LENGTH;
  let nodeCount = 0;
  while (offset < bytes.length) {
    const node = parseNode(bytes, offset, layout, errors);
    offset = node.offset;
    if (node.nullRecord) {
      break;
    }
    nodeCount += 1;
  }
  const trailingBytes = bytes.length - offset;
  if (trailingBytes > 0) {
    const message = `FBX binary has trailing bytes after top-level null record at byte ${offset}`;
    if (options.allowTrailingBytes) {
      warnings.push(message);
    } else {
      fail(errors, "FBX binary has trailing bytes after top-level null record", offset);
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    version,
    nodeCount,
    trailingBytes
  };
}

export function assertValidFbxBinary(input, options = {}) {
  const result = validateFbxBinary(input, options);
  if (!result.valid) {
    throw new Error(`Invalid FBX binary:\n${result.errors.join("\n")}`);
  }
  return result;
}
