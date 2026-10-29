// `writeBytes` writes to descriptor 1, which freestanding wasm32 does not have:
// its `write` goes through the host instead.
export const send = (bytes: readonly u8[]): i32 => writeBytes(bytes, 0, 1);
