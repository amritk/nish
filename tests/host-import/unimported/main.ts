// The program of tests/run.js's unimported-export check: it imports `first`
// and not `setupCounter`, which the page calls itself.
import { first } from "./counter"

export function next(x: i32): i32 {
  return first(x)
}
