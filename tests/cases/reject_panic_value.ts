// `panic` ends the path; it is not an expression with a value.
function f(n: number): number {
  return panic("nope");
}
