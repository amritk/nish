// A compound integer division can panic exactly as `a / b` can, so the
// function that contains one must lose `willreturn` and `readnone` — the
// checker resolves `x /= k` as an assignment *target* and records no type for
// `x`, which is where the fact used to go missing. One function per target
// shape, and the golden is the attribute group they share.
class Box {
  v: i32 = 10;
}
export function localDiv(k: i32): i32 {
  let x = 10;
  x /= k;
  return x;
}
export function fieldDiv(b: Box, k: i32): i32 {
  b.v %= k;
  return b.v;
}
export function plainDiv(a: i32, k: i32): i32 {
  return a / k;
}
