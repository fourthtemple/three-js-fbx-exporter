function finiteColorValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function linearColorComponentToFbx(value) {
  const component = finiteColorValue(value);
  if (component <= 0 || component >= 1) {
    return component;
  }
  if (component <= 0.0031308) {
    return component * 12.92;
  }
  return 1.055 * Math.pow(component, 1 / 2.4) - 0.055;
}

export function threeColorToFbxColor(color, fallback = [0.8, 0.8, 0.8]) {
  if (!color) {
    return fallback;
  }
  if (Array.isArray(color) || ArrayBuffer.isView(color)) {
    return [
      finiteColorValue(color[0], fallback[0]),
      finiteColorValue(color[1], fallback[1]),
      finiteColorValue(color[2], fallback[2])
    ];
  }
  return [
    linearColorComponentToFbx(color.r ?? fallback[0]),
    linearColorComponentToFbx(color.g ?? fallback[1]),
    linearColorComponentToFbx(color.b ?? fallback[2])
  ];
}

export function colorKeyframesToFbx(keyframes) {
  return keyframes.map((keyframe) => ({
    ...keyframe,
    value: (keyframe.value || []).map((component) => linearColorComponentToFbx(component))
  }));
}

export function colorComponentKeyframesToFbx(keyframes) {
  return keyframes.map((keyframe) => ({
    ...keyframe,
    value: linearColorComponentToFbx(keyframe.value)
  }));
}
