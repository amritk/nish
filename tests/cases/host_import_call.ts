// A wasm module calling two functions of the page's host module: each is a
// `declare` carrying `wasm-import-module "host"` and its own name, and the
// call passes the handle and the u8 as they stand.
import { Canvas, shade, width } from "../host-import/golden"

export function wider(c: Canvas): i32 {
  return width(c) + 1
}
export function darker(level: u8): u8 {
  return shade(level) - 1
}
