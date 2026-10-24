// An f64 compound store at a proven index whose right side shrinks the array:
// the read is proven, but the store checks the index again after the right
// side ran, so it panics rather than growing the array back, as native does.
import { pop, updIdx } from "nish/runtime"
import type { f64, i32 } from "nish/runtime"
const shrink = (xs: f64[]): f64 => {
  pop(xs);
  return 0.5;
};

export const main = (): i32 => {
  const xs: f64[] = [1.5, 2.5];
  if (xs.length > 1) {
    updIdx(xs, 1, (old) => old + shrink(xs));
  }
  console.log("unreachable");
  return 0;
};
