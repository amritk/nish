// WP34 N6: a narrow unsigned word is refused too: the builtins work on the
// u32 and u64 limbs crypto code is written in, so widen a byte first (NL2399).
export const same = (a: u8, b: u8): u8 => ctEq(a, b);
