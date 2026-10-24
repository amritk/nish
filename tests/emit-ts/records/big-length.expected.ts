// `new Array<T>(n)` at an i64 length: the length goes through `Number` and the
// array is still filled with T's zero, at an i32 and at an i64 element type.
import { newArray, idx, checkedAdd, setIdx } from "nish/runtime"
import type { i32, i64 } from "nish/runtime"
export const main = (): i32 => {
  const n: i64 = 3n;
  const xs = newArray(Number(n), 0);
  const ys = newArray(Number(n), 0n);
  setIdx(xs, 2, checkedAdd(idx(xs, 2), 4));
  console.log(`${xs.length} ${xs[0]} ${xs[2]} ${ys.length} ${idx(ys, 1)}`);
  return 0;
};
