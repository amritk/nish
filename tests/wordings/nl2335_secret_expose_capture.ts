// NL2335: an arrow given to `expose` reads a local of the function it is
// written in; what `expose` runs captures nothing.
import { expose, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
export const main = (): i32 => {
  const k = secret(bytes());
  const leak: u8[] = [0, 0];
  const n = expose(k, (b: u8[]): i32 => {
    leak.set(b, 0);
    return 0;
  });
  wipe(k);
  return n;
};
