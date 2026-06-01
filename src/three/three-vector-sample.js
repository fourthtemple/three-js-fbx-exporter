export function vectorSampleValue(values, size, sampleIndex, zFallback = 0) {
  const component = (componentIndex, fallback) => {
    return componentIndex < size
      ? values[sampleIndex * size + componentIndex] ?? fallback
      : fallback;
  };
  return [
    component(0, 0),
    component(1, 0),
    component(2, zFallback)
  ];
}
