import { collectOwnedAnimationClipEntries } from "./three-animation-clip-owners.js";
import { materialAnimationOwners } from "./three-material-animation-owners.js";

export function materialAnimationClipEntries(material) {
  return collectOwnedAnimationClipEntries(materialAnimationOwners(material));
}
