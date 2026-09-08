// A fixture for the WP8 N-API bridge (the interop section of `tests/run.js`)
// and for `tests/self/interop_oracle.js`: the numeric widths at a *plain*
// parameter and a plain return.
//
// `interop_payloads.ts` next door carries the narrow widths inside a packed
// `Result`; the shim reached those through the `Result` reader and skipped
// them anyway, because its scalar table had no row for `u8`, `u16`, `u32`,
// `u64` or `f32` at all. Every function here is an identity or a single
// operation, so a host asserts the value that came back rather than the
// arithmetic: what is under test is the crossing.

export function echoU8(x: u8): u8 {
  return x;
}

export function echoU16(x: u16): u16 {
  return x;
}

export function echoU32(x: u32): u32 {
  return x;
}

export function echoU64(x: u64): u64 {
  return x;
}

export function echoF32(x: f32): f32 {
  return x;
}

/** All four number-sized widths in one call, widened into the one type that carries them all. */
export function mixWidths(a: u8, b: u16, c: u32, d: f32): f64 {
  return toF64(a) + toF64(b) + toF64(c) + toF64(d);
}

/** A `u32` result above 2**31: `napi_create_int32` would hand JavaScript its negative twin. */
export function highBit(): u32 {
  return 4294967295;
}

/** A packed `Result` whose arms are both narrower than the getters that read them. */
export function halve(n: f32): Result<f32, u8> {
  if (n < 0.0) {
    return Err(toU8(255));
  }
  return Ok(n / 2.0);
}

/** The same `Result` on the way in, so the reader's narrowing runs on both arms. */
export function orError(r: Result<f32, u8>): f32 {
  if (r.isErr()) {
    return toF32(r.error);
  }
  return r.value;
}
