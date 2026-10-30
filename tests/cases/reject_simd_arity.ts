// Each constructor takes one value per lane, every other call its fixed
// count; `store` is a statement.
import { i32x4, loadI32x4, store, extract, replace, splatI32x4 } from "nish:simd";

export const f = (): i32x4 => i32x4(1, 2, 3);
export const g = (xs: i32[]): i32x4 => loadI32x4(xs);
export const h = (v: i32x4, xs: i32[]): i32 => {
  const r = store(v, xs, 0);
  return 0;
};
export const j = (v: i32x4): i32 => extract(v);
export const k = (v: i32x4): i32x4 => replace(v, 0);
export const m = (): i32x4 => splatI32x4(1, 2);
