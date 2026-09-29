// WP34 N6: a boolean is not a mask. `ctEq` makes one without the compare a
// boolean would need, and that compare is what the builtin exists to avoid (NL2399).
export const pick = (a: u32, b: u32, x: u32, y: u32): u32 => ctSelect(a === b, x, y);
