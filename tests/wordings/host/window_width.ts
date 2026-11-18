// The host module of the NL2683 case: a window's index is a wasm32 address, a `u32`.
import type { u32, u64 } from "nish"
export function fill(xs: Float32Array, at: u64, n: u32): void {
  xs[Number(at)] = n
}
