// --deny-panics reads `toU8(c)` as `c` only when `c` fits a u8: `toU8(300)`
// is not 300, so the comparison proves nothing about the divisor.
export const rem = (a: u8, b: u8): u8 => (b === toU8(300) ? a : a % b);
