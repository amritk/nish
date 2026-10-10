// The module declares its own `toU32`, so the credited guard for a `u32`
// index, `toU32(i) < toU32(xs.length)`, would call it rather than the
// builtin. NL9007 offers no guard spelling.
const toU32 = (x: i32): i32 => x

export const sumAt = (xs: i32[], idx: u32[]): i32 => {
  let total = toU32(0)
  for (const i of idx) {
    total = total + xs[i]
  }
  return total
}
