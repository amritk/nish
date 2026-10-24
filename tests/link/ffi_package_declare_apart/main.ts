// Two packages declare the C function `abs` and a third declares `labs`, and
// the entry defines a private `abs` and a generic `labs`. Neither takes a C
// symbol: the private `abs` is reserved to C, so it is emitted as `abs$`, and
// a template's instantiations are named after it (`labs$i32`). The program
// links, each call reaching the function it names.
import { probeAbs } from "./node_modules/probe/index";
import { probeAbs as againAbs } from "./node_modules/probe2/index";
import { wideAbs } from "./node_modules/wide/index";

const abs = (n: i32): i32 => n * 2;

export const labs = <T>(x: T): T => x;

export const main = (): i32 => {
  console.log(`${probeAbs(-7)} ${againAbs(-8)} ${abs(3)} ${wideAbs(-40)} ${labs(5)}`);
  return 0;
};
