// WP51 stage 2: `exposeWith` takes no function reference.
import { exposeWith, secret, wipe } from "nish:secret";
type F = (b: u8[], a: i32) => i32;
const bytes = (): u8[] => [1, 2];
const count = (b: u8[], a: i32): i32 => b.length + a;
export const main = (): i32 => {
  const k = secret(bytes());
  const h: F = count;
  const n = exposeWith(k, 1, h);
  wipe(k);
  return n;
};
