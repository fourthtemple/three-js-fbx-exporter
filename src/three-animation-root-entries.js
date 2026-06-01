export function cloneAnimationTrackForRoot(track, rootTrackTarget) {
  const clone = typeof track?.clone === "function"
    ? track.clone()
    : Object.assign(Object.create(Object.getPrototypeOf(track)), track);
  clone.name = `${rootTrackTarget}.${track.name}`;
  return clone;
}

export function animationEntryForRootTargets(clip, rootTrackTargets, { forceClone = false } = {}) {
  const targets = Array.from(new Set(rootTrackTargets.filter(Boolean)));
  if (!targets.length) {
    return null;
  }
  if (targets.length === 1 && !forceClone) {
    return { clip, rootTrackTarget: targets[0] };
  }
  const clonedClip = Object.assign(Object.create(Object.getPrototypeOf(clip)), clip, {
    tracks: targets.flatMap((target) => (clip.tracks || []).map((track) => cloneAnimationTrackForRoot(track, target)))
  });
  return { clip: clonedClip, rootTrackTarget: null };
}
