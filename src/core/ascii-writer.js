function utf8Bytes(value) {
  return new TextEncoder().encode(String(value));
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
  return new Uint8Array(value || []);
}

function bytesToBase64(bytes) {
  if (typeof globalThis.btoa === "function") {
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return globalThis.btoa(binary);
  }

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = bytes[index + 1];
    const c = bytes[index + 2];
    output += alphabet[a >> 2];
    output += alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)];
    output += index + 1 < bytes.length ? alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)] : "=";
    output += index + 2 < bytes.length ? alphabet[c & 63] : "=";
  }
  return output;
}

function arrayValues(values) {
  return ArrayBuffer.isView(values) ? Array.from(values) : Array.from(values || []);
}

function asciiName(value) {
  const text = String(value ?? "");
  const marker = text.indexOf("\u0000\u0001");
  if (marker === -1) {
    return text;
  }
  const name = text.slice(0, marker);
  const type = text.slice(marker + 2);
  return `${type}::${name}`;
}

function quotedString(value) {
  return `"${asciiName(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")}"`;
}

function numericString(value) {
  if (typeof value === "bigint") {
    return value.toString();
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "0";
  }
  return Object.is(number, -0) ? "0" : String(number);
}

function isArrayProperty(property) {
  return property && typeof property === "object" && (
    property.type === "boolArray" ||
    property.type === "int32Array" ||
    property.type === "int64Array" ||
    property.type === "float32Array" ||
    property.type === "float64Array"
  );
}

function isRawProperty(property) {
  return property instanceof Uint8Array || (property && typeof property === "object" && property.type === "raw");
}

function rawPropertyBytes(property) {
  return property instanceof Uint8Array ? property : bytesFromArrayLike(property.value);
}

function scalarPropertyText(property) {
  if (typeof property === "boolean") {
    return property ? "1" : "0";
  }
  if (typeof property === "number" || typeof property === "bigint") {
    return numericString(property);
  }
  if (property instanceof Uint8Array) {
    return quotedString(bytesToBase64(property));
  }
  if (property && typeof property === "object" && property.type) {
    return typedPropertyText(property);
  }
  return quotedString(property ?? "");
}

function typedPropertyText(property) {
  switch (property.type) {
    case "int16":
    case "int32":
    case "int64":
    case "float32":
    case "float64":
      return numericString(property.value);
    case "string":
      return quotedString(property.value ?? "");
    case "raw":
      return quotedString(bytesToBase64(bytesFromArrayLike(property.value)));
    default:
      if (isArrayProperty(property)) {
        return arrayPropertyValues(property).join(",");
      }
      throw new Error(`Unsupported FBX property type: ${property.type}`);
  }
}

function arrayPropertyValues(property) {
  if (property.type === "boolArray") {
    return arrayValues(property.value).map((value) => value ? "1" : "0");
  }
  return arrayValues(property.value).map(numericString);
}

function propertyListText(properties) {
  return properties.map(scalarPropertyText).join(", ");
}

function asciiVersionLabel(version) {
  const text = String(version || 7400).padEnd(4, "0");
  return `${text[0]}.${text[1]}.${Number(text.slice(2))}`;
}

export class FbxAsciiWriter {
  constructor({ version = 7400, indent = "\t" } = {}) {
    this.version = version;
    this.indent = indent;
  }

  writeDocument(nodes) {
    return utf8Bytes(this.writeDocumentText(nodes));
  }

  writeDocumentText(nodes) {
    return [
      `; FBX ${asciiVersionLabel(this.version)} project file`,
      "; Created by three-js-fbx-exporter",
      "",
      ...nodes.map((node) => this.writeNode(node, 0)),
      ""
    ].join("\n");
  }

  writeNode(node, depth = 0) {
    const prefix = this.indent.repeat(depth);
    if (this.isArrayNode(node)) {
      return this.writeArrayNode(node, depth);
    }
    if (this.isRawContentNode(node)) {
      return this.writeRawContentNode(node, depth);
    }
    const properties = propertyListText(node.properties || []);
    if (!node.children?.length && depth === 0) {
      return `${prefix}${node.name}: ${properties ? `${properties} ` : " "}{\n${prefix}}`;
    }
    if (!node.children?.length) {
      return `${prefix}${node.name}: ${properties}`;
    }
    const childText = node.children.map((child) => this.writeNode(child, depth + 1)).join("\n");
    return `${prefix}${node.name}: ${properties ? `${properties} ` : " "}{\n${childText}\n${prefix}}`;
  }

  isArrayNode(node) {
    return node.properties?.length === 1 && isArrayProperty(node.properties[0]);
  }

  isRawContentNode(node) {
    return node.name === "Content" && node.properties?.length === 1 && isRawProperty(node.properties[0]);
  }

  writeArrayNode(node, depth) {
    const prefix = this.indent.repeat(depth);
    const childPrefix = this.indent.repeat(depth + 1);
    const values = arrayPropertyValues(node.properties[0]);
    return `${prefix}${node.name}: *${values.length} {\n${childPrefix}a: ${values.join(",")}\n${prefix}}`;
  }

  writeRawContentNode(node, depth) {
    const prefix = this.indent.repeat(depth);
    const childPrefix = this.indent.repeat(depth + 1);
    const content = bytesToBase64(rawPropertyBytes(node.properties[0]));
    return `${prefix}${node.name}: ,\n${childPrefix}"${content}",`;
  }
}
