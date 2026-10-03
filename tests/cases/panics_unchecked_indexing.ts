// Panic sites: `--unchecked-indexing` drops the bounds check without proving
// it, so the access is still an unproven `index` site, and so is the call
// into the function that makes it.
const at = (xs: i32[], i: i32): i32 => xs[i]

const twice = (xs: i32[], i: i32): i32 => at(xs, i) * 2

export const main = (): number => {
  const xs: i32[] = [3, 4, 5]
  console.log(twice(xs, toI32(xs.length) - 2))
  return 0
}
