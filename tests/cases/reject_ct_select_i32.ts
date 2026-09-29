// WP34 N6: a mask is a bit pattern, and all-ones in a signed word reads as -1,
// so the constant-time builtins take the unsigned words only (NL2399).
export const pick = (mask: i32, a: i32, b: i32): i32 => ctSelect(mask, a, b);
