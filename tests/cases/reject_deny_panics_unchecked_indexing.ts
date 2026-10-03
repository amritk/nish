// --unchecked-indexing is not a proof: under --deny-panics the index it left
// unchecked is still refused, and the error says why.
export const at = (xs: i32[], i: i32): i32 => xs[i];
