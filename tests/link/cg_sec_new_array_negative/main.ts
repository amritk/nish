// A negative `i32` length parsed from input wrapped the inline allocator's
// rounding, and the zero fill wrote until the process faulted. It is refused
// with `array length out of range` (exit 1) before anything is allocated, and
// a length that fits is still taken as it stands.
// docs/security/codegen.md, CG-2.
import { bytes } from "./lib";

export const main = (): number => {
  const fits: u8[] = bytes(toI32(parseInt("5")));
  console.log(`fits ${fits.length}`);
  const a: u8[] = bytes(toI32(parseInt("-1")));
  console.log(`after ${a.length}`);
  return 0;
};
