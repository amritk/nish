// The program of tests/run.js's `host-import` section: each export calls one host
// function of ./host, so the round trip sees every kind of value cross both ways.
import { Canvas, hBool, hCanvas, hF32, hF64, hI32, hI64, hNext, hPercent, hSame, hU8, hU16, hU32, hU64, Mode } from "./host"

export const rI32 = (x: i32): i32 => {
  return hI32(x)
}
export const rU8 = (x: u8): u8 => {
  return hU8(x)
}
export const rU16 = (x: u16): u16 => {
  return hU16(x)
}
export const rU32 = (x: u32): u32 => {
  return hU32(x)
}
export const rF32 = (x: f32): f32 => {
  return hF32(x)
}
export const rF64 = (x: f64): f64 => {
  return hF64(x)
}
export const rBool = (x: boolean): boolean => {
  return hBool(x)
}
export const rI64 = (x: i64): i64 => {
  return hI64(x)
}
export const rU64 = (x: u64): u64 => {
  return hU64(x)
}
export const rPercent = (x: i32): i32 => {
  return hPercent(x)
}
// An enum does not cross a wasm export, so the page names one by a boolean.
export const rNext = (stroke: boolean): boolean => {
  return hNext(stroke ? Mode.Stroke : Mode.Clip) === Mode.Clip
}
export const rCanvas = (name: i32): Canvas => {
  return hSame(hCanvas(name))
}
export const sameCanvas = (c: Canvas): boolean => {
  return hSame(c) === c
}
