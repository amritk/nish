// WP29: a generic function names no one function, so it cannot be passed by
// name; an arrow that calls it can.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

const identity = <T>(x: T): T => x;

export const main = (): i32 => apply(identity, 2);
