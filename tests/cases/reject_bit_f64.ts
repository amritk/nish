// `&` has no f64 form: JavaScript's would run the double through ToInt32
// first, and StaticTS never converts implicitly.
function test(a: f64, b: f64): f64 {
  return a & b;
}
