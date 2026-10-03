// A `Secret` cannot be indexed.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
export const main = (): i32 => {
  const k = secret(bytes());
  const first = k[0];
  wipe(k);
  return 0;
};
