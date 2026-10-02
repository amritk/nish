// A NaN length reached `fptosi`, whose answer for a NaN is poison: on x86-64
// it came out as -2^63, and 8 bytes each wrapped that to an empty block behind
// a header of 2^63 elements. The length is refused before it is converted.
// docs/security/codegen.md, finding CG-1.
import { doubles } from "./lib";

export const main = (): i32 => {
  const n: number = Number("not a number");
  console.log("before");
  const a: f64[] = doubles(n);
  a[Number("200000000")] = 1.5;
  console.log("after");
  return 0;
};
