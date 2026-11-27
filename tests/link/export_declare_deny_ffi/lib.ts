// An importer that is not the entry module: it calls the binding and exports
// a function of its own, so `ffi` reaches `main` through it as well.
import { counter_new, counter_bump, counter_free } from "./sys"

export const countFrom = (start: i32, steps: i32): i32 => {
  const c = counter_new(start)
  if (c === null) {
    return -1
  }
  let n = start
  for (let i = 0; i < steps; i++) {
    n = counter_bump(c, 1)
  }
  counter_free(c)
  return n
}
