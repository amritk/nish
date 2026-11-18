// The page's half of tests/host-window: each function takes a buffer window,
// a view of all of wasm memory with the first element and count it may touch.
// The `double*` functions write through it; `sumF64` only reads.
import type { f32, f64, i32, u8, u16, u32 } from "nish"

export function doubleU8(xs: u8[], at: u32, n: u32): void {
  for (let i = at; i < at + n; i++) xs[i] *= 2
}

export function doubleU16(xs: Uint16Array, at: u32, n: u32): void {
  for (let i = at; i < at + n; i++) xs[i] *= 2
}

export function doubleU32(xs: u32[], at: u32, n: u32): void {
  for (let i = at; i < at + n; i++) xs[i] *= 2
}

export function doubleI32(xs: i32[], at: u32, n: u32): void {
  for (let i = at; i < at + n; i++) xs[i] *= 2
}

export function doubleF32(xs: Float32Array, at: u32, n: u32): void {
  for (let i = at; i < at + n; i++) xs[i] *= 2
}

export function sumF64(xs: readonly f64[], at: u32, n: u32): f64 {
  let s = 0
  for (let i = at; i < at + n; i++) s += xs[i]
  return s
}
