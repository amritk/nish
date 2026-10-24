// A module that binds the names of the helpers its rewrites call: each
// helper is imported as `__nish_<name>` and called by that name, so the
// module's own `idx`, `pop` and `newArray` keep theirs. A store through
// `__nish_idx` is still a store (`corpus/arr_bounds_edge`).
import { idx as __nish_idx, pop as __nish_pop, checkedSub, checkedAdd, setIdx, newArray as __nish_newArray } from "nish/runtime"
import type { i32 } from "nish/runtime"
const pop = (n: i32): i32 => ((n - 1) | 0);

const newArray = (n: i32): i32 => Math.imul(n, 2);

const at = (xs: i32[], k: i32): i32 => __nish_idx(xs, k);

const drop = (xs: i32[]): i32 => __nish_pop(xs);

export const main = (): i32 => {
  const idx: i32 = 1;
  const xs: i32[] = [3, 4, 5];
  console.log(at(xs, checkedSub(xs[0], 2)));
  setIdx(xs, ((xs.length - 1) | 0), checkedAdd(xs[0], idx));
  console.log(xs[2]);
  console.log(drop(xs));
  const ys = __nish_newArray(newArray(idx), 0);
  console.log(ys.length);
  console.log(pop(idx));
  return 0;
};
