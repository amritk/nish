// The entry module imports the opaque class and the C functions and calls
// them directly: the same buffer, count and escape rules as a declaration of
// its own, the same `declare` and the same call in its IR.
import { Counter, counter_new, counter_bump, counter_free } from "./sys"
import { countFrom } from "./lib"

export const main = (): i32 => {
  const c: Counter | null = counter_new(40)
  if (c === null) {
    return 1
  }
  counter_bump(c, 1)
  console.log(counter_bump(c, 1))
  counter_free(c)
  console.log(countFrom(7, 3))
  return 0
}
