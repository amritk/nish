// NL7002: an access in a generic body is never fixed, because its types are
// decided per instantiation.
const pick = <T>(xs: T[], k: i32): T => xs[k];

export const both = (xs: i32[], names: string[], k: i32): i32 => pick(xs, k) + pick(names, k).length;
