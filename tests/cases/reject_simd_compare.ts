// A vector has no `===`, `!==` or ordering: a lane-wise compare answers per
// lane, and under Node a vector is a typed array whose `===` is identity. An
// array's `indexOf` compares with `===`, so it is refused on vectors too.
import { i32x4, splatI32x4 } from "nish:simd";

export const f = (a: i32x4, b: i32x4): i32 => {
  let n = 0;
  if (a === b) n++;
  if (a !== b) n++;
  if (a < b) n++;
  if (a >= b) n++;
  return n;
};

export const g = (xs: i32x4[]): i32 => xs.indexOf(splatI32x4(0));

export const h = (a: i32x4, b: i32x4): boolean => a == b;
