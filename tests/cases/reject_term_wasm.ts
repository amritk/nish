// `nish:term` on a freestanding wasm32 build, whose runtime has no stdin. The
// wasi profile accepts it.
export const keys = (buf: u8[]): i32 => readStdin(buf, 0, buf.length);
