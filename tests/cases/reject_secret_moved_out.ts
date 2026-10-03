// After `const j = k`, the key is `j`'s, and `k` is not read again.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
const n = (k: u8[]): i32 => toI32(k.length);
export const main = (): i32 => {
  const k = secret(bytes());
  const j = k;
  const x = expose(k, n);
  wipe(j);
  return x;
};
