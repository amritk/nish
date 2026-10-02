// Under `--number-mode i32` an `i64` length past 2^31 - 1 made an array whose
// `length` read back negative (2^31 + 5 read -2147483643). It is refused, and a
// length that fits is still taken as it stands.
// docs/security/codegen.md, findings CG-1 and K1-6.
import { bytes } from "./lib";

export const main = (): number => {
  const fits: u8[] = bytes(toI64(parseInt("5")));
  console.log(`fits ${fits.length}`);
  const n: i64 = toI64(2147483647) + toI64(parseInt("6"));
  const a: u8[] = bytes(n);
  console.log(`after ${a.length}`);
  return 0;
};
