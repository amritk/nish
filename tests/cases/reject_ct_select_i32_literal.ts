// WP34 N6: the operand type is judged before a literal is measured against it,
// so an i32 mask is told the types the builtin takes (NL2399), not that
// 0x80000000 does not fit in i32.
export const pick = (mask: i32): i32 => ctSelect(mask, 0x80000000, 0);
