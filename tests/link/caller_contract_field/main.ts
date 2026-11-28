// No call into a caller contract hides in a field's initializer, outside
// every function's calls (docs/LANGUAGE.md, "Panic sites"): a field
// initializer is a literal, so `cell(...)` there is refused before any
// contract is judged, and a call or a `new` that needs one runs in the
// constructor, whose calls are judged as any function's.
import { done } from "./done"

const cell = (xs: i32[], at: i32): i32 => {
  if (at < 0 || at >= toI32(xs.length)) {
    panic("cell: the index is outside the array")
  }
  return at
}

class Box {
  v: i32 = cell([1, 2], 9)
}

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3]
  console.log(`${cell(xs, 2)} ${new Box().v}`)
  console.log(done())
  return 0
}
