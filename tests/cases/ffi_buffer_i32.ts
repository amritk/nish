// WP89 S2: two `i32` buffers in one run share the one count after it, in
// elements: `add_i32` writes `n` sums into `dst` and reads `n` from `src`.
// The count is held to both lengths before C runs: it is `dst`'s own
// length, so only `src` keeps an `ffi-length` check, which passes.
declare function add_i32(dst: i32[], src: readonly i32[], n: u64): void

export const run = (): i32 => {
  const dst: i32[] = [10, -20, 30]
  const src: i32[] = [1, 2, -3]
  add_i32(dst, src, toU64(dst.length))
  if (dst.length !== 3) {
    return -1
  }
  console.log(`${dst[0]} ${dst[1]} ${dst[2]}`)
  return dst[0] + dst[1] + dst[2]
}
