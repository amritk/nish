// An import renamed to `toI32` gets the module no review edit, even unused:
// the edit would call the import. The spec's own text is the bound name.
import { wrappingMul as toI32 } from "nish:unsafe"

const f = (a: i32, b: i32): i32 => a / b

export const main = (): i32 => {
  console.log(`${f(17, 4)}`)
  return 0
}
