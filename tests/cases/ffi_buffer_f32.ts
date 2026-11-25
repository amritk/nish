// WP89 S2: an `f32[]` is a buffer a declared C function borrows, like a
// `u8[]`. The count after it is in elements, not bytes: `scale_f32` writes
// `n` floats in place and `sum_f32` reads them back through a readonly
// buffer. Each count is the array's own length, proven, so neither call
// carries an `ffi-length` check. `CountedBy` names an element count too.
declare function scale_f32(xs: f32[], n: u64, k: f32): void
declare function sum_f32(xs: readonly f32[], n: u64): f32
declare function first_f32(n: u32, xs: CountedBy<readonly f32[], "n">): f32

export const run = (): i32 => {
  const xs: f32[] = [toF32(1.5), toF32(2.5), toF32(3), toF32(-1)]
  scale_f32(xs, toU64(xs.length), toF32(2))
  if (xs.length === 4) {
    console.log(`scaled: ${xs[0]} ${xs[3]}`)
  }
  console.log(`sum: ${sum_f32(xs, toU64(xs.length))}`)
  console.log(`first: ${first_f32(toU32(xs.length), xs)}`)
  return xs.length
}
