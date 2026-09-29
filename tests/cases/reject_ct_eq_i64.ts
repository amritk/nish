// WP34 N6: ctEq answers a mask of its operands' type, so a signed 64-bit
// operand is refused as a signed 32-bit one is (NL2399).
export const same = (a: i64, b: i64): i64 => ctEq(a, b);
