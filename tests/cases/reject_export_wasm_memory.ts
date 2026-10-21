// #643: `wasm-ld` exports a wasm module's linear memory as `memory`, so an
// exported function of that name makes a second export of it, and Node refuses
// the module ("Duplicate export name 'memory'"). A native build accepts it
// (`export_memory_native`).
export const memory = (n: i32): i32 => n + 1;

export const main = (): i32 => memory(41);
