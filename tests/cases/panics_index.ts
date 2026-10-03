// Panic sites (docs/LANGUAGE.md): an index the checker cannot prove is an
// `index` site; the same access behind a guard is listed as proven, and its
// function has no bounds check in the IR.
const at = (xs: i32[], i: i32): i32 => xs[i]

const guarded = (xs: i32[], i: i32): i32 => {
  if (i >= 0 && i < xs.length) {
    return xs[i]
  }
  return -1
}

export const main = (): number => {
  const xs: i32[] = [10, 20, 30]
  let sum: i32 = 0
  for (let i: i32 = 0; i < 4; i++) {
    sum = sum + guarded(xs, i)
  }
  console.log(sum)
  console.log(at(xs, toI32(xs.length) - 1))
  return 0
}
