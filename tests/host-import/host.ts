// The host module of tests/run.js's `host-import` section: one host function per
// kind of value that crosses (WP50 stage 2), each doing something the round trip can
// see. A conversion the loader makes shows here as a value the plain function
// would get wrong: `hU8` returns past 255, `hU32` is handed 2^32 - 1, `hBool`
// throws on anything but a boolean.
import type { f32, f64, i32, i64, integer, u8, u16, u32, u64 } from "nish"

export type Canvas = HostHandle<"canvas">

export enum Mode {
  Fill,
  Stroke,
  Clip,
}

export function hI32(x: i32): i32 {
  return x * 2
}
export function hU8(x: u8): u8 {
  return x + 300
}
export function hU16(x: u16): u16 {
  return x + 70000
}
export function hU32(x: u32): u32 {
  return x + 1
}
export function hF32(x: f32): f32 {
  return x * 2
}
export function hF64(x: f64): f64 {
  return x / 4
}
export function hBool(x: boolean): boolean {
  if (typeof x !== "boolean") {
    throw new TypeError("hBool: not a boolean")
  }
  return !x
}
export function hI64(x: i64): i64 {
  return x - 1n
}
export function hU64(x: u64): u64 {
  if (x < 0n) {
    throw new RangeError("hU64: negative")
  }
  return x + 1n
}
export function hPercent(x: i32): integer<0, 100> {
  return x
}
export function hNext(m: Mode): Mode {
  return m === Mode.Clip ? Mode.Fill : m + 1
}
const canvases: string[] = ["none"]
export function hCanvas(name: i32): Canvas {
  canvases.push(`canvas${name}`)
  return (canvases.length - 1) as Canvas
}
export function hSame(c: Canvas): Canvas {
  return c
}
