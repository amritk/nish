// An overloaded function keeps the strict refusal of a default that is not a
// constant under `optional-params`: its signatures name the implementation,
// which a wrapper would have to stand in front of.
const fresh = (): number[] => [1, 2]

function total(): number
function total(xs: number[]): number
function total(xs: number[] = fresh()): number {
  return xs.length
}

export const main = (): i32 => (total() === 2 ? 0 : 1)
