// `xs[i()] /= 2` rewritten as `xs[i()] = toI32(xs[i()] / 2)` would call `i`
// twice: only a plain name gets the review edit.
const i = (): i32 => 0

export const main = (): i32 => {
  const xs: i32[] = [9]
  xs[i()] /= 2
  console.log(`${xs[0]}`)
  return 0
}
