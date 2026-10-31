// A `Secret` is read only inside `expose`: an arrow argument that would
// carry one into another function is refused.
import { Secret, expose, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);
export const main = (): i32 => {
  const k = secret(bytes());
  const n = apply((x) => x + expose(k, (b: u8[]): i32 => b.length), 1);
  wipe(k);
  return n;
};
