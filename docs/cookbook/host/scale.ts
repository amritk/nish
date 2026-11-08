import type { u32 } from "nish"

export function scale(xs: Float32Array, at: u32, n: u32): void {
  for (let i = at; i < at + n; i++) {
    xs[i] = xs[i] * 2
  }
}
