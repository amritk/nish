// Two packages declare the C function `abs`, which keeps its bare name, and
// one declares `myc` too. The entry exports a function called `abs` and
// defines a private one called `myc`: the exported one's name is its symbol,
// and `myc` is no name reserved to C, so it is not spelled apart either. Each
// is the symbol of a declared C function, which the link would bind both to,
// so each is refused (NL3040), at the definition: that is the one to rename,
// and the declarations agree with each other. A private `abs` would be
// emitted as `abs$` and meet nothing (`ffi_package_declare_apart`).
import { probeAbs, probeMyc } from "./node_modules/probe/index";
import { probeAbs as againAbs } from "./node_modules/probe2/index";

export const abs = (n: i32): i32 => n * 2;

const myc = (n: i32): i32 => n + 1;

export const main = (): i32 => {
  console.log(`${probeAbs(-7)} ${againAbs(-8)} ${abs(3)} ${probeMyc(1)} ${myc(2)}`);
  return 0;
};
