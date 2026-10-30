// A `Map` key is hashed and compared with `===`, which a vector does not have.
import { i32x4 } from "nish:simd";

export const f = (): i32 => {
  const m = new Map<i32x4, i32>();
  return m.size;
};
