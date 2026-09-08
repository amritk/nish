// `&` has no f64 form: JavaScript's would run the double through ToInt32
// first, and AmritScript never converts implicitly.
export function test(a: f64, b: f64): f64 {
  return a & b;
}
