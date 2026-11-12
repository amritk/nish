// WP51 stage 2: `expose` takes no function reference: what it runs is
// checked to keep the secret, and a reference is known only at run time.
import { expose, secret, wipe } from "nish:secret";
type F = (b: u8[]) => i32;
const bytes = (): u8[] => [1, 2];
const count = (b: u8[]): i32 => b.length;
export const main = (): i32 => {
  const k = secret(bytes());
  const h: F = count;
  const n = expose(k, h);
  wipe(k);
  return n;
};
