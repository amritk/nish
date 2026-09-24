// NL2333: `integer` written as a type. The name is reserved for ranged
// integers (WP31), which this compiler does not build yet.
const widen = (x: integer<i32>): i32 => 0;

export const main = (): i32 => widen(0);
