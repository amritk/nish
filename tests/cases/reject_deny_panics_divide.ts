// --deny-panics refuses a division by a divisor that may be 0, or -1 against
// the minimum, and names the guard that proves it neither.
export const ratio = (a: i32, d: i32): i32 => a / d;
