// #461, under --number-mode f64: `xs.length` is an `f64` there, and `toU32`
// lowers it with the saturating `llvm.fptoui.sat`, which never answers past
// the length, so the unsigned guard `toU32(i) < toU32(xs.length)` is credited
// as it is in i32 mode: the golden has no `nish_panic_index` call.
const at32 = (xs: i32[], i: u32): i32 => {
  if (i < toU32(xs.length)) {
    return xs[i]
  }
  return -1
}

const at8 = (xs: i32[], i: u8): i32 => {
  if (!(toU32(i) < toU32(xs.length))) {
    panic("index out of range")
  }
  return xs[i]
}

const sum = (xs: i32[], n: u32): i32 => {
  let s: i32 = 0
  let i: u32 = toU32(0)
  while (i < n) {
    if (toU32(i) < toU32(xs.length)) {
      s = s + xs[i]
    }
    i = i + toU32(1)
  }
  return s
}

export const main = (): i32 => {
  const xs: i32[] = [10, 20, 30]
  console.log(`${at32(xs, toU32(2))} ${at32(xs, toU32(3))} ${at32(xs, toU32(4000000000))} ${at8(xs, toU8(1))}`)
  console.log(`${sum(xs, toU32(7))}`)
  return 0
}
