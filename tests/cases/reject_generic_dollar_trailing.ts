// #610: a hidden function that C could spell takes a `$` at the end of its
// symbol (`@read$`), which is unique only because no declared name may hold a
// `$`. A function declared with that spelling is refused, so it can never be
// the symbol another function was renamed to.
const read$ = (n: i32): i32 => n + 1;

export const test = (): number => read$(1);
