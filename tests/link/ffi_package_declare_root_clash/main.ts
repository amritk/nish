// Two packages declare the C function `abs`, which keeps its bare name, and
// the entry defines a private function of the same name, whose symbol in the
// root package is that name too. The fact table would hand one the other's
// facts, so the compile is refused (NL3040), once, at the definition: that is
// the one to rename, and the two declarations agree with each other.
import { probeAbs } from "./node_modules/probe/index";
import { probeAbs as againAbs } from "./node_modules/probe2/index";

const abs = (n: i32): i32 => n * 2;

export const main = (): i32 => {
  console.log(`${probeAbs(-7)} ${againAbs(-8)} ${abs(3)}`);
  return 0;
};
