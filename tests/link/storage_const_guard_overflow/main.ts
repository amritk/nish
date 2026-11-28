// The storage prover's change lets a guard order a sum against a folded
// module constant (#2316), and the order it gives is only the one the guard
// states. Each sum here is refused in `main.ts`, which `noPanic` lists:
//   - `depth > LIMIT` returns, but LIMIT is the largest `i32`, so `depth + 1`
//     can still overflow;
//   - `depth < FLOOR` returns, which bounds `depth` from below, not above;
//   - `x > FLOOR` returns, so `x` is at most 1000 but may be far below it,
//     and `x - FLOOR` can still overflow.
const LIMIT: i32 = 2147483647
const FLOOR: i32 = 1000

const deeper = (text: string, at: i32, depth: i32): i32 => {
  if (at >= text.length || depth > LIMIT) {
    return -1
  }
  return deeper(text, at + 1, depth + 1)
}

const above = (text: string, at: i32, depth: i32): i32 => {
  if (at >= text.length || depth < FLOOR) {
    return -1
  }
  return above(text, at + 1, depth + 1)
}

const below = (x: i32): i32 => {
  if (x > FLOOR) {
    return 0
  }
  return x - FLOOR
}

export const main = (): i32 => {
  const a = deeper("ab", 0, parseInt("2147483647"))
  const b = above("ab", 0, parseInt("2147483647"))
  const c = below(parseInt("-2147483000"))
  return a === b && b === c ? 1 : 0
}
