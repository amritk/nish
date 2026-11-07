// The host module of tests/cases/host_import_call: two host functions, one
// taking a handle and one an unsigned narrow width, so the golden IR shows the
// import of each and the `zeroext` the wasm backend reads.
import type { i32, u8 } from "nish"

export type Canvas = HostHandle<"canvas">

export function width(c: Canvas): i32 {
  return 0
}
export function shade(level: u8): u8 {
  return level
}
