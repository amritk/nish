// The host module of tests/run.js's `panic` section: the page's two functions,
// one that calls back into the module and one that throws.
import type { u32 } from "nish"

export function reenter(): u32 {
  return 0
}

export function boom(): void {}
