// `~` needs an integer: JavaScript's `~2.5` truncates through ToInt32 first,
// and AmritScript never converts implicitly (write `~toI32(a)`).
export function test(a: f64): f64 {
  return ~a;
}
