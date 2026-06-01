export function materialAnimationOwners(material) {
  return [
    { owner: material, rootSuffix: "__material" },
    { owner: material?.userData, rootSuffix: "__material.userData" }
  ];
}
