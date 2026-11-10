// On a page module a float `%` is `std/math.ts`'s `fmodF64`, copied in as `internal`
// `@nish.fmodF64`: freestanding wasm links no libm, and `frem` would leave `fmod`
// undefined. An f32 remainder widens to f64 and narrows back, which is exact. An
// integer `%` stays `srem` and copies nothing more.
export function remF64(x: f64, y: f64): f64 {
  return x % y
}

export function remF32(x: f32, y: f32): f32 {
  let r = x
  r %= y
  return r
}

export function remI32(x: i32, y: i32): i32 {
  return x % y
}
