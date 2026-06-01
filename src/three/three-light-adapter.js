import { RAD_TO_DEG } from "./three-transform-adapter.js";

export function threeLightKind(object) {
  if (object.isDirectionalLight || object.type === "DirectionalLight") {
    return "directional";
  }
  if (object.isSpotLight || object.type === "SpotLight") {
    return "spot";
  }
  return "point";
}

export function threeLightAngles(object) {
  const outerAngle = object.angle ? object.angle * RAD_TO_DEG : 45;
  const penumbra = Math.max(0, Math.min(1, object.penumbra ?? 0));
  return {
    innerAngle: object.angle ? outerAngle * (1 - penumbra) : 40,
    outerAngle
  };
}

export function lightAnimationParameters(object) {
  const angles = threeLightAngles(object);
  return {
    ...angles,
    penumbra: Math.max(0, Math.min(1, object.penumbra ?? 0))
  };
}

export function lightToSceneLight(object) {
  return {
    name: object.name || "Light",
    parent: null,
    transform: null,
    kind: threeLightKind(object),
    color: [
      object.color?.r ?? 1,
      object.color?.g ?? 1,
      object.color?.b ?? 1
    ],
    intensity: object.intensity ?? 1,
    distance: object.distance ?? 0,
    enabled: object.visible !== false,
    ...threeLightAngles(object)
  };
}
