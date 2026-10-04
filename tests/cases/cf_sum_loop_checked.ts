// cf_sum_loop under the checked default (cf_sum_loop itself is compiled with
// `--wrapping`). `sum` can pass INT_MAX for a large `n`, so each `+=` is
// `llvm.sadd.with.overflow` and a branch to the overflow panic, while `i++`
// under `i < n` is proven and is `add nsw`. tests/run.js pins the loop this
// leaves after `opt -O2`: the check survives in the loop, the step widens to
// `add nuw nsw`, and the loop with its second exit is not vectorised.
export function sumTo(n: number): number {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += i % 1000;
  }
  return sum;
}

export function test(): number {
  return sumTo(1000);
}
