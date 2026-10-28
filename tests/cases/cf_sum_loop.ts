// `sum` can pass INT_MAX for a large `n`, so a checked `+=` branches to the
// overflow panic on every pass, and a loop with a second exit is not
// vectorised (that is `cf_sum_loop_checked`). `wrappingAdd` from `nish:unsafe`
// asks for the plain `add` at this one site, and that is the loop the guard
// is about.
//
// The modulo keeps LLVM from folding the whole loop into n*(n-1)/2, so a
// real loop survives to -O2 and tests/run.js can check that it vectorises.
// `sumTo` is exported for the same reason: an `internal` function called once
// with a constant is inlined and folded to its answer, and there is no loop
// left to vectorise.
import { wrappingAdd } from "nish:unsafe";

export function sumTo(n: number): number {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum = wrappingAdd(sum, i % 1000);
  }
  return sum;
}

export function test(): number {
  return sumTo(1000);
}
