// WP44 §9 Q7: a freestanding wasm32 build has no file system, so `fileOpen`
// is refused at check time (NL2718). `--profile wasi` reads through WASI.
export const open = (): i32 => fileOpen("data.bin");
