// WP34 N6: an f32 is a float, not a word a mask can be made of (NL2399).
export const same = (a: f32, b: f32): f32 => ctEq(a, b);
