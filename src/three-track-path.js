export const THREE_TRACK_TARGET_PATTERN = "((?:[^.[\\]/:]+[/:])*[^\\[\\]/:]+)";

export function threeTrackTargetName(path) {
  const parts = String(path || "").split(/[/:]/).filter(Boolean);
  return parts[parts.length - 1] || "";
}
