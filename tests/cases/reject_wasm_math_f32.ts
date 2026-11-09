// On a page module `Math.sin` is `std/math.ts`'s `sinF64`, and it keeps the
// builtin's rule: the argument is an f64, and an f32 is not widened for it.
export function wave(x: f32): f32 {
  return Math.sin(x)
}
