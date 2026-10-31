// nish:secret: what `expose` runs reads only its own parameters, so the
// exposed value cannot be written anywhere the caller can see.
import { expose, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
export const main = (): i32 => {
  const k = secret(bytes());
  const leak: u8[] = [0, 0];
  const n = expose(k, (b: u8[]): i32 => {
    leak.set(b, 0);
    return 0;
  });
  wipe(k);
  return n;
};
