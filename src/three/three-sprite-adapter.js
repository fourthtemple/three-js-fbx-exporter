function vector2Value(value, fallback) {
  return [
    Number.isFinite(value?.x) ? value.x : fallback[0],
    Number.isFinite(value?.y) ? value.y : fallback[1]
  ];
}

function rotate2([x, y], radians) {
  if (!radians) {
    return [x, y];
  }
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [
    x * cos - y * sin,
    x * sin + y * cos
  ];
}

function spriteVertex([x, y], center, rotation) {
  const aligned = [
    x - center[0] + 0.5,
    y - center[1] + 0.5
  ];
  const rotated = rotate2(aligned, rotation);
  return [rotated[0], rotated[1], 0];
}

export function isThreeSprite(object) {
  return Boolean(object?.isSprite || object?.type === "Sprite");
}

export function spriteToSceneGeometry(object) {
  const center = vector2Value(object?.center, [0.5, 0.5]);
  const rotation = Number.isFinite(object?.material?.rotation) ? object.material.rotation : 0;
  const corners = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5]
  ];
  const vertices = corners.flatMap((corner) => spriteVertex(corner, center, rotation));
  return {
    vertices,
    faces: [[0, 1, 2], [0, 2, 3]],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    uvs: [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1],
    uvSets: [{ name: "UVMap", uvs: [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1] }],
    colors: [],
    tangents: [],
    binormals: [],
    morphTargets: [],
    materialIndices: [0, 0]
  };
}
