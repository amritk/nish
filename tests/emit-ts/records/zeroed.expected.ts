// `new Array<T>(n)` is filled with T's zero, and `dst.set(src, at)` copies
// into the array in place.
import { newArray, arraySet, idx } from "nish/runtime"
import type { i32, i64, u8 } from "nish/runtime"
export const main = (): number => {
  const n: i32 = 4;
  const xs = newArray(n, 0);
  const big = newArray(2, 0n);
  const flags = newArray(2, false);
  const bytes: u8[] = newArray(6, 0);
  const src: u8[] = [1, 2, 3];
  arraySet(bytes, src, 2);
  console.log(`${idx(xs, 3)} ${idx(big, 1)} ${idx(flags, 0)} ${idx(bytes, 0)} ${idx(bytes, 2)} ${idx(bytes, 4)} ${idx(bytes, 5)}`);
  return 0;
};
