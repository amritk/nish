// WP15 §2.4, the build-mode rule: tests/link/range_export's program, built
// with `--link` as that one is, but declaring a C function. What that C
// library does is not this compiler's to prove, so the build stays open and
// `Permute.swap` keeps both of its bounds checks (`hostVisible` in
// `self/visibility.ts`, checked by `tests/run.js`).
import { Permute } from "../range_export/permute";

declare function abs(n: i32): i32;

export const main = (): number => {
  const p = new Permute();
  console.log(`${p.innerBenchmarkLoop(3)}`);
  console.log(`${p.count}`);
  console.log(`${abs(-3)}`);
  return 0;
};
