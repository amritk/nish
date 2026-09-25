// NL2341: a generic function passed by name, which names a template and not
// one function.
const each = <T>(xs: T[], f: (x: T) => T): T[] => xs;

const keep = <T>(x: T): T => x;

export const main = (): i32 => each([1, 2], keep).length;
