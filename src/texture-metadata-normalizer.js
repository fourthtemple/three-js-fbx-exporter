export function normalizeTextureWrapMode(value, fallback = "clamp") {
  if (value == null) {
    return fallback;
  }
  if (typeof value === "number") {
    return value === 0 || value === 1000 || value === 1002 ? "repeat" : "clamp";
  }
  const text = String(value).toLowerCase();
  if (text.includes("repeat") || text.includes("mirror")) {
    return "repeat";
  }
  if (text.includes("clamp")) {
    return "clamp";
  }
  return fallback;
}

export function normalizeTextureBlendMode(value) {
  if (Number.isInteger(value)) {
    return value;
  }
  if (value == null) {
    return 0;
  }
  const text = String(value).toLowerCase();
  if (text.includes("add")) {
    return 1;
  }
  if (text.includes("multiply") || text.includes("modulate")) {
    return 2;
  }
  return 0;
}

export function normalizeTextureMappingType(value) {
  if (Number.isInteger(value)) {
    if (value === 301 || value === 302 || value === 306) {
      return 4;
    }
    if (value === 303 || value === 304) {
      return 2;
    }
    return value >= 0 && value <= 10 ? value : 0;
  }
  if (value == null) {
    return 0;
  }
  const text = String(value).toLowerCase();
  if (text.includes("planar")) {
    return 1;
  }
  if (text.includes("sphere") || text.includes("spher") || text.includes("equirect")) {
    return 2;
  }
  if (text.includes("cyl")) {
    return 3;
  }
  if (text.includes("box") || text.includes("cube")) {
    return 4;
  }
  return 0;
}

