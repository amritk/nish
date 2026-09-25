// WP29 with WP18 G6: what a call through a function parameter answers is what
// its function type says, as the template wrote it, so `f(x)` is a `T` and has
// no members whatever the callee returns.
const measure = <T>(x: T, f: (a: T) => T): i32 => f(x).length;

const same = (s: string): string => s;

export const main = (): i32 => measure("abc", same);
