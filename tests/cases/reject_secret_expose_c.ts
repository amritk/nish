// A C function is outside what the compiler can prove, so `expose` will not run one.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
declare function c_use(x: i32): i32;
const leak = (k: u8[]): i32 => c_use(toI32(k.length));
export const main = (): i32 => {
  const k = secret(bytes());
  const x = expose(k, leak);
  wipe(k);
  return x;
};
