// A declarator after `secret(raw)` in the same statement reads `raw` once it is
// moved: the move rule covers every declarator, not only the first.
import { Secret, secret, wipe } from "nish:secret";
export const main = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const key: Secret<u8[]> = secret(raw), alias = raw;
  wipe(key);
  return toI32(alias[0]);
};
