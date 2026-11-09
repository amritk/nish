// The host module of tests/run.js's `host-import-text` section (WP50 stage 4):
// each string the module hands the page is printed, so the round trip reads
// every argument as the page's own JS string.
import type { i32 } from "nish"

export function say(s: string): void {
  console.log(`say ${JSON.stringify(s)}`)
}

export function measure(s: string, tag: i32): i32 {
  console.log(`measure ${tag} ${JSON.stringify(s)}`)
  return s.length
}
