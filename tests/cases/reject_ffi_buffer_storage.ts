// WP89 S2: module storage does not lend to a declared C function. A
// `Float32Array` lends only to a parameter of a function written in Nish,
// whose body the compiler reads; C's is unseen, so the storage itself is
// refused as an argument. Copy it into an `f32[]` local and pass that.
declare function scale_f32(xs: f32[], n: u64, k: f32): void

const SAMPLES = new Float32Array(4)

export const main = (): i32 => {
  scale_f32(SAMPLES, toU64(SAMPLES.length), toF32(2))
  return 0
}
