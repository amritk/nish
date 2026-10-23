// `a[b[i]]` with neither index proven: both reads are checked, the inner
// one first, and a store and a compound store through a checked slot keep
// the order of evaluation. The indices come from an array, so no caller
// proves them.
import { idx, updIdx, setIdx, pop } from "nish/runtime"
import type { i32 } from "nish/runtime"
const pick = (a: i32[], b: i32[], i: i32): i32 => idx(a, idx(b, i));

const bump = (a: i32[], b: i32[], i: i32): i32 => {
  updIdx(a, idx(b, i), (old) => old + 10);
  updIdx(a, i, (old) => old - 1);
  setIdx(a, b[i], a[i] * 2);
  return idx(a, b[i]);
};

export const main = (): number => {
  const a = [5, 6, 7];
  const b = [2, 0, 1];
  const ks = [0, 2, 1];
  console.log(`${pick(a, b, ks[0])} ${pick(a, b, ks[1])}`);
  console.log(`${bump(a, b, ks[2])} ${a[0]} ${a[1]} ${a[2]}`);
  const last = pop(a);
  console.log(`${last} ${a.length}`);
  return 0;
};
