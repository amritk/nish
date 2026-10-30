// Each constructor takes one value per lane; `store` is a statement.
import { i32x4, loadI32x4, store } from "nish:simd";

export const f = (): i32x4 => i32x4(1, 2, 3);
export const g = (xs: i32[]): i32x4 => loadI32x4(xs);
export const h = (v: i32x4, xs: i32[]): i32 => {
  const r = store(v, xs, 0);
  return 0;
};
