import { finiteNumber, vector } from "./value-normalizers.js";

export const LIGHT_COLOR_ANIMATION_PROPERTIES = new Set(["lightColor"]);
export const LIGHT_SCALAR_ANIMATION_PROPERTIES = new Set([
  "lightIntensity",
  "lightDistance",
  "lightInnerAngle",
  "lightOuterAngle"
]);

function normalizeLightKind(light) {
  const kind = String(light.kind || light.type || "point").toLowerCase();
  if (kind.includes("directional") || kind.includes("sun")) {
    return "directional";
  }
  if (kind.includes("spot")) {
    return "spot";
  }
  return "point";
}

function normalizedPenumbra(light) {
  if (light.penumbra == null) {
    return null;
  }
  return Math.max(0, Math.min(1, finiteNumber(light.penumbra, 0)));
}

function normalizeLightAngles(light) {
  const outerAngle = finiteNumber(light.outerAngle ?? light.spotOuterAngle ?? light.angle, 45);
  const penumbra = normalizedPenumbra(light);
  const penumbraInnerAngle = penumbra == null ? undefined : outerAngle * (1 - penumbra);
  return {
    innerAngle: finiteNumber(
      light.innerAngle ?? light.spotInnerAngle ?? light.hotSpotAngle ?? penumbraInnerAngle ?? light.angle,
      Math.min(40, outerAngle)
    ),
    outerAngle
  };
}

export function normalizeLight(light, index) {
  const angles = normalizeLightAngles(light);
  return {
    name: light.name || `Light_${index + 1}`,
    parent: light.parent || null,
    transform: light.transform,
    visibility: light.visibility,
    kind: normalizeLightKind(light),
    color: vector(light.color, 3, [1, 1, 1]),
    intensity: finiteNumber(light.intensity, 1),
    distance: finiteNumber(light.distance ?? light.farAttenuationEnd, 0),
    enabled: light.enabled ?? light.castLight ?? true,
    ...angles
  };
}

export function normalizeLightAnimationProperty(property) {
  if (property === "lightColor") {
    return "lightColor";
  }
  if (property === "lightIntensity" || property === "intensity") {
    return "lightIntensity";
  }
  if (property === "lightDistance" || property === "farAttenuationEnd" || property === "distance") {
    return "lightDistance";
  }
  if (property === "lightInnerAngle" || property === "innerAngle" || property === "spotInnerAngle" || property === "hotSpotAngle") {
    return "lightInnerAngle";
  }
  if (property === "lightOuterAngle" || property === "outerAngle" || property === "spotOuterAngle" || property === "spotAngle" || property === "coneAngle") {
    return "lightOuterAngle";
  }
  return null;
}

export function isLightAnimationProperty(property) {
  return LIGHT_COLOR_ANIMATION_PROPERTIES.has(property) || LIGHT_SCALAR_ANIMATION_PROPERTIES.has(property);
}

export function isLightScalarAnimationProperty(property) {
  return LIGHT_SCALAR_ANIMATION_PROPERTIES.has(property);
}
