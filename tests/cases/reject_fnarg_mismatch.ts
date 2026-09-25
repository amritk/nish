// WP29: a function argument must have exactly its parameter type, because
// the template body calls it with those types and reads that result.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

const widen = (x: i32): i64 => toI64(x);

export const main = (): i32 => apply(widen, 2);
