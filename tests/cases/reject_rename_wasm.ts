// `renameSync` reaches the file system, which a freestanding wasm32 build has
// none of; `--target wasi` has one and takes it.
export const move = (): i32 => renameSync("a", "b");
