// Under `--number-mode f64` the length is a float. 2^61 doubles is 2^64 bytes,
// which wrapped to an empty block behind a header claiming 2^61 elements, so
// the bounds checks passed and the store below landed far outside it. The
// length is refused before it is converted; one that fits is taken as it is.
// docs/security/codegen.md, finding CG-1.
import { doubles } from "./lib";

export const main = (): i32 => {
  const fits: f64[] = doubles(Number("3"));
  console.log(`fits ${fits.length}`);
  const n: number = Number("2305843009213693952");
  const a: f64[] = doubles(n);
  a[Number("200000000")] = 1.5;
  console.log("after");
  return 0;
};
