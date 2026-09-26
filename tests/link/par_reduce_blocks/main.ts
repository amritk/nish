// A reduce's blocks are part of its answer (docs/LANGUAGE.md, "Data
// parallelism"), so the way `std/threads.ts` computes them must not move.
// 70,000,001 elements is 64 blocks, and block `k` starts at
// floor(n * k / 64): past 2^31 for every `k` from 31 on, where an `i32`
// product would wrap. `step` is deliberately not associative, which a named
// function may be, so the answer shows where each block ends: the last element
// of every block is 1, a block folds to 1 exactly when its last element is
// that 1, and the combine keeps the last eight blocks' partials, one bit each.
import { parallelReduce } from "nish/threads";

const step = (acc: u8, x: u8): u8 => acc * 2 + x;

/** Where block `k` of 64 starts, computed in `i64` as the answer is defined. */
const start = (n: i32, k: i32): i32 => toI32((toI64(n) * toI64(k)) / toI64(64));

export const main = (): i32 => {
  const n: i32 = 70000001;
  const xs = new Array<u8>(n);
  for (let k: i32 = 1; k <= 64; k++) {
    const last = start(n, k) - 1;
    if (last >= 0 && last < toI32(xs.length)) {
      xs[last] = 1;
    }
  }
  // 1 in each of the last eight blocks, weighted 2^7 down to 2^0.
  console.log(`${parallelReduce(xs, step, 0)} ${start(n, 63)} ${start(n, 64)}`);
  return 0;
};
