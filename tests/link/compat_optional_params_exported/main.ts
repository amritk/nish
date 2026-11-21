// An exported function keeps the strict refusal of a default that is not a
// constant under `optional-params`: a call from another module would pass the
// argument it leaves out itself, with no wrapper to evaluate the default.
const fresh = (): number[] => [1, 2]

export const total = (xs: number[] = fresh()): number => {
  return xs.length
}

export const main = (): i32 => (total() === 2 ? 0 : 1)
