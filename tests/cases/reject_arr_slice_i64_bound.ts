// An array's `slice` bounds are `number` only, where string `slice` takes any
// integer type. The message names the bound as written: argument 2 of `slice`,
// not counting the receiver.
export const main = (): number => {
  const xs: number[] = [3, 1, 2]
  const end: i64 = 2
  return xs.slice(0, end).length
}
