function hypot(a: number, b: number): number {
  return Math.sqrt(a * a + b * b);
}

function roundHalfUp(x: number): number {
  return Math.round(x);
}

function clamp01(x: number): number {
  return Math.min(Math.max(x, 0), 1);
}
