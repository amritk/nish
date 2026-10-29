// `writeFileBytesSync` opens a file, and freestanding wasm32 has no file to open.
export const save = (bytes: readonly u8[]): i32 => writeFileBytesSync("a", bytes);
