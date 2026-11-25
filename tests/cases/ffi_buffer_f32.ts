// WP89 S2: an `f32[]` is a buffer a declared C function borrows, like a
// `u8[]`. The count after it is in elements, not bytes: `scale_f32` writes
// `n` floats in place and `sum_f32` reads them back through a readonly
// buffer. Each count is the array's own length, proven, so neither call
// carries an `ffi-length` check (`ffi_buffer_counted_by` names an `f32[]`'s
// element count with `CountedBy`). `ys` is grown by `push` past its first
// capacity, so C is handed the data pointer of storage the array reallocated,
// not of a literal's.
declare function scale_f32(xs: f32[], n: u64, k: f32): void
declare function sum_f32(xs: readonly f32[], n: u64): f32

export const run = (): i32 => {
  const xs: f32[] = [toF32(1.5), toF32(2.5), toF32(3), toF32(-1)]
  scale_f32(xs, toU64(xs.length), toF32(2))
  if (xs.length === 4) {
    console.log(`scaled: ${xs[0]} ${xs[3]}`)
  }
  console.log(`sum: ${sum_f32(xs, toU64(xs.length))}`)
  const ys: f32[] = []
  let i = 0
  while (i < 64) {
    ys.push(toF32(i))
    i = i + 1
  }
  scale_f32(ys, toU64(ys.length), toF32(0.5))
  console.log(`grown: ${sum_f32(ys, toU64(ys.length))}`)
  return xs.length
}
