// A wasm module handing strings to the page's host module (WP50 stage 4): a
// string argument is its UTF-8 bytes, lent for the call, so the import takes
// the data pointer and the byte count, each an i32, and the call reads both
// from the string's header. A string result of an export is decoded by the
// loader; the IR returns the header pointer as it does natively.
import { measure, say } from "../host-import/text/host"

export function greet(n: i32): i32 {
  say(`hello ${n}`)
  return measure("é", n)
}
export function label(n: i32): string {
  return `#${n}`
}
