// No call into a caller contract hides in a module constant's initializer,
// outside every function's calls (docs/LANGUAGE.md, "Panic sites"): an
// initializer is a literal, another constant or arithmetic over them, so
// `cell(...)` there is refused before any contract is judged.
import { done } from "./done"

const cell = (xs: i32[], at: i32): i32 => {
  if (at < 0 || at >= toI32(xs.length)) {
    panic("cell: the index is outside the array")
  }
  return at
}

const early: i32 = cell([1, 2, 3], 7)

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3]
  console.log(`${cell(xs, 2)} ${early}`)
  console.log(done())
  return 0
}
