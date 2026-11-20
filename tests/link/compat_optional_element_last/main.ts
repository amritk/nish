// NL1067: under the compatibility dialect an element read may sit inside a
// `?.` chain, but not end it: past the end of the array Node answers
// `undefined` and takes the default, where the bounds check would panic.
const first = (xs: i32[] | null): i32 => xs?.[0] ?? -1;

export const main = (): i32 => first([42]) - 42;
