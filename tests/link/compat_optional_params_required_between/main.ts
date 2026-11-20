// A required parameter between two defaults that are not constants keeps the
// strict refusal under `optional-params`: a wrapper that drops the argument
// after the first default would have none to pass for the required one.
const fresh = (): number[] => [1, 2]

const total = (xs: number[] = fresh(), n: number, ys: number[] = fresh()): number => {
  return xs.length + n + ys.length
}

export const main = (): i32 => (total(fresh(), 1) === 5 ? 0 : 1)
