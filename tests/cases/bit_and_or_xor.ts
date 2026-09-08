// `& | ^` on two operands of the same integer type: one instruction each, no
// mask and no panic path, which is what separates them from `/` and `%`.
function mix(a: i32, b: i32): i32 {
  return (a & b) + (a | b) + (a ^ b);
}

export function test(): number {
  return mix(12, 10) + mix(-1, 255);
}
