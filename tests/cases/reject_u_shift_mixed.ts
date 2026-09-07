// The shift amount has the same type as the value: `>>` takes two operands of
// one integer type, like every other binary operator here.
function f(a: u32, n: i32): u32 {
  return a >> n;
}
