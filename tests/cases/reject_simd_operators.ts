// Lane arithmetic is a function of `nish:simd` (`add`, `addWrapping`, `neg`
// and the rest), not an operator: a vector has no operators, is not a
// condition and does not print, and nor is a mask, whose question is `any`
// or `all`. A nullable vector is `reject_simd_nullable`.
import { i32x4, eq } from "nish:simd";

export const f = (a: i32x4, b: i32x4): i32x4 => a + b;
export const g = (a: i32x4): i32x4 => -a;
export const h = (a: i32x4): i32 => (a ? 1 : 0);
export const j = (a: i32x4): void => {
  console.log(a);
  console.log(`${a}`);
};
export const k = (a: i32x4, b: i32x4): i32 => {
  const m = eq(a, b);
  console.log(m);
  return m ? 1 : 0;
};
