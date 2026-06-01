export const FBX_KTIME = 46186158000;

export function int32Array(value) {
  return { type: "int32Array", value };
}

export function int64Array(value) {
  return { type: "int64Array", value };
}

export function float32Array(value) {
  return { type: "float32Array", value };
}

export function float64Array(value) {
  return { type: "float64Array", value };
}

export function rawBytes(value) {
  return { type: "raw", value };
}

export function int32(value) {
  return { type: "int32", value };
}

export function int64(value) {
  return { type: "int64", value };
}

export function float64(value) {
  return { type: "float64", value };
}

export function asciiBytes(value) {
  return new Uint8Array(Array.from(String(value), (char) => char.charCodeAt(0)));
}

export function fbxName(type, name) {
  return `${name}\u0000\u0001${type}`;
}

export function makeIdFactory(start = 100000) {
  let nextId = start;
  return () => {
    nextId += 1;
    return nextId;
  };
}

export function addProperties70(node) {
  return node.add("Properties70");
}

export function addVectorProperty(properties, name, type, values) {
  properties.add("P", [name, type, "", "A", float64(values[0]), float64(values[1]), float64(values[2])]);
}

export function addDoubleProperty(properties, name, type, value) {
  properties.add("P", [name, type, "", "A", float64(value)]);
}

export function addIntProperty(properties, name, type, value) {
  properties.add("P", [name, type, "", "", int32(value)]);
}

export function addStringProperty(properties, name, value) {
  properties.add("P", [name, "KString", "", "", String(value ?? "")]);
}

export function addTimeProperty(properties, name, value) {
  properties.add("P", [name, "KTime", "Time", "", int64(value)]);
}

export function addBoolProperty(properties, name, value) {
  properties.add("P", [name, "bool", "", "", int32(value ? 1 : 0)]);
}

export function frameToKtime(frame, frameRate = 30) {
  return Math.round((Number(frame) / frameRate) * FBX_KTIME);
}
