// --deny-panics refuses `new Array<u8>(n)` of an `i32` nothing proves
// non-negative, and names the guard that would: an `i32` length is checked
// only for being negative.
export const make = (n: i32): u8[] => new Array<u8>(n);
