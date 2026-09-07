// `f32` is LLVM `float`: the same instructions as `f64`, one width down.
// Division is never checked (that is an integer rule), and `-x` is `fneg`.
export function arith(a: f32, b: f32): f32 {
  return (a + b) * (a - b) / b;
}

export function rem(a: f32, b: f32): f32 {
  return a % b;
}

export function cmp(a: f32, b: f32): boolean {
  return a < b;
}

export function neg(a: f32): f32 {
  return -a;
}
