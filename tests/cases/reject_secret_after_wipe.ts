// A wiped `Secret` holds zeros: reading it again is a mistake the checker names.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
const n = (k: u8[]): i32 => toI32(k.length);
export const main = (): i32 => {
  const k = secret(bytes());
  wipe(k);
  return expose(k, n);
};
