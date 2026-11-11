// `toFixed` from `nish/text` against JavaScript's own `Number.prototype.toFixed`.
// Each line prints `x` as a template hole does, which is `String(x)` and reads
// back as the same `f64`, then the digit count and the answer. `tests/run.js`
// runs this natively and under the Node prelude, holds both to expected.out,
// and holds every line to `Number(x).toFixed(n)` computed by Node itself, so
// the golden cannot drift from JavaScript.
//
// The values are the ones ECMA-262's rounding decides: ties at 0 digits, which
// go to the larger answer (away from zero), decimals that are stored a little
// below or above what they print (1.005, 1.045, 8.345), the 1e21 edge where the
// answer turns to `String(x)`, the subnormals, and 100 digits, which show the
// exact binary value.
import { toFixed } from "../../../std/text.ts";

const show = (x: f64, n: i32): void => {
  console.log(`toFixed(${x}, ${n}) = ${toFixed(x, n)}`);
};

export const main = (): number => {
  const zero: f64 = 0;
  // Ties at no digits after the point take the larger magnitude.
  show(0.5, 0);
  show(1.5, 0);
  show(2.5, 0);
  show(-2.5, 0);
  show(-1.5, 0);
  show(9.5, 0);
  // Stored below what they print, so they round down; 8.345 is stored above.
  show(1.005, 2);
  show(1.045, 2);
  show(8.345, 2);
  show(0.125, 2);
  show(999.9995, 3);
  show(99.99, 1);
  // The edges #483 names.
  show(zero / zero, 2);
  show(-0, 2);
  show(-0.0001, 2);
  show(1e20, 2);
  show(1e21, 2);
  show(-1e21, 2);
  show(999999999999999900000, 2);
  show(1.7976931348623157e308, 2);
  show(1 / zero, 2);
  show(-1 / zero, 0);
  // The largest and smallest subnormals, short and at full width.
  show(2.225073858507201e-308, 2);
  show(2.225073858507201e-308, 100);
  show(5e-324, 0);
  show(5e-324, 100);
  show(-5e-324, 3);
  // 123.456 at both ends of the digit range, and other widths.
  show(123.456, 0);
  show(123.456, 100);
  show(0, 0);
  show(0.000001, 7);
  show(1e-7, 100);
  show(9007199254740993, 2);
  show(0.1, 20);
  show(-1234.5678, 1);
  // No f64 in [2^52, 2^53) has a fraction, so the closest with one sits just
  // below 2^52: one ulp is a half there, and the tie rounds up to 2^52.
  show(4503599627370495.5, 0);
  show(2251799813685248.5, 0);
  // A carry that runs through every digit and grows a new one; 9.995 is
  // stored below what it prints, so it stays.
  show(999.5, 0);
  show(99.995, 2);
  show(9.995, 2);
  // -0's sign is invisible above, where "0.00" reads the same either way.
  console.log(`-0 gives "0": ${toFixed(-0, 0) === "0"}`);
  return 0;
};
