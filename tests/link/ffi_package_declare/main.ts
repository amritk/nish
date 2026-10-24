// A `declare function` binds the C function of its name in whichever package
// declares it (docs/LANGUAGE.md "Calling C"). Before this held, the two
// packages' declarations were emitted as `@probe.abs` and `@cstr.abs`, which no
// C library defines, and the link failed.
//
// `abs` is declared three times here, once in each package and once in the
// entry, with one signature, and the three are one C function: one symbol, and
// the same facts under it.
import { probeAbs } from "./node_modules/probe/index";
import { distance, length } from "cstr";

declare function abs(n: i32): i32;

export const main = (): i32 => {
  console.log(`${probeAbs(-7)} ${distance(3, 10)} ${abs(-2)} ${length("sqlite")}`);
  return 0;
};
