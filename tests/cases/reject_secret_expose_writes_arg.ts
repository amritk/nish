// The function `exposeWith` runs may not write the argument it is handed.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
const out = (k: u8[], o: u8[]): i32 => {
  o.set(k, 0);
  return 0;
};
export const main = (): i32 => {
  const k = secret(bytes());
  const o: u8[] = [0, 0];
  const x = exposeWith(k, o, out);
  wipe(k);
  return x;
};
