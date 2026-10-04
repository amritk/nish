// NL7002: `pop` checks that the array holds an element, and `nish:unsafe` has
// no unchecked form of it.
export const last = (xs: i32[]): i32 => xs.pop();
