import { collectOwnedAnimationClipEntries } from "./three-animation-clip-owners.js";
import { textureAnimationOwners } from "./three-texture-animation-owners.js";

export function textureAnimationClipEntries(texture) {
  return collectOwnedAnimationClipEntries(textureAnimationOwners(texture));
}

export function textureAnimationClips(texture) {
  return textureAnimationClipEntries(texture).map((entry) => entry.clip);
}
