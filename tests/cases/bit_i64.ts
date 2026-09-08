// The same opcodes at 64 bits, with the shift count masked to 63 and typed
// `i64`, because LLVM requires both operands of a shift to have one type. The
// literal counts take that type from context, like every other operand here.
function mask(a: i64, b: i64): i64 {
  return (a & b) | (a ^ b);
}

function shift(a: i64, n: i64): i64 {
  return (a << n) + (a >> 4) + (a >>> 1);
}

export function test(): number {
  return toI32(mask(255, 15)) + toI32(shift(1024, 3));
}
