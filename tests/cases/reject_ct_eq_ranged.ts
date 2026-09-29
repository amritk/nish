// WP34 N6: a ranged integer is an i32 underneath (the message names it so),
// and a mask is not a value in a range; widen it with toU32 first (NL2399).
export const same = (a: integer<0, 255>, b: integer<0, 255>): u32 => ctEq(a, b);
