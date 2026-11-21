// --deny-panics drops the `new Array` length check only for a named constant
// in [0, 2^31 - 1]: a negative one is still checked, and so refused.
const M: i32 = -1;
export const make = (): u32[] => new Array<u32>(M);
