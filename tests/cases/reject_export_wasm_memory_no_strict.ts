// #643: `--no-strict-exports` gives every function external linkage, so a
// `memory` nobody exported is the module's second `memory` as well. Without the
// flag this one is internal and compiles on wasm32.
const memory = (n: i32): i32 => n + 1;

export const main = (): i32 => memory(41);
