// The function `expose` runs may not print: what it returns is all that leaves.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
const leak = (k: u8[]): i32 => {
  console.log(toI32(k.length));
  return 0;
};
export const main = (): i32 => {
  const k = secret(bytes());
  const x = expose(k, leak);
  wipe(k);
  return x;
};
