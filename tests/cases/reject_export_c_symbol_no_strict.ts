// #618: `--no-strict-exports` gives every function external linkage, so a
// function nobody exported keeps its name as its symbol as well. Without the
// flag this `read` is internal and compiles.
const read = (n: i32): i32 => n + 1;

export const main = (): i32 => read(1);
