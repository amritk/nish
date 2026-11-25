// WP89 S2: a `u32[]` is a buffer a declared C function writes in place. The
// values `fill_u32` stored are the array's own afterwards, so Nish reads them
// back with ordinary indexing.
declare function fill_u32(xs: u32[], n: u64, step: u32): void

export const run = (): i32 => {
  const xs = new Array<u32>(4)
  fill_u32(xs, toU64(xs.length), toU32(3000000) * toU32(1000))
  if (xs.length === 4) {
    console.log(`${xs[0]} ${xs[1]} ${xs[3]}`)
  }
  return xs.length
}
