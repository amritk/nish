function clamp(x: number, lo: number, hi: number): number {
  return Math.min(Math.max(x, lo), hi);
}

function magnitude(x: number): number {
  return Math.abs(x);
}

function tau(): f64 {
  return Math.PI * 2;
}
