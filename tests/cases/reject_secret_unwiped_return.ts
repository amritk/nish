// A `return` that leaves a `Secret` the function made neither wiped nor returned.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
const n = (k: u8[]): i32 => toI32(k.length);
export const main = (): i32 => {
  const k = secret(bytes());
  return expose(k, n);
};
