// The mask refusals a function body reaches: a mask as the element of an
// array literal and as a type argument of a `Map`. Neither has a layout a
// mask could take; what is stored is the vectors it selects or its `bitmask`.
import { i32x4, mask32x4, eq } from "nish:simd";

const n = (a: i32x4): i32 => {
  const xs = [eq(a, a)];
  return xs.length;
};
const k = (): i32 => {
  const m = new Map<i32, mask32x4>();
  return m.size;
};

export const main = (): number => {
  console.log(`${n(i32x4(1, 2, 3, 4))} ${k()}`);
  return 0;
};
