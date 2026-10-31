// nish:secret: an arrow handed through another function to `expose` still
// may not carry a capture there.
import { Secret, expose, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
const open = (k: Secret<u8[]>, f: (b: u8[]) => i32): i32 => expose(k, f);
export const main = (): i32 => {
  const k = secret(bytes());
  const leak: u8[] = [0, 0];
  const n = open(k, (b: u8[]): i32 => {
    leak.set(b, 0);
    return 0;
  });
  wipe(k);
  return n;
};
