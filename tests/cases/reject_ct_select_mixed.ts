// WP34 N6: the mask has the operands' own width; a u32 mask over u64 values
// would leave the top half of the word unselected (NL2400).
export const pick = (mask: u32, a: u64, b: u64): u64 => ctSelect(mask, a, b);
