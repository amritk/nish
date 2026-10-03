// The function `expose` runs may not hand back the key itself.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
const keep = (k: u8[]): u8[] => k;
export const main = (): i32 => {
  const k = secret(bytes());
  const raw = expose(k, keep);
  wipe(k);
  return toI32(raw.length);
};