export function normalizeTextureTypeUse(value) {
  if (Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (value == null) {
    return 0;
  }
  const text = String(value).toLowerCase();
  if (text.includes("shadow")) {
    return 1;
  }
  if (text.includes("light")) {
    return 2;
  }
  if (text.includes("spher") || text.includes("reflection") || text.includes("environment")) {
    return 3;
  }
  return 0;
}

export function normalizeTextureBoolean(value) {
  if (typeof value === "string") {
    const text = value.toLowerCase();
    return text === "false" || text === "off" || text === "no" || text === "0" ? 0 : 1;
  }
  return value ? 1 : 0;
}

export function normalizeTextureColorSpace(value) {
  if (Number.isInteger(value)) {
    return Math.max(0, value);
  }
  if (value == null) {
    return 0;
  }
  const text = String(value).toLowerCase();
  if (!text || text === "none" || text === "no" || text === "nocolorspace" || text === "no color space") {
    return 0;
  }
  if (text.includes("linear")) {
    return 1;
  }
  if (text.includes("srgb") || text.includes("s-rgb") || text.includes("srgba")) {
    return 2;
  }
  if (text.includes("display") && text.includes("p3")) {
    return 3;
  }
  return 0;
}

export function normalizeTextureEncoding(value) {
  if (Number.isInteger(value)) {
    return Math.max(0, value);
  }
  if (value == null) {
    return 0;
  }
  const text = String(value).toLowerCase();
  if (!text || text === "none") {
    return 0;
  }
  if (text.includes("srgb")) {
    return 3001;
  }
  if (text.includes("linear")) {
    return 3000;
  }
  if (text.includes("rgbe")) {
    return 3002;
  }
  if (text.includes("rgbm16")) {
    return 3005;
  }
  if (text.includes("rgbm7") || text.includes("rgbm")) {
    return 3004;
  }
  if (text.includes("rgbd")) {
    return 3006;
  }
  if (text.includes("gamma")) {
    return 3007;
  }
  return 0;
}

export function normalizeTextureUnpackAlignment(value) {
  const number = Number(value);
  return [1, 2, 4, 8].includes(number) ? number : 4;
}

export function normalizeTextureFilter(value, fallback = 1006) {
  if (Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (value == null) {
    return fallback;
  }
  const text = String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (text.includes("nearestmipmapnearest")) {
    return 1004;
  }
  if (text.includes("nearestmipmaplinear")) {
    return 1005;
  }
  if (text.includes("linearmipmapnearest")) {
    return 1007;
  }
  if (text.includes("linearmipmaplinear")) {
    return 1008;
  }
  if (text.includes("nearest")) {
    return 1003;
  }
  if (text.includes("linear")) {
    return 1006;
  }
  return fallback;
}

export function normalizeTextureAnisotropy(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 1;
}

export function normalizeTextureFormat(value, fallback = 1023) {
  return normalizeTextureEnum(value, fallback, TEXTURE_FORMAT_ALIASES);
}

export function normalizeTextureType(value, fallback = 1009) {
  return normalizeTextureEnum(value, fallback, TEXTURE_TYPE_ALIASES);
}

export function normalizeTextureInternalFormatId(value, fallback = 0) {
  return normalizeTextureEnum(value, fallback, TEXTURE_INTERNAL_FORMAT_ALIASES);
}

export function normalizeTextureCompareFunction(value, fallback = 0) {
  return normalizeTextureEnum(value, fallback, TEXTURE_COMPARE_FUNCTION_ALIASES);
}

export function normalizeTextureDimensionKind(value, fallback = 0) {
  return normalizeTextureEnum(value, fallback, TEXTURE_DIMENSION_KIND_ALIASES);
}

export function textureDimensionKindLabel(value) {
  return TEXTURE_DIMENSION_KIND_LABELS[normalizeTextureDimensionKind(value)] || TEXTURE_DIMENSION_KIND_LABELS[0];
}

export function normalizeTexturePositiveInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : fallback;
}

export function textureWrapModeEnum(value) {
  return normalizeTextureWrapMode(value) === "repeat" ? 0 : 1;
}

function normalizeTextureEnum(value, fallback, aliases) {
  if (Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (value == null) {
    return fallback;
  }
  const key = String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  return aliases[key] ?? fallback;
}

const TEXTURE_FORMAT_ALIASES = Object.freeze({
  alpha: 1021,
  alphaformat: 1021,
  rgb: 1022,
  rgbformat: 1022,
  rgba: 1023,
  rgbaformat: 1023,
  depth: 1026,
  depthformat: 1026,
  depthstencil: 1027,
  depthstencilformat: 1027,
  red: 1028,
  redformat: 1028,
  redinteger: 1029,
  redintegerformat: 1029,
  rg: 1030,
  rgformat: 1030,
  rginteger: 1031,
  rgintegerformat: 1031,
  rgbinteger: 1032,
  rgbintegerformat: 1032,
  rgbainteger: 1033,
  rgbaintegerformat: 1033,
  rgbs3tcdxt1: 33776,
  rgbs3tcdxt1format: 33776,
  rgbas3tcdxt1: 33777,
  rgbas3tcdxt1format: 33777,
  rgbas3tcdxt3: 33778,
  rgbas3tcdxt3format: 33778,
  rgbas3tcdxt5: 33779,
  rgbas3tcdxt5format: 33779,
  rgbetc1: 36196,
  rgbetc1format: 36196,
  rgbetc2: 37492,
  rgbetc2format: 37492,
  rgbaetc2eac: 37496,
  rgbaetc2eacformat: 37496,
  rgbaastc4x4: 37808,
  rgbaastc4x4format: 37808,
  rgbabptc: 36492,
  rgbabptcformat: 36492
});

const TEXTURE_TYPE_ALIASES = Object.freeze({
  unsignedbyte: 1009,
  unsignedbytetype: 1009,
  byte: 1010,
  bytetype: 1010,
  short: 1011,
  shorttype: 1011,
  unsignedshort: 1012,
  unsignedshorttype: 1012,
  int: 1013,
  inttype: 1013,
  unsignedint: 1014,
  unsignedinttype: 1014,
  float: 1015,
  floattype: 1015,
  halffloat: 1016,
  halffloattype: 1016,
  unsignedshort4444: 1017,
  unsignedshort4444type: 1017,
  unsignedshort5551: 1018,
  unsignedshort5551type: 1018,
  unsignedint248: 1020,
  unsignedint248type: 1020,
  unsignedint5999: 35902,
  unsignedint5999type: 35902
});

const TEXTURE_INTERNAL_FORMAT_ALIASES = Object.freeze({
  r8: 33321,
  r8snorm: 36756,
  r8ui: 33330,
  r8i: 33329,
  r16ui: 33332,
  r16i: 33331,
  r16f: 33325,
  r32ui: 33334,
  r32i: 33333,
  r32f: 33326,
  rg8: 33323,
  rg8snorm: 36757,
  rg8ui: 33336,
  rg8i: 33335,
  rg16ui: 33338,
  rg16i: 33337,
  rg16f: 33327,
  rg32ui: 33340,
  rg32i: 33339,
  rg32f: 33328,
  rgb8: 32849,
  rgb8snorm: 36758,
  rgb8ui: 36221,
  rgb8i: 36239,
  rgb16ui: 36215,
  rgb16i: 36233,
  rgb16f: 34843,
  rgb32ui: 36209,
  rgb32i: 36227,
  rgb32f: 34837,
  rgba8: 32856,
  rgba8snorm: 36759,
  rgba8ui: 36220,
  rgba8i: 36238,
  rgba16ui: 36214,
  rgba16i: 36232,
  rgba16f: 34842,
  rgba32ui: 36208,
  rgba32i: 36226,
  rgba32f: 34836,
  srgb8: 35905,
  srgb8alpha8: 35907,
  depthcomponent16: 33189,
  depthcomponent24: 33190,
  depthcomponent32f: 36012,
  depth24stencil8: 35056,
  depth32fstencil8: 36013
});

const TEXTURE_COMPARE_FUNCTION_ALIASES = Object.freeze({
  never: 512,
  nevercompare: 512,
  less: 513,
  lesscompare: 513,
  equal: 514,
  equalcompare: 514,
  lessequal: 515,
  lessorequal: 515,
  lessequalcompare: 515,
  lequal: 515,
  greater: 516,
  greatercompare: 516,
  notequal: 517,
  noteequal: 517,
  notequalcompare: 517,
  greaterEqual: 518,
  greaterequal: 518,
  greaterorequal: 518,
  greaterequalcompare: 518,
  gequal: 518,
  always: 519,
  alwayscompare: 519
});

const TEXTURE_DIMENSION_KIND_LABELS = Object.freeze({
  0: "2d",
  1: "cube",
  2: "3d",
  3: "2d_array"
});

const TEXTURE_DIMENSION_KIND_ALIASES = Object.freeze({
  "2d": 0,
  texture2d: 0,
  sampler2d: 0,
  flat: 0,
  cube: 1,
  cubemap: 1,
  cubetexture: 1,
  compressedcubetexture: 1,
  "3d": 2,
  texture3d: 2,
  sampler3d: 2,
  volume: 2,
  volumetexture: 2,
  data3dtexture: 2,
  array: 3,
  arraytexture: 3,
  "2darraytexture": 3,
  texturearray: 3,
  texture2darray: 3,
  sampler2darray: 3,
  dataarraytexture: 3,
  compressedarraytexture: 3,
  deptharraytexture: 3
});
