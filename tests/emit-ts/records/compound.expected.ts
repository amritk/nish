// An i32 compound store through an index no caller proves: the slot is read
// through its bounds check, the checked operation runs, and only then is the
// value stored, so an overflow panics with the slot unchanged and nothing
// printed after it.
import { idx, checkedAdd, setIdx } from "nish/runtime"
import type { i32 } from "nish/runtime"
const bump = (a: i32[], k: i32, by: i32): i32 => {
  setIdx(a, k, checkedAdd(idx(a, k), by));
  return a[k];
};

export const main = (): i32 => {
  const a = [5, 2147483646, 7];
  const ks = [2, 1];
  console.log(`${bump(a, ks[0], 10)} ${a[2]}`);
  console.log(`${bump(a, ks[1], 1)} ${a[1]}`);
  console.log(bump(a, ks[1], 1));
  console.log("unreachable");
  return 0;
};
