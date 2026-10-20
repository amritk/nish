// WP40 B1.2: C writes through a non-`readonly` `u8[]` it is passed, and the
// compiler records the write against the parameter the buffer came from. So
// the exported `fill`'s `b` keeps no `readonly` in the IR, renders in the C
// header as `nish_array *b` rather than `const`, and the wasm glue copies it
// back to the host's typed array after the call. `peek`, which only hands its
// buffer to a `readonly u8[]`, stays read-only.
declare function getentropy(buf: u8[], n: u64): i32;
declare function write(fd: i32, buf: readonly u8[], n: u64): i64;

export function fill(b: u8[]): i32 {
  return getentropy(b, toU64(b.length));
}

export function peek(b: u8[]): i64 {
  return write(1, b, toU64(b.length));
}

export function test(): i32 {
  const b = new Array<u8>(16);
  return fill(b);
}
