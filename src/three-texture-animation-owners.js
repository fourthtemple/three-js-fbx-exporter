export function textureAnimationOwners(texture) {
  return [
    { owner: texture, rootSuffix: "__texture" },
    { owner: texture?.image, rootSuffix: "__texture.image" },
    { owner: texture?.source, rootSuffix: "__texture.source" },
    { owner: texture?.source?.data, rootSuffix: "__texture.source.data" },
    { owner: texture?.video, rootSuffix: "__texture.video" },
    { owner: texture?.media, rootSuffix: "__texture.media" },
    { owner: texture?.element, rootSuffix: "__texture.element" },
    { owner: texture?.mediaElement, rootSuffix: "__texture.mediaElement" },
    { owner: texture?.userData, rootSuffix: "__texture.userData" },
    { owner: texture?.userData?.image, rootSuffix: "__texture.userData.image" },
    { owner: texture?.userData?.source, rootSuffix: "__texture.userData.source" },
    { owner: texture?.userData?.source?.data, rootSuffix: "__texture.userData.source.data" },
    { owner: texture?.userData?.video, rootSuffix: "__texture.userData.video" },
    { owner: texture?.userData?.media, rootSuffix: "__texture.userData.media" },
    { owner: texture?.userData?.element, rootSuffix: "__texture.userData.element" },
    { owner: texture?.userData?.mediaElement, rootSuffix: "__texture.userData.mediaElement" }
  ];
}
