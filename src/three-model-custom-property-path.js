const CUSTOM_MODEL_PROPERTY_CONTAINER = "(?:(?:userData\\.)?(?:customProperties|fbxCustomProperties|modelCustomProperties))";
const CUSTOM_MODEL_PROPERTY_NAME = "(?:\\[([^\\]]+)\\]|\\.([^.\\[]+))";
const CUSTOM_MODEL_PROPERTY_VALUE = "(?:\\.(?:value|defaultValue))?";
const CUSTOM_MODEL_PROPERTY_COMPONENT = "((?:\\.[rgbxyzRGBXYZ])|(?:\\[[rgbxyzRGBXYZ012]\\]))?";
const CUSTOM_MODEL_PROPERTY_PATH = new RegExp(
  `^${CUSTOM_MODEL_PROPERTY_CONTAINER}${CUSTOM_MODEL_PROPERTY_NAME}${CUSTOM_MODEL_PROPERTY_VALUE}${CUSTOM_MODEL_PROPERTY_COMPONENT}$`
);

export function parseCustomModelPropertyPath(path) {
  const match = String(path).match(CUSTOM_MODEL_PROPERTY_PATH);
  if (!match) {
    return null;
  }
  return {
    name: match[1] || match[2] || "",
    componentSuffix: match[3] || ""
  };
}

export function isCustomModelPropertyPath(path) {
  return Boolean(parseCustomModelPropertyPath(path));
}
