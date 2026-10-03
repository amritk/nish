// Typed literals for the QUIC checks. A literal passed to a method keeps the
// number mode's default type, which under `--number-mode f64` is not an
// integer; one passed to a function takes the parameter's type, so these two
// turn a literal into the width a check compares against.

/** `v` as an `i32`. */
export const n32 = (v: i32): i32 => v;
/** `v` as an `i64`. */
export const n64 = (v: i64): i64 => v;
