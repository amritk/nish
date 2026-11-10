// A callback may read the caller's `const` locals and parameters, but not a
// `let`, as for a `sort` comparator.
export const main = (): number => {
  const xs = [3, 1, 2]
  let k = 2
  k = k + 1
  const ys = xs.map((x) => x * k)
  return ys[0]
}
