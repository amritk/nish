// NL7002: under --unchecked-indexing, each index the flag leaves unchecked is
// reported where it is, with the `nish:unsafe` call that keeps it unchecked
// once the flag is gone.
export const at = (xs: i32[], k: i32): i32 => xs[k];
