// The program of tests/run.js's host-bodies check: one call into the page.
import { bump } from "./host"

export function twice(by: i32): i32 {
  bump(by)
  return bump(by)
}
