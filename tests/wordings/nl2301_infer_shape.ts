// NL2301: inference is unification against the annotation's *shape*, so an
// argument that does not have the shape binds nothing and the parameter is left
// with no type. Distinct from NL2299, which is the parameter that appears in no
// annotation at all, and from an ordinary argument-type error: here the failure
// is that `T` could not be chosen, not that a chosen `T` did not fit.
const firstOf = <T>(xs: T[]): T => xs[0];

export const main = (): i32 => firstOf(5);
