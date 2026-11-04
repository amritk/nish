// A mask is made by a lane-wise compare, not by its name: `mask32x4` is a
// type, and the lanes a mask can hold are true and false of a compare.
import { i32x4, mask32x4, eq } from "nish:simd";

export const f = (a: i32x4): i32 => {
  const m: mask32x4 = mask32x4(true, false, true, false);
  return 0;
};
