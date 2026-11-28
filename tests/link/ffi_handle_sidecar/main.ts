// WP89 S5a: imports the handle functions of `stack.ts` and uses them across
// the module boundary, then calls the C probe, which calls `twice` through
// the generated header.
import { openStack, depth } from "./stack"
import { probe } from "./sys"

export const main = (): i32 => {
  {
    using s = openStack(3)
    console.log(depth(s))
  }
  console.log(probe(20))
  return 0
}
