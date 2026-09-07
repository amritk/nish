function blend(a: f32, b: f32): f32 {
  return (a + b) / b;
}

function narrow(x: f64): f32 {
  return toF32(x);
}

function widen(x: f32): f64 {
  return toF64(x);
}

function truncate(x: f32): i32 {
  return toI32(x);
}

function tenth(): f32 {
  return 0.1;
}
