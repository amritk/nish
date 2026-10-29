// `createFileExclusiveSync` is refused on freestanding wasm32 as `writeFileSyncMode` is.
export const lock = (): i32 => createFileExclusiveSync("a.lock", "", 0o600);
