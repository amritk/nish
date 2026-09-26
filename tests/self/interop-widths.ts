// A fixture for the WP8 N-API bridge (the interop section of `tests/run.js`)
// and for `tests/nish-cmp.js`: the numeric widths at a *plain*
// parameter and a plain return.
//
// `interop-payloads.ts` next door carries the narrow widths inside a packed
// `Result`; the shim reached those through the `Result` reader and skipped
// them anyway, because its scalar table had no row for `u8`, `u16`, `u32`,
// `u64` or `f32` at all. Every function here is an identity or a single
// operation, so a host asserts the value that came back rather than the
// arithmetic: what is under test is the crossing.

export const echoU8 = (x: u8): u8 => x

export const echoU16 = (x: u16): u16 => x

export const echoU32 = (x: u32): u32 => x

export const echoU64 = (x: u64): u64 => x

export const echoF32 = (x: f32): f32 => x

/** All four number-sized widths in one call, widened into the one type that carries them all. */
export const mixWidths = (a: u8, b: u16, c: u32, d: f32): f64 => toF64(a) + toF64(b) + toF64(c) + toF64(d)

/** A `u32` result above 2**31: `napi_create_int32` would hand JavaScript its negative twin. */
export const highBit = (): u32 => 4294967295

/** A packed `Result` whose arms are both narrower than the getters that read them. */
export const halve = (n: f32): Result<f32, u8> => {
  if (n < 0.0) {
    return Err(toU8(255))
  }
  return Ok(n / 2.0)
}

/** The same `Result` on the way in, so the reader's narrowing runs on both arms. */
export const orError = (r: Result<f32, u8>): f32 => {
  if (r.isErr()) {
    return toF32(r.error)
  }
  return r.value
}
