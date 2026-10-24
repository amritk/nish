// An i32 addition that overflows panics under Node as it does natively: the
// same message on stderr, exit 1, and nothing printed after it.
import { checkedAdd } from "nish/runtime"
import type { i32 } from "nish/runtime"
const add = (a: i32, b: i32): i32 => checkedAdd(a, b)

export const main = (): i32 => {
  console.log(add(1, 2))
  console.log(add(2147483647, 1))
  console.log("unreachable")
  return 0
}
