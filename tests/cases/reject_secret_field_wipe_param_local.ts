// A function handed a caller's own local borrows it too: wiping it would leave the caller reading zeros.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
const end = (s: Secret<u8[]>): void => {
  wipe(s);
};
export const main = (): i32 => {
  const l = secret(bytes());
  end(l);
  const n = expose(l, sum);
  wipe(l);
  return n;
};
