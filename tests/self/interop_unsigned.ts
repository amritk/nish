// The unsigned widths across the wasm boundary (WP8/WP15), for
// `tests/self/interop_oracle.js` and the WP8 section of `tests/run.js`.
//
// The wasm ABI has only i32 / i64 / f32 / f64, so `u8`, `u16` and `u32` all
// travel in the same value type as an `i32` and a `u64` in the same one as an
// `i64`. The generated loader is the only place their range can be restored,
// and each function here pins one half of that:
//
//   idU8, idU16     a narrow argument the loader has to mask on the way in;
//                   the callee is handed an i32 and the emitter puts no
//                   `zeroext` on the parameter
//   addU8, addU16   a narrow result the callee does *not* narrow: `add i8` is
//                   congruent modulo 256, so the wasm backend adds in 32 bits
//                   and hands back 300 where the language says 44
//   idU32, addU32   a u32 above 2^31, which comes back as a negative i32
//   idU64           a u64 above 2^63, which comes back as a negative bigint
//   widen           the one operation that already masks (`zext i8 to i32`)
//   scaleF32        f32, which needs nothing in either direction: the call
//                   rounds the argument and a float is exact in a double
//
// No strings and no arrays, so the module links under `--profile wasm` with
// nothing but its own code.
export function idU8(x: u8): u8 {
  return x;
}

export function addU8(a: u8, b: u8): u8 {
  return a + b;
}

export function idU16(x: u16): u16 {
  return x;
}

export function addU16(a: u16, b: u16): u16 {
  return a + b;
}

export function idU32(x: u32): u32 {
  return x;
}

export function addU32(a: u32, b: u32): u32 {
  return a + b;
}

export function idU64(x: u64): u64 {
  return x;
}

export function addU64(a: u64, b: u64): u64 {
  return a + b;
}

export function widen(x: u8): u32 {
  return toU32(x);
}

export function scaleF32(x: f32): f32 {
  return x * 2.0;
}
