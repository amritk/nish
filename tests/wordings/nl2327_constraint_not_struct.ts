// NL2327: a constraint that is not a class or interface (WP18 G6). The members
// a constrained parameter has are its constraint's, and `string` lends none a
// template could read through a `T`.
export const echo = <T extends string>(s: T): T => s;

export const main = (): i32 => 0;
