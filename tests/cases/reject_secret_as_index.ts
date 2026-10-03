// A `Secret` cannot be an index either: a key-dependent address is a cache-timing channel.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
export const main = (): i32 => {
  const k = secret(bytes());
  const table: i32[] = [1, 2, 3];
  const x = table[k];
  wipe(k);
  return 0;
};
