// `mkdirSyncMode` is refused on freestanding wasm32 as `unlinkSync` is.
export const make = (): i32 => mkdirSyncMode("d", 0o700);
