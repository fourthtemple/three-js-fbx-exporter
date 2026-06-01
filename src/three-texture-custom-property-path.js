const CUSTOM_TEXTURE_OWNER_PATH = "(?:(?:userData\\.)?(?:image|source(?:\\.data)?|video|media|element|mediaElement)\\.)?";
const CUSTOM_TEXTURE_PROPERTY_CONTAINER = `(?:${CUSTOM_TEXTURE_OWNER_PATH}(?:userData\\.)?(?:customProperties|fbxCustomProperties|textureCustomProperties))`;
const CUSTOM_TEXTURE_PROPERTY_NAME = "(?:\\[([^\\]]+)\\]|\\.([^.\\[]+))";
const CUSTOM_TEXTURE_PROPERTY_VALUE = "(?:\\.(?:value|defaultValue))?";
const CUSTOM_TEXTURE_PROPERTY_COMPONENT = "((?:\\.[rgbxyzRGBXYZ])|(?:\\[[rgbxyzRGBXYZ012]\\]))?";
const CUSTOM_TEXTURE_PROPERTY_PATH = new RegExp(
  `^${CUSTOM_TEXTURE_PROPERTY_CONTAINER}${CUSTOM_TEXTURE_PROPERTY_NAME}${CUSTOM_TEXTURE_PROPERTY_VALUE}${CUSTOM_TEXTURE_PROPERTY_COMPONENT}$`
);

export function parseCustomTexturePropertyPath(path) {
  const match = String(path).match(CUSTOM_TEXTURE_PROPERTY_PATH);
  if (!match) {
    return null;
  }
  return {
    name: match[1] || match[2] || "",
    componentSuffix: match[3] || ""
  };
}

export function isCustomTexturePropertyPath(path) {
  return Boolean(parseCustomTexturePropertyPath(path));
}
