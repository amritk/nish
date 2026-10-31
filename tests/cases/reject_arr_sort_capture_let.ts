// A comparator is an arrow argument like any other: it may read the caller's
// `const` locals and parameters (`arr_sort_capture`), but not a `let`, whose
// value at the call is not the one the comparator would see later.
export const main = (): number => {
  const xs = [3, 1, 2]
  let k = 2
  k = k + 1
  xs.sort((a, b) => a * k - b)
  return xs[0]
}
