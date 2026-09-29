// WP34 N6: a literal operand takes the unsigned type of the others, and a
// fraction is not an integer of any width (NL2222).
export const pick = (a: u32, b: u32): u32 => ctSelect(0.5, a, b);
