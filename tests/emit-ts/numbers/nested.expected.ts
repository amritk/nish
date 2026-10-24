// `(a + b) * c` on i32 operands nothing bounds: both operations are checked,
// the inner one inside the outer one, and the parentheses stay.
import { checkedAdd, checkedMul } from "nish/runtime"
import type { i32 } from "nish/runtime"
const scaled = (a: i32, b: i32, c: i32): i32 => checkedMul((checkedAdd(a, b)), c)

export const main = (): i32 => {
  console.log(scaled(2, 3, 4))
  console.log(scaled(-7, 1, 300000))
  return 0
}
