export function nestedTextureSources(texture = {}) {
  const userData = texture?.userData;
  return [
    userData?.image,
    userData?.source,
    userData?.source?.data,
    userData?.video,
    userData?.media,
    userData?.element,
    userData?.mediaElement,
    texture?.image,
    texture?.source,
    texture?.source?.data,
    texture?.video,
    texture?.media,
    texture?.element,
    texture?.mediaElement
  ];
}

export function firstField(sources, ...keys) {
  for (const source of sources) {
    for (const key of keys) {
      if (source?.[key] != null) {
        return source[key];
      }
    }
  }
  return undefined;
}

export function textureFieldWithSources(texture = {}, ...keys) {
  return firstField([texture, texture?.userData, ...nestedTextureSources(texture)], ...keys);
}
