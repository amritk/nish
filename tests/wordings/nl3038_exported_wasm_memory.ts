// NL3038: an exported function named `memory` in a wasm build. `wasm-ld`
// exports the module's linear memory under that name, so the function would be
// a second `memory` export and Node would refuse the module; it is refused
// rather than renamed, because an exported name is the program's ABI.
export const memory = (n: i32): i32 => n + 1;

export const main = (): i32 => memory(41);
