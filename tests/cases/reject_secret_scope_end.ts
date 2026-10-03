// A void function that falls off its end with a `Secret` unwiped.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
const n = (k: u8[]): i32 => toI32(k.length);
const f = (): void => {
  const k = secret(bytes());
  console.log(expose(k, n));
};
export const main = (): i32 => {
  f();
  return 0;
};
