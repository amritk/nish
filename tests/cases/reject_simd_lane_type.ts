// Each vector type is its own: an `i32x4` is not an `f32x4`, a `u8x16` is
// loaded from and stored to a `u8[]` and nothing else, and a lane takes a
// value of the lane type.
import { f32x4, i32x4, u8x16, splatI32x4, loadF32x4, loadU8x16, store, extract, replace } from "nish:simd";

export const f = (): f32x4 => {
  const f: f32x4 = splatI32x4(1);
  return f;
};

export const g = (xs: f64[]): f32x4 => loadF32x4(xs, 0);

export const h = (v: u8x16, xs: i32[]): void => {
  store(v, xs, 0);
};

export const j = (v: i32x4): i32x4 => replace(v, 0, 1.5);

export const k = (x: i32): i32 => extract(x, 0);

export const m = (xs: readonly u8[]): void => {
  store(loadU8x16(xs, 0), xs, 0);
};

export const n = (x: f64, xs: f64[]): void => {
  store(x, xs, 0);
};

export const p = (x: i32): i32 => {
  const r = replace(x, 0, 1);
  return 0;
};
