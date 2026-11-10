// Under `--deterministic` a native build takes the page module's route: a
// float `%` is `std/math.ts`'s `fmodF64`, copied in as `internal`, not `frem`,
// and `f64ToBits` / `f32ToBits` read a NaN as the canonical quiet one through
// `quietBitsF64` / `quietBitsF32`, so x86-64 (sign set) and AArch64 (sign
// clear) write the same bits.
export const main = (): i32 => {
  const zero: f64 = 0.0
  const nan: f64 = zero / zero
  const x: f64 = 7.5
  const y: f64 = 2.0
  const r: f64 = x % y
  console.log(r)
  console.log(f64ToBits(nan) === toI64(0x7ff8) << toI64(48) ? "quiet" : "other")
  console.log(f32ToBits(toF32(nan)) === 0x7fc00000 ? "quiet32" : "other32")
  return 0
}
