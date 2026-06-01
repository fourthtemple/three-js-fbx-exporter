export function collectOwnedAnimationClipEntries(ownerEntries) {
  const entries = [];
  const seenOwners = new Set();
  const seenClips = new Set();

  for (const ownerEntry of ownerEntries) {
    const { owner, ...metadata } = ownerEntry || {};
    if (!owner || seenOwners.has(owner)) {
      continue;
    }
    seenOwners.add(owner);

    for (const clip of owner.animations || []) {
      if (!clip || seenClips.has(clip)) {
        continue;
      }
      seenClips.add(clip);
      entries.push({ ...metadata, clip });
    }
  }

  return entries;
}
