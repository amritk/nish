// The entry declares `abs` as C's `int abs(int)` and a package declares it
// with `i64`: two prototypes for one C symbol, which C itself would refuse.
// The fact table keys both by `abs`, so one would be analysed under the
// other's types, and the compile is refused naming both (NL3039).
import { wideAbs } from "./node_modules/wide/index";

declare function abs(n: i32): i32;

export const main = (): i32 => {
  console.log(`${wideAbs(-4)} ${abs(-2)}`);
  return 0;
};
