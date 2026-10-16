// An assignment used as an initialiser hands its array to the new local too.
import { Secret, secret, wipe } from "nish:secret";
export const main = (): i32 => {
  let raw: u8[] = [9];
  const alias: u8[] = (raw = [1, 2, 3]);
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(alias[0]);
};
