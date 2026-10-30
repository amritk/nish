import { i32x4, splatF32x4, extract, replace } from "nish:simd"

export const lanes = (a: i32, b: i32): i32 => {
  const v = replace(i32x4(a, b, 3, 4), 2, a)
  return extract(v, 2)
}

export const broadcast = (x: f32): f32 => extract(splatF32x4(x), 3)
