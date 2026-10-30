// Lane arithmetic is not in this version: a vector has no operators, is not a
// condition and does not print. A nullable vector is `reject_simd_nullable`.
import { i32x4 } from "nish:simd";

export const f = (a: i32x4, b: i32x4): i32x4 => a + b;
export const g = (a: i32x4): i32x4 => -a;
export const h = (a: i32x4): i32 => (a ? 1 : 0);
export const j = (a: i32x4): void => {
  console.log(a);
  console.log(`${a}`);
};
