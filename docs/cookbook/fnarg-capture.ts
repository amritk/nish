// An arrow argument that reads a `const` of the function it is written in:
// `limit` is appended to the lifted arrow's parameters, and the instance of
// `countWhere` takes it as one more argument and passes it on.
const countWhere = (xs: i32[], keep: (x: i32) => boolean): i32 => {
  let n = 0
  for (const x of xs) {
    if (keep(x)) {
      n++
    }
  }
  return n
}

export const above = (xs: i32[], limit: i32): i32 => countWhere(xs, (x) => x > limit)
