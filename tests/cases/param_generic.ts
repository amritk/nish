// A generic function takes a rest of its type parameter, and a default on a
// parameter whose type is concrete.
function first<T>(fallback: T, ...xs: T[]): T {
  return xs.length > 0 ? xs[0] : fallback
}

function pick<T>(xs: T[], at: number = 0): T {
  return xs[at]
}

export const twice = (n: number = 21): number => n * 2

export function main(): void {
  console.log(first(7))
  console.log(first(7, 8, 9))
  console.log(first("none"))
  console.log(first("none", "s", "t"))
  console.log(pick([4, 5, 6]))
  console.log(pick(["p", "q"], 1))
  console.log(twice())
  console.log(twice(4))
}
