// WP34 N6: ctEq compares two words of one width, and there is no implicit
// conversion anywhere in the language (NL2400).
export const same = (a: u64, b: u32): u64 => ctEq(a, b);
