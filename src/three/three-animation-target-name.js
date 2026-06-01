export function threeAnimationTargetName(value) {
  return value?.userData?.animationName ??
    value?.userData?.animationTarget ??
    value?.userData?.targetName ??
    value?.animationName ??
    value?.animationTarget ??
    value?.targetName ??
    "";
}
