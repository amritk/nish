// #461: an unsigned index needs only the upper end of the guard, written
// `toU32(i) < toU32(xs.length)` (for a `u32`, `i < toU32(xs.length)` too): the
// compare is a `u32` one, the index's type is its lower end, and `toU32` of a
// length is never past it, so every access below is proven and the golden has
// no `nish_panic_index` call. The guard's `false` side skips the access or
// ends in `panic`, so an index past the end still never reaches it.
const at32 = (xs: i32[], i: u32): i32 => {
  if (i < toU32(xs.length)) {
    return xs[i]
  }
  return -1
}

const at16 = (xs: i32[], i: u16): i32 => (toU32(i) < toU32(xs.length) ? xs[i] : -1)

const at8 = (xs: i32[], i: u8): i32 => {
  if (!(toU32(i) < toU32(xs.length))) {
    panic("index out of range")
  }
  return xs[i]
}

const sum = (xs: i32[], n: u32): i32 => {
  let s = 0
  let i: u32 = 0
  while (i < n) {
    if (i < toU32(xs.length)) {
      s = s + xs[i]
    }
    i = i + toU32(1)
  }
  return s
}

export const main = (): i32 => {
  const xs: i32[] = [10, 20, 30]
  // `toU32(-5)` is 4294967291, which an `i32` compare would read as -5.
  console.log(`${at32(xs, 2)} ${at32(xs, 3)} ${at32(xs, toU32(-5))}`)
  console.log(`${at16(xs, toU16(1))} ${at16(xs, toU16(65535))} ${at8(xs, toU8(0))}`)
  console.log(`${sum(xs, 7)}`)
  return 0
}
