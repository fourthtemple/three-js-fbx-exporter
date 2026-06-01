import { collectOwnedAnimationClipEntries } from "./three-animation-clip-owners.js";

export function objectAnimationClipEntries(object, rootTrackTarget) {
  return collectOwnedAnimationClipEntries([
    { owner: object, rootTrackTarget },
    { owner: object?.userData, rootTrackTarget }
  ]);
}
