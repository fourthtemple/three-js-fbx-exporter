export function threeModelCustomProperties(object) {
  return object?.userData?.customProperties ??
    object?.userData?.fbxCustomProperties ??
    object?.userData?.modelCustomProperties ??
    object?.customProperties ??
    object?.fbxCustomProperties ??
    object?.modelCustomProperties;
}
