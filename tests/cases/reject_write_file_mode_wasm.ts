// `writeFileSyncMode` is refused on freestanding wasm32 as `writeFileBytesSync` is.
export const save = (): i32 => writeFileSyncMode("a", "x", 0o600);
