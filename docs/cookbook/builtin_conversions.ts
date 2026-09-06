function widen(n: number): i64 {
  return toI64(n);
}

function narrow(x: f64): number {
  return toI32(x);
}

function toDouble(n: number): f64 {
  return toF64(n);
}
