// `f32` and `f64` are different types, exactly as `i32` and `i64` are: there
// is no implicit widening. Convert with toF64(a) or toF32(b).
function f(a: f32, b: f64): f64 {
  return a + b;
}
