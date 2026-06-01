const CUSTOM_MATERIAL_PROPERTY_CONTAINER = "(?:(?:userData\\.)?(?:customProperties|fbxCustomProperties|materialCustomProperties))";
const CUSTOM_MATERIAL_PROPERTY_NAME = "(?:\\[([^\\]]+)\\]|\\.([^.\\[]+))";
const CUSTOM_MATERIAL_PROPERTY_VALUE = "(?:\\.(?:value|defaultValue))?";
const CUSTOM_MATERIAL_PROPERTY_COMPONENT = "((?:\\.[rgbxyzRGBXYZ])|(?:\\[[rgbxyzRGBXYZ012]\\]))?";
const CUSTOM_MATERIAL_PROPERTY_PATH = new RegExp(
  `^${CUSTOM_MATERIAL_PROPERTY_CONTAINER}${CUSTOM_MATERIAL_PROPERTY_NAME}${CUSTOM_MATERIAL_PROPERTY_VALUE}${CUSTOM_MATERIAL_PROPERTY_COMPONENT}$`
);

export function parseCustomMaterialPropertyPath(text) {
  const match = String(text).match(CUSTOM_MATERIAL_PROPERTY_PATH);
  return match
    ? {
        name: match[1] || match[2] || "",
        componentSuffix: match[3] || ""
      }
    : null;
}

export function isCustomMaterialPropertyPath(text) {
  return Boolean(parseCustomMaterialPropertyPath(text));
}
