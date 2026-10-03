// A write two calls down from the function `expose` runs is still a write.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
const store = (x: i32): void => {
  writeFileSync("out", `${x}`);
};
const leak = (k: u8[]): i32 => {
  store(toI32(k.length));
  return 0;
};
export const main = (): i32 => {
  const k = secret(bytes());
  const x = expose(k, leak);
  wipe(k);
  return x;
};
